import { createVettingRouter } from './vetting/router';
import { createSourceRouter } from './bigquery/sourceRouter';
import { Router, type Request, type Response, type NextFunction } from 'express';
import * as legacy from './bigquery/queries';
import { getOverviewStats, getQualityStats, getCohortStats, getLeadTimeline, validationUnavailable } from './bigquery/reporting';
import { executeDynamicQuery, generateDriverInsights } from './bigquery/semantic_engine';
import { getClientConfig, getAllClients, validateEnvironment } from './bigquery/config';
import { checkBigQueryHealth } from './bigquery/client';
import { discoverData } from './bigquery/discovery';
import { parameterCoverage } from './bigquery/parameterCoverage';
import { metricTableLineage } from './bigquery/sourceCatalog';
import { exportData } from './bigquery/export';
import { validateScope, validateFilters, scalarString, boundedInteger, RequestError, type QueryScope } from './bigquery/filters';
import { withAnalyticsScope } from './analyticsContext';
import { requireTenant } from './securityPolicy';
import { requireAdmin, configuredAuthMode } from './security';
import { cacheResponse } from './cacheMiddleware';
import { MODEL_VERSION } from './bigquery/integrity';
import { serverQueryCache } from './cache';
import { analyticalRoute as asyncRoute } from './analyticalWork';
import { buildOffernetQueryParams } from './analytics/requestScope';
import { operationalMetadata } from './analytics/common/lineage';
import { redactReportRecords } from './analytics/common/reportAccess';
import { analyticsRequestTenant } from './requestTenant';
import { checkGeminiHealth, askGeminiAnalytics } from './gemini/client';
import { AUTHORITATIVE_METRICS, METRIC_REGISTRY_VERSION } from '../contracts/metricRegistry';
import fs from 'node:fs';
import {
  getCliPerformance,
  parseAndValidateCliCsv,
  setTenantImport,
  clearTenantImport,
  generateBenchmarkCliDataset,
} from './bigquery/cli_analytics';

export const analyticsRouter = Router();
validateEnvironment();
function scopeFrom(req: Request): QueryScope {
  const input = req.method === 'GET' || req.method === 'DELETE'
    ? req.query
    : { ...req.query, ...(req.body || {}) };
  const filters = validateFilters(input.filters);
  for (const key of ['source', 'medium', 'vendor', 'partner', 'ror_partner', 'grade', 'cli', 'campaign', 'channel', 'adset', 'agent']) {
    const value = scalarString(input[key], key, 500);
    if (value) {
      const values = value.split(',').map(v => v.trim()).filter(Boolean);
      const targetKey = ['partner', 'ror_partner'].includes(key) ? 'vendor' : key;
      const existing = filters[targetKey] || filters[key];
      if (existing) {
        const existingValues = existing.operator === 'in' ? existing.values : existing.operator === 'equals' ? [existing.value] : [];
        if (JSON.stringify([...(existingValues || [])].sort()) !== JSON.stringify([...values].sort())) {
          throw new RequestError(`Conflicting ${targetKey} filters`, 422);
        }
      } else {
        filters[targetKey] = { operator: 'in', values };
      }
    }
  }
  // Old report functions implement vendor/partner cohort predicates for IN, not equality.
  for (const key of ['vendor', 'partner', 'ror_partner']) {
    const f = filters[key];
    if (f?.operator === 'equals') filters[key] = { operator: 'in', values: [f.value!] };
    else if (f && f.operator !== 'in') throw new RequestError(`Use an inclusion filter for ${key}`);
  }
  return validateScope({ clientId: analyticsRequestTenant(req), startDate: input.startDate || input.dateRange?.start,
    endDate: input.endDate || input.dateRange?.end, filters });
}
analyticsRouter.use((req, res, next) => {
  try {
    if (!res.locals.principal) throw new RequestError('Authentication required', 401);
    if (req.path === '/clients') return next();
    const scope = scopeFrom(req), client = getClientConfig(scope.clientId);
    scope.clientId = client.id;
    requireTenant(res.locals.principal, client.id);
    res.locals.scope = scope;
    withAnalyticsScope(scope, () => next());
  } catch (error) { next(error); }
});
function metadata(res: Response, view: string) {
  const scope = res.locals.scope as QueryScope, client = getClientConfig(scope.clientId);
  return { clientId: client.id, clientName: client.name, currency: client.currency, generatedAt: new Date().toISOString(),
    dataAsOf: null, validationStatus: 'NOT_VERIFIED', modelVersion: MODEL_VERSION, appliedFilters: scope.filters,
    startDate: scope.startDate ?? null, endDate: scope.endDate ?? null, dateBasis: 'lead_capture_cohort', attribution: 'selected_vendor_transactions',
    sourceDependencies: metricTableLineage(scope.clientId).legacy,
    source: { type: 'bigquery', project: client.bigQueryProject, dataset: client.bigQueryDatasets[0], analyticsView: view } };
}
function singleFlight<T>(res: Response, operation: string, input: unknown, work: () => Promise<T>, ttlSeconds = 120): Promise<T> {
  const principal = res.locals.principal;
  const key = JSON.stringify(['analytics-query', principal.subject, principal.role, [...principal.tenants].sort(), operation, res.locals.scope, input]);
  // OfferNet response middleware owns retention. A second retained cache could
  // give an ageing result a fresh response TTL under an equivalent URL.
  return serverQueryCache.getOrFetch(key, work, operation.startsWith('offernet-') ? 0 : ttlSeconds);
}
analyticsRouter.get('/clients', (_req, res) => {
  const allowed = res.locals.principal.tenants as string[];
  res.json({ success: true, data: getAllClients().filter(c => allowed.includes(c.id)).map(c => ({ id: c.id, name: c.name, currency: c.currency, timezone: c.timezone, capabilities: c.capabilities })) });
});
analyticsRouter.get('/health', asyncRoute(async (_req, res) => {
  const client = getClientConfig(res.locals.scope.clientId);
  const table = client.semanticMappings.tables.leads.split('.');
  const health = await checkBigQueryHealth(table[0], table[1], table[2]);
  res.json({ success: true, health, data: health, client: client.name });
}));
analyticsRouter.get('/discovery', requireAdmin, asyncRoute(async (_req, res) => res.json({ success: true, data: await discoverData(getClientConfig(res.locals.scope.clientId)) })));
analyticsRouter.get('/validation', requireAdmin, (_req, res) => {
  const scope = res.locals.scope as QueryScope;
  res.json({
    success: true,
    metadata: {
      validationStatus: 'NOT_VERIFIED',
      evidenceKind: 'HISTORICAL_REFERENCE',
      generatedAt: new Date().toISOString(),
      dataAsOf: null,
      source: { type: 'historical_reference', liveWarehouseRead: false },
      // Request provenance is not the scope of the historical reference values.
      requestScope: {
        clientId: scope.clientId,
        startDate: scope.startDate ?? null,
        endDate: scope.endDate ?? null,
        appliedFilters: scope.filters,
      },
    },
    data: validationUnavailable(),
  });
});
analyticsRouter.get('/parameter-coverage', requireAdmin, asyncRoute(async (_req, res) => res.json({success:true,data:await parameterCoverage(res.locals.scope.clientId)})));
analyticsRouter.get('/metrics/registry', cacheResponse(120), asyncRoute(async (_req, res) => {
  res.json({
    success: true,
    version: METRIC_REGISTRY_VERSION,
    totalMetrics: Object.keys(AUTHORITATIVE_METRICS).length,
    data: AUTHORITATIVE_METRICS,
  });
}));
analyticsRouter.get('/metrics/authoritative', cacheResponse(120), asyncRoute(async (_req, res) => {
  res.json({
    success: true,
    version: METRIC_REGISTRY_VERSION,
    totalMetrics: Object.keys(AUTHORITATIVE_METRICS).length,
    data: AUTHORITATIVE_METRICS,
  });
}));
analyticsRouter.use(createVettingRouter());
analyticsRouter.use(createSourceRouter());
const reports: [string[], (scope: QueryScope) => Promise<unknown>, boolean][] = [
  [['overview'], getOverviewStats, false], [['funnel'], legacy.getFunnelStats, false], [['quality'], getQualityStats, false],
  [['sources'], legacy.getSourcesStats, false], [['timeseries'], legacy.getTimeseriesStats, false],
  [['data-quality'], legacy.getDataHealthStats, true], [['calls', 'call-performance'], legacy.getCallPerformanceStats, true],
  [['speed-to-lead'], legacy.getSpeedToLeadStats, true], [['outcomes'], legacy.getOutcomesStats, true],
  [['routing'], legacy.getRoutingIntelligenceStats, true], [['consumers'], legacy.getConsumerReentryStats, true],
  [['outcomes-quality'], legacy.getOutcomeQualityStats, true], [['revetting'], legacy.getRevettingStats, true],
  [['data-trust'], legacy.getDataTrustStats, true], [['multi-vendor'], legacy.getMultiVendorStats, false],
  [['vendor-coverage', 'hlc-coverage'], legacy.getHlcVendorCoverage, true], [['filter-options'], legacy.getFilterOptions, true],
];
for (const [routes, query, mixedGrain] of reports) {
  analyticsRouter.get(routes.map(r => `/${r}`), cacheResponse(120), asyncRoute(async (_req, res) => {
    const scope = res.locals.scope as QueryScope;
    if (mixedGrain && Object.keys(scope.filters || {}).some(k => !['source', 'vendor', 'medium'].includes(k))) {
      throw new RequestError('This report supports date, source, vendor and medium filters. Advanced cross-grain filters require further validation.', 422);
    }
    const data = await singleFlight(res, routes[0], null, () => query(scope));
    res.json({ success: true, metadata: metadata(res, routes[0]), data: redactReportRecords(data, res.locals.principal.role === 'admin') });
  }));
}
analyticsRouter.get('/cohorts', cacheResponse(120), asyncRoute(async (req, res) => {
  const input = { ...res.locals.scope, cohortType: scalarString(req.query.cohortType, 'cohortType'), metricType: scalarString(req.query.metricType, 'metricType') };
  const data = await singleFlight(res, 'cohorts', {cohortType:input.cohortType,metricType:input.metricType}, () => getCohortStats(input));
  res.json({ success: true, metadata: metadata(res, 'event_time_cohorts'), data });
}));
analyticsRouter.get('/leads', requireAdmin, cacheResponse(60), asyncRoute(async (req, res) => {
  const input = { ...res.locals.scope, limit: boundedInteger(req.query.limit, 100, 1000, 1), offset: boundedInteger(req.query.offset, 0, 100000) };
  const data = await singleFlight(res, 'leads', {limit:input.limit,offset:input.offset}, () => legacy.getLeads(input), 60);
  res.json({ success: true, metadata: metadata(res, 'vw_leads'), data: data.map(row => ({ ...row, quality: 'Not independently verified' })) });
}));
analyticsRouter.get('/lead-timeline/:leadId', requireAdmin, cacheResponse(120), asyncRoute(async (req, res) => {
  const leadId = scalarString(req.params.leadId, 'leadId', 100);
  const data = await singleFlight(res, 'lead-timeline', {leadId}, () => getLeadTimeline({ ...res.locals.scope, leadId: leadId! }));
  res.json({ success: true, metadata: metadata(res, 'lead_timeline'), data });
}));
function requireAdminForRecordExport(req: Request, res: Response, next: NextFunction) {
  try {
    const grain = scalarString(req.query.grain, 'grain') || 'lead';
    if (grain === 'cli') return next();
    return requireAdmin(req, res, next);
  } catch (error) {
    next(error);
  }
}

analyticsRouter.get('/export', requireAdminForRecordExport, asyncRoute(async (req, res) => {
  const format = scalarString(req.query.format, 'format') || 'csv';
  if (!['csv', 'json'].includes(format)) throw new RequestError('Unsupported export format');
  if (['segment', 'chartBucket', 'metrics', 'drill', 'drillValue', 'investigationMetric', 'segmentVendor', 'segmentSource', 'segmentGrade', 'segmentLeadAge'].some(key => req.query[key] !== undefined)) throw new RequestError('Use the investigation record export for scoped evidence; this export endpoint cannot apply investigation drill or segment parameters', 422);
  const result = await exportData({ ...res.locals.scope, grain: scalarString(req.query.grain, 'grain') || 'lead',
    search: scalarString(req.query.search, 'search', 200), format, limit: boundedInteger(req.query.limit, 10000, 50000, 1) });
  if (process.env.CX_ENABLE_AUDIT_LOG === 'true') {
    console.info(JSON.stringify({ action: 'DATA_EXPORT', requestId: res.locals.requestId, subject: res.locals.principal.subject, clientId: res.locals.scope.clientId, rowCount: result.metadata.rowCount, truncated: result.metadata.truncated, modelVersion: MODEL_VERSION }));
  }
  if (format === 'json') return res.json({ success: true, metadata: result.metadata, data: result.rows });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${res.locals.scope.clientId}_${result.metadata.grain}_export.csv"`);
  res.setHeader('X-Export-Truncated', String(result.metadata.truncated));
  res.setHeader('X-Export-Row-Count', String(result.metadata.rowCount));
  res.send(result.csv);
}));
for (const route of ['/explore', '/insights', '/drivers']) {
  const handler = asyncRoute(async (req, res) => {
    const input = req.method === 'GET' ? req.query : req.body;
    const metric = scalarString(input.metric, 'metric') || (route === '/explore' ? 'leads' : 'activations');
    const dimension = scalarString(input.dimension, 'dimension') || 'source';
    const args = { ...res.locals.scope, metric, dimension, secondaryDimension: scalarString(input.secondaryDimension, 'secondaryDimension') };
    const result = await singleFlight<any>(res, route, {metric,dimension,secondaryDimension:args.secondaryDimension}, () => route === '/explore' ? executeDynamicQuery(args) : generateDriverInsights(args));
    res.json({ success: true, data: result.data, metadata: { ...metadata(res, route.slice(1)), ...(result && 'metadata' in result ? result.metadata : {}) } });
  });
  analyticsRouter.get(route, cacheResponse(120), handler);
  analyticsRouter.post(route, handler);
}

import * as offernetAnalytics from './analytics';

// Offernet Operational Intelligence Endpoints
analyticsRouter.get('/offernet/operating-controls', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-operating-controls', params, () => offernetAnalytics.getOperatingControlsAnalytics(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/overview', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-overview', params, () => offernetAnalytics.getExecutiveOverview(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

// Investigation signals and descriptive diagnosis. Record/evidence routes below
// share the same request-scope parser and retain their explicit administrator gate.
analyticsRouter.get('/offernet/exceptions', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-exceptions', params, () => offernetAnalytics.getExceptionAnalytics(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, 'exceptions') });
}));

analyticsRouter.get('/offernet/root-cause', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-root-cause', params, () => offernetAnalytics.getRootCauseAnalysis(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

// Marketing attribution and source confidence.
analyticsRouter.get('/offernet/marketing-root-cause', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-marketing-root-cause', params, () => offernetAnalytics.getMarketingRootCauseAnalysis(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/marketing-attribution', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-marketing-attribution', params, () => offernetAnalytics.getMarketingAttributionAnalytics(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/marketing-discovery', requireAdmin, cacheResponse(60), asyncRoute(async (_req, res) => {
  const params = buildOffernetQueryParams(_req, res);
  const data = await singleFlight(res, 'offernet-marketing-discovery', { clientId: params.clientId }, () => offernetAnalytics.getMarketingSourceDiscovery({ clientId: params.clientId }));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/source-observability', cacheResponse(60), asyncRoute(async (_req, res) => {
  const params = buildOffernetQueryParams(_req, res);
  const data = await singleFlight(res, 'offernet-source-observability', { clientId: params.clientId }, () => offernetAnalytics.getSourceObservability({ clientId: params.clientId }));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

// Operational lifecycle, contact, sales and commercial reporting.
analyticsRouter.get('/offernet/offershop-flow', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-offershop-flow', params, () => offernetAnalytics.getOffershopProcessFlow(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, 'offershop-flow') });
}));

analyticsRouter.get('/offernet/offershop-stage/:stageId', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const rawStageId = req.params.stageId;
  const stageId = Array.isArray(rawStageId) ? rawStageId[0] : (rawStageId || '');
  const data = await singleFlight(res, `offernet-offershop-stage-${stageId}`, params, () => offernetAnalytics.getOffershopStageDetails(stageId, params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, 'offershop-stage') });
}));

analyticsRouter.post('/offernet/offershop-simulation', asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = offernetAnalytics.getOffershopSimulation(params, req.body || {});
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, 'offershop-simulation') });
}));

analyticsRouter.get('/offernet/funnel', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-funnel', params, () => offernetAnalytics.getFunnelIntelligence(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/speed-to-lead', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-speed-to-lead', params, () => offernetAnalytics.getSpeedToLeadAnalytics(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/contact-strategy', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-contact-strategy', params, () => offernetAnalytics.getContactStrategyAnalytics(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/contact-dispositions', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const rawMode = req.query.mode;
  const mode = rawMode === 'call_records' ? 'call_records' : 'lead_status';
  const data = await singleFlight(res, `offernet-contact-dispositions-${mode}`, { ...params, mode }, () =>
    offernetAnalytics.getContactDispositionsAnalytics({ ...params, mode })
  );
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, 'contact-dispositions') });
}));

analyticsRouter.get('/offernet/vendor-quality', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-vendor-quality', params, () => offernetAnalytics.getVendorQualityAnalytics(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/temporal', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-temporal', params, () => offernetAnalytics.getTemporalAnalytics(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/sales-activation', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-sales-activation', params, () => offernetAnalytics.getSalesActivationAnalytics(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/commercial', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-commercial', params, () => offernetAnalytics.getCommercialAnalytics(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/data-integrity', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-data-integrity', params, () => offernetAnalytics.getDataIntegrityAnalytics(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/agent-performance', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-agent-performance', params, () => offernetAnalytics.getAgentPerformanceAnalytics(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/campaigns', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-campaigns', params, () => offernetAnalytics.getClientCampaignAnalytics(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

// Investigation synthesis, affected records and dossier evidence.
analyticsRouter.get('/offernet/ai-insights', cacheResponse(60), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-ai-insights', params, () => offernetAnalytics.getAiInsightsAnalytics(params));
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/raw-leads', requireAdmin, cacheResponse(30), asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(res, 'offernet-raw-leads', params, () => offernetAnalytics.getRawLeads(params), 30);
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

analyticsRouter.get('/offernet/lead-timeline/:leadId', requireAdmin, cacheResponse(60), asyncRoute(async (req, res) => {
  const leadId = scalarString(req.params.leadId, 'leadId', 100);
  if (!leadId) throw new RequestError('leadId is required');
  const params = buildOffernetQueryParams(req, res);
  const data = await singleFlight(
    res,
    'offernet-lead-timeline',
    { leadId, ...params },
    () => offernetAnalytics.getLeadTimeline(leadId, params)
  );
  res.json({ success: true, data, metadata: operationalMetadata(res.locals.scope, res.req.path.split('/')[2] || '') });
}));

// Workspace configuration and Google service integration.
analyticsRouter.get('/offernet/client-config', asyncRoute((_req, res) => {
  const config = getClientConfig(res.locals.scope.clientId);
  const operational = config.operationalConfig
    ? {
        operatingHours: config.operationalConfig.operatingHours,
        grading: config.operationalConfig.grading,
        salesDefinition: config.operationalConfig.salesDefinition,
        activationDefinition: config.operationalConfig.activationDefinition,
        currency: config.operationalConfig.currency,
        dispositionMapping: config.operationalConfig.dispositionMapping,
        funnelStages: config.operationalConfig.funnelStages,
        commercialApproval: 'SOURCE_CONTRACTS_ONLY',
      }
    : undefined;
  res.json({
    success: true,
    data: {
      id: config.id,
      name: config.name,
      currency: config.currency,
      timezone: config.timezone,
      capabilities: config.capabilities,
      marketing: config.marketing ? {
        table: config.marketing.table,
        mappingStatus: config.marketing.mappingStatus,
        clientNameField: config.marketing.clientNameField,
        configuredClientNames: config.marketing.clientNames,
        approvedSpendFields: config.marketing.approvedSpendFields,
        spendGrainFields: config.marketing.spendGrainFields,
        attribution: config.marketing.attribution,
      } : null,
      operationalConfig: operational,
    },
  });
}));

analyticsRouter.post('/explain', asyncRoute(async (req, res) => {
  const params = buildOffernetQueryParams(req, res);
  const data = await offernetAnalytics.getAiInsightsAnalytics(params);
  res.json({ success: true, data });
}));

analyticsRouter.get('/google/status', asyncRoute(async (_req, res) => {
  const client = getClientConfig(res.locals.scope.clientId);
  const table = client.semanticMappings.tables.leads.split('.');
  const [bqHealth, geminiHealth] = await Promise.all([
    checkBigQueryHealth(table[0], table[1], table[2]),
    checkGeminiHealth(),
  ]);
  const authMode = configuredAuthMode();
  let oAuthClientId = '';
  try {
    const raw = fs.readFileSync('firebase-applet-config.json', 'utf8');
    const cfg = JSON.parse(raw);
    oAuthClientId = cfg.oAuthClientId || '';
  } catch {
    // optional
  }
  res.json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      workspace: client.name,
      clientId: client.id,
      bigquery: bqHealth,
      gemini: geminiHealth,
      identity: {
        authMode,
        oAuthClientId,
        provider: 'Google Identity Services (OAuth 2.0 / IAP)',
        authenticatedPrincipal: res.locals.principal?.email || res.locals.principal?.subject || 'authenticated',
      },
    },
  });
}));

analyticsRouter.post('/google/ask', asyncRoute(async (req, res) => {
  const question = scalarString(req.body?.question, 'question', 1000);
  if (!question) {
    throw new RequestError('question is required as a non-empty string', 400);
  }
  const params = buildOffernetQueryParams(req, res);
  // Legacy Q&A may still receive investigation scope from API callers. Reuse the
  // exact aggregate-only path instead of supplying unrelated queue/warehouse data.
  if (offernetAnalytics.isInvestigationScopedRequest({ ...params, question: undefined })) {
    const scoped = await offernetAnalytics.getAiInsightsAnalytics({ ...params, question });
    if (!('scope' in scoped)) throw new RequestError('Investigation synthesis did not confirm the requested scope', 502);
    return res.json({ success: true, data: {
      answer: `${scoped.executiveSummary}\n\n${scoped.strategicFocus}`,
      model: scoped.model || 'deterministic-fallback',
      citations: scoped.metricReferences,
      scope: scoped.scope,
      source: scoped.source,
      validationStatus: scoped.validationStatus,
      limitations: scoped.limitations,
    } });
  }
  const client = getClientConfig(params.clientId);
  const [queue, change, warehouse] = await Promise.all([
    offernetAnalytics.getExceptionAnalytics(params),
    params.startDate && params.endDate ? offernetAnalytics.getRootCauseAnalysis({ ...params, metric: 'leadToSaleRate' }) : Promise.resolve(null),
    offernetAnalytics.getWarehouseCrossDatasetAnalytics(params.clientId).catch(() => null),
  ]);
  const context = {
    clientName: client.name,
    currency: client.currency,
    currentWindow: change ? change.currentWindow : (params.startDate && params.endDate ? { startDate: params.startDate, endDate: params.endDate } : undefined),
    previousWindow: change ? change.previousWindow : undefined,
    warehouse: warehouse ? {
      totalProjects: warehouse.kpis.totalProjects,
      totalDatasets: warehouse.kpis.totalDatasets,
      totalWarehouseObjects: warehouse.kpis.totalWarehouseObjects,
      datasetsTracked: warehouse.kpis.datasetsTracked,
      waterfallTimelines: warehouse.waterfallSummary.timelines.length,
      touchpointSources: warehouse.touchpointsSummary.sources.length,
    } : undefined,
    exceptions: queue.exceptions.filter(e => e.count > 0).map(e => ({
      id: e.id,
      title: e.title,
      count: e.count,
      severity: e.severity,
      detail: e.detail,
    })),
    drivers: change?.dimensions.flatMap(d => d.segments.slice(0, 3).map(s => ({
      dimension: d.label,
      name: s.name,
      delta: s.delta,
      contribution: s.contribution || undefined,
    }))),
  };
  const result = await askGeminiAnalytics(question, context);
  res.json({ success: true, data: result });
}));

// WAREHOUSE PROJECTS, DATASETS & TABLES ANALYTICS ENDPOINTS
analyticsRouter.get('/warehouse/overview', cacheResponse(60), asyncRoute(async (_req, res) => {
  const data = await offernetAnalytics.getWarehouseCrossDatasetAnalytics(res.locals.scope.clientId);
  res.json({ success: true, data });
}));

analyticsRouter.get('/warehouse/projects-and-tables', asyncRoute(async (_req, res) => {
  const { VERIFIED_PROJECTS_AND_TABLES } = await import('./analytics/warehouse/warehousePull.ts');
  res.json({ success: true, data: VERIFIED_PROJECTS_AND_TABLES });
}));

// Generic raw inspection is restricted to a master administrator, never a vendor fallback.
const readWarehousePage = async (req: Request, res: Response) => {
  const input = req.method === 'POST' ? req.body || {} : req.query;
  const { pullWarehouseTableData } = await import('./analytics/warehouse/warehousePull.ts');
  if (Object.keys(res.locals.scope.filters || {}).length) throw new RequestError('UNSUPPORTED_FILTER: Generic warehouse inspection uses its explicit date field and UTC window, not lead/vendor filters.', 422);
  const result = await pullWarehouseTableData({
    project: scalarString(input.project, 'project', 100) || 'dashboards-422710',
    dataset: scalarString(input.dataset, 'dataset', 100) || 'lead_ledger',
    table: scalarString(input.table, 'table', 100) || 'clustered_lead_ledger',
    limit: boundedInteger(input.limit, 50, 500, 1), offset: boundedInteger(input.offset, 0, 100000, 0),
    startDate: scalarString(input.startDate, 'startDate', 10), endDate: scalarString(input.endDate, 'endDate', 10),
    dateField: scalarString(input.dateField, 'dateField', 100),
    syncToCloudSql: input.syncToCloudSql === true || input.syncToCloudSql === 'true',
    access: { clientId: res.locals.scope.clientId, role: res.locals.principal.role, tenants: res.locals.principal.tenants },
  });
  res.json({ success: true, data: result });
};
analyticsRouter.get('/warehouse/pull-data', requireAdmin, asyncRoute(readWarehousePage));
analyticsRouter.post('/warehouse/pull-data', requireAdmin, asyncRoute(readWarehousePage));

analyticsRouter.get('/cloudsql/synced-records', requireAdmin, (_req, res) => {
  res.status(410).json({ success: false, error: 'LEGACY_SYNC_QUARANTINED: Previously synced records may include generated evidence. They are not served as current analytics. Existing stored records have not been deleted.' });
});


analyticsRouter.get('/warehouse/tables', cacheResponse(60), asyncRoute(async (req, res) => {
  const query = scalarString(req.query.search, 'search', 100);
  const dataset = scalarString(req.query.dataset, 'dataset', 100);
  const family = scalarString(req.query.family, 'family', 100);
  const data = offernetAnalytics.searchWarehouseTables(query, dataset, family);
  res.json({ success: true, data, count: data.length });
}));

analyticsRouter.get('/warehouse/export', cacheResponse(30), asyncRoute(async (req, res) => {
  const format = scalarString(req.query.format, 'format', 50) || 'json';
  const project = scalarString(req.query.project, 'project', 100);
  const dataset = scalarString(req.query.dataset, 'dataset', 100);
  const search = scalarString(req.query.search, 'search', 100);
  const includeSchemas = req.query.includeSchemas !== 'false';
  const includeData = req.query.includeData !== 'false';

  const bundle = await offernetAnalytics.buildWarehouseExportBundle({
    clientId: res.locals.scope.clientId,
    projectFilter: project,
    datasetFilter: dataset,
    tableFilter: search,
    includeSchemas,
    includeData,
  });

  if (format === 'schema_csv' || format === 'csv') {
    const rawTables = offernetAnalytics.searchWarehouseTables(search, dataset);
    const filteredTables = project && project !== 'all' ? rawTables.filter(t => t.project === project) : rawTables;
    const csvContent = offernetAnalytics.generateWarehouseSchemaCsv(filteredTables);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="google_warehouse_all_tables_schemas.csv"');
    return res.send(csvContent);
  }

  if (format === 'tables_csv' || format === 'inventory_csv') {
    const rawTables = offernetAnalytics.searchWarehouseTables(search, dataset);
    const filteredTables = project && project !== 'all' ? rawTables.filter(t => t.project === project) : rawTables;
    const csvContent = offernetAnalytics.generateWarehouseInventoryCsv(filteredTables);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="google_warehouse_tables_inventory.csv"');
    return res.send(csvContent);
  }

  if (format === 'data_csv') {
    const csvContent = offernetAnalytics.generateWarehouseDataCsv(bundle);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="google_warehouse_data_and_telemetry.csv"');
    return res.send(csvContent);
  }

  res.json({ success: true, data: bundle });
}));

// DEDICATED CLI PERFORMANCE / DIALLER INTELLIGENCE ENDPOINTS
analyticsRouter.get('/cli-performance', cacheResponse(30), asyncRoute(async (req, res) => {
  const scope = res.locals.scope;
  const data = await getCliPerformance(scope);
  res.json({ success: true, data });
}));

analyticsRouter.post('/cli-performance/import', requireAdmin, asyncRoute(async (req, res) => {
  const scope = res.locals.scope;
  const { csvText, filename } = req.body || {};
  if (!csvText || typeof csvText !== 'string') {
    throw new RequestError('csvText is required as a string', 400);
  }
  const result = parseAndValidateCliCsv(csvText, filename || 'uploaded_cli_report.csv');
  if (result.errors.length > 0) {
    return res.status(400).json({ success: false, errors: result.errors, anomalies: result.anomalies });
  }
  setTenantImport(scope.clientId, {
    uploadedAt: new Date().toISOString(),
    filename: filename || 'uploaded_cli_report.csv',
    records: result.records,
    trend: result.trend,
    leadAgeBands: result.leadAgeBands,
    anomalies: result.anomalies,
  });
  serverQueryCache.invalidateNamespace(scope.clientId);
  res.json({
    success: true,
    message: `Successfully validated and imported ${result.records.length} CLI performance records.`,
    count: result.records.length,
    anomalies: result.anomalies,
  });
}));

analyticsRouter.post('/cli-performance/load-sample', requireAdmin, asyncRoute(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw new RequestError('Benchmark CLI sample data is disabled in production', 403);
  }
  const scope = res.locals.scope;
  const sample = generateBenchmarkCliDataset();
  setTenantImport(scope.clientId, {
    uploadedAt: new Date().toISOString(),
    filename: 'benchmark_dialler_cli_sample.csv',
    records: sample.records,
    trend: sample.trend,
    leadAgeBands: sample.leadAgeBands,
    anomalies: sample.anomalies,
  });
  serverQueryCache.invalidateNamespace(scope.clientId);
  res.json({
    success: true,
    message: 'Loaded standard benchmark VICIdial CLI performance dataset.',
    count: sample.records.length,
  });
}));

analyticsRouter.delete('/cli-performance/import', requireAdmin, asyncRoute(async (req, res) => {
  const scope = res.locals.scope;
  clearTenantImport(scope.clientId);
  serverQueryCache.invalidateNamespace(scope.clientId);
  res.json({ success: true, message: 'Cleared imported CLI performance data.' });
}));
