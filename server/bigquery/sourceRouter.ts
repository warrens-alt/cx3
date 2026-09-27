import { analyticalRoute } from '../analyticalWork';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { SOURCE_ROLES, type SourceRole } from '../../contracts/sourceCoverage';
import { RequestError, validateScope, validateFilters } from './filters';
import { sourceAccess, type SourceAccess } from './sourceAccess';
import { sourceCatalogue } from './sourceCatalog';
import { getClientConfig } from './config';
import { getSourceMetrics } from './sourceMetrics';

export function createSourceRouter(accessProvider?: () => SourceAccess) {
  const router = Router();

  function checkAuth(req: Request, res: Response, clientId: string) {
    const principal = res.locals.principal;
    if (!principal) {
      throw new RequestError('Authentication required', 401);
    }
    const tenants = principal.tenants || [];
    if (!tenants.includes(clientId)) {
      throw new RequestError('Tenant access denied', 403);
    }
  }

  function getAccess(clientId: string): SourceAccess {
    return accessProvider ? accessProvider() : sourceAccess(clientId);
  }

  router.get('/source-coverage', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = getClientConfig(String(res.locals.scope?.clientId || req.query.clientId || 'default_tenant')).id;
      checkAuth(req, res, clientId);
      if (res.locals.principal?.role !== 'admin') {
        throw new RequestError('Admin access required', 403);
      }
      const catalogue = await sourceCatalogue(clientId, getAccess(clientId));
      res.json({ success: true, data: catalogue });
    } catch (err) {
      next(err);
    }
  }));

  router.get('/acquisition', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = getClientConfig(String(res.locals.scope?.clientId || req.query.clientId || 'default_tenant')).id;
      checkAuth(req, res, clientId);
      const scope = res.locals.scope || validateScope({
        clientId,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        filters: validateFilters(req.query.filters),
      });
      const metrics = await getSourceMetrics('marketing', scope, getAccess(clientId), 'channel');
      res.json({
        success: true,
        data: {
          ...metrics,
          spend: null,
          cpl: null,
          roas: null,
          financialStatus: 'SPEND_AND_ATTRIBUTION_MAPPING_REQUIRED',
        },
      });
    } catch (err) {
      next(err);
    }
  }));

  router.get('/source-metrics/:role', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.params.role as SourceRole;
      if (!SOURCE_ROLES.includes(role)) {
        throw new RequestError('Unknown source role', 404);
      }
      const clientId = getClientConfig(String(res.locals.scope?.clientId || req.query.clientId || 'default_tenant')).id;
      checkAuth(req, res, clientId);
      const scope = res.locals.scope || validateScope({
        clientId,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        filters: validateFilters(req.query.filters),
      });
      const result = await getSourceMetrics(role, scope, getAccess(clientId));
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }));

  router.get('/sources/inventory', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = getClientConfig(String(res.locals.scope?.clientId || req.query.clientId || 'default_tenant')).id;
      checkAuth(req, res, clientId);
      const { ALL_WAREHOUSE_OBJECTS } = await import('./warehouseRegistry');
      const { CANDIDATE_SPEND_SOURCES, RAW_JSON_SOURCES } = await import('../../contracts/warehouseDictionary');

      const datasets = {
        'dashboards-422710.lead_ledger': ALL_WAREHOUSE_OBJECTS.filter(o => o.project === 'dashboards-422710' && o.dataset === 'lead_ledger').length,
        'dashboards-422710.watfall_report': ALL_WAREHOUSE_OBJECTS.filter(o => o.project === 'dashboards-422710' && o.dataset === 'watfall_report').length,
        'dashboards-422710.vibe_coding_data': ALL_WAREHOUSE_OBJECTS.filter(o => o.project === 'dashboards-422710' && o.dataset === 'vibe_coding_data').length,
        'vibe-code-warren-stear.analytics_warehouse': ALL_WAREHOUSE_OBJECTS.filter(o => o.project === 'vibe-code-warren-stear' && o.dataset === 'analytics_warehouse').length,
      };

      const tableTypes = {
        TABLE: ALL_WAREHOUSE_OBJECTS.filter(o => o.tableType === 'TABLE').length,
        VIEW: ALL_WAREHOUSE_OBJECTS.filter(o => o.tableType === 'VIEW').length,
      };

      res.json({
        success: true,
        data: {
          totalObjects: ALL_WAREHOUSE_OBJECTS.length,
          datasetCounts: datasets,
          tableTypeCounts: tableTypes,
          rawJsonSources: RAW_JSON_SOURCES,
          candidateSpendSources: CANDIDATE_SPEND_SOURCES,
          objects: ALL_WAREHOUSE_OBJECTS,
        },
      });
    } catch (err) {
      next(err);
    }
  }));

  router.post('/sources/profile', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = getClientConfig(String(res.locals.scope?.clientId || req.query.clientId || req.body?.clientId || 'default_tenant')).id;
      checkAuth(req, res, clientId);
      if (res.locals.principal?.role !== 'admin') {
        throw new RequestError('Admin access required for source profiling', 403);
      }
      const { sourceId, limit, redactDynamicKeys } = req.body || {};
      if (!sourceId || typeof sourceId !== 'string') {
        throw new RequestError('sourceId is required', 400);
      }
      const { profileRawJsonSource } = await import('../analytics/integrity/rawProfiler');
      const profile = await profileRawJsonSource(sourceId, { limit, redactDynamicKeys });
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }));

  router.get('/sources/mappings', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = getClientConfig(String(res.locals.scope?.clientId || req.query.clientId || 'default_tenant')).id;
      checkAuth(req, res, clientId);
      const { ONTACT_MAPPING_V1, ONVEST_MAPPING_V1 } = await import('../analytics/integrity/rawAdapters');
      const { CANDIDATE_SPEND_SOURCES } = await import('../../contracts/warehouseDictionary');

      res.json({
        success: true,
        data: {
          activeMappings: [ONTACT_MAPPING_V1, ONVEST_MAPPING_V1],
          candidateSpendSources: CANDIDATE_SPEND_SOURCES,
          quarantinePolicy: {
            unresolvedTenantAction: 'QUARANTINE',
            sensitiveFieldPolicy: 'EXCLUDE_OR_REDACT',
            allowCrossTenantAggregation: false,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }));

  router.get('/sources/readiness', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = getClientConfig(String(res.locals.scope?.clientId || req.query.clientId || 'default_tenant')).id;
      checkAuth(req, res, clientId);
      const isAdmin = res.locals.principal?.role === 'admin';
      const config = getClientConfig(clientId);

      const { ALL_WAREHOUSE_OBJECTS } = await import('./warehouseRegistry');
      const { EXPORT_MANIFEST_EVIDENCE, OBSERVED_EXPORT_FAILURES } = await import('../../contracts/warehouseDictionary');
      const { probeService } = await import('./probeService');

      const probeList = await probeService.listProbeRecords(clientId);
      const probeMap = new Map(probeList.map(p => [p.sourceId, p]));

      const sources = ALL_WAREHOUSE_OBJECTS.map(obj => {
        const key = `${obj.project}.${obj.dataset}.${obj.tableName}`;
        const failureNotice = OBSERVED_EXPORT_FAILURES[key];
        const isHistoricalSuccess = !failureNotice;
        const recordedProbe = probeMap.get(key);

        return {
          key,
          project: obj.project,
          dataset: obj.dataset,
          tableName: obj.tableName,
          tableType: obj.tableType,
          family: obj.family,
          disposition: obj.disposition,
          analyticalGrain: obj.analyticalGrain,
          columnsCount: obj.columns.length,
          historicalExport: {
            status: isHistoricalSuccess ? 'SUCCESS' : 'RESTRICTED',
            rowsExported: isHistoricalSuccess ? (obj.tableName === 'tbl_touchpoint_projects' ? 31 : 50) : 0,
            exportedAt: EXPORT_MANIFEST_EVIDENCE.exportedAt,
            failingDependency: isAdmin && failureNotice ? failureNotice.failingDependency : null,
            errorReason: isAdmin && failureNotice ? failureNotice.errorReason : (failureNotice ? 'Source restricted or dependency unavailable in export' : null),
            ownerActionRequired: failureNotice ? failureNotice.ownerActionRequired : 'None (Available in historical export)',
          },
          currentApplicationProbe: recordedProbe
            ? {
                status: recordedProbe.status,
                jobIdentity: isAdmin ? recordedProbe.jobId || recordedProbe.billingProject : recordedProbe.billingProject,
                accessible: recordedProbe.accessible,
                checkedAt: recordedProbe.checkedAt,
                expiresAt: recordedProbe.expiresAt,
                probeDurationMs: recordedProbe.probeDurationMs,
                error: isAdmin ? recordedProbe.rawErrorDetail || recordedProbe.error : recordedProbe.error,
              }
            : {
                status: 'NOT_CHECKED',
                jobIdentity: null,
                accessible: null,
                checkedAt: null,
                expiresAt: null,
                probeDurationMs: null,
                error: null,
              },
        };
      });

      res.json({
        success: true,
        data: {
          manifest: EXPORT_MANIFEST_EVIDENCE,
          jobExecutionIdentity: config.bigQueryProject,
          totalSources: sources.length,
          successfulSources: sources.filter(s => s.historicalExport.status === 'SUCCESS').length,
          restrictedSources: sources.filter(s => s.historicalExport.status === 'RESTRICTED').length,
          probedSourcesCount: probeList.length,
          sources,
        },
      });
    } catch (err) {
      next(err);
    }
  }));

  router.post('/sources/check-readiness', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = getClientConfig(String(res.locals.scope?.clientId || req.query.clientId || req.body?.clientId || 'default_tenant')).id;
      checkAuth(req, res, clientId);
      if (res.locals.principal?.role !== 'admin') {
        throw new RequestError('Admin access required to probe warehouse sources', 403);
      }
      const { sourceKey } = req.body || {};
      const { probeService } = await import('./probeService');
      const { OBSERVED_EXPORT_FAILURES } = await import('../../contracts/warehouseDictionary');

      const record = await probeService.probeSource(sourceKey, clientId, res.locals.principal);
      const failureNotice = OBSERVED_EXPORT_FAILURES[record.sourceId];

      res.json({
        success: true,
        data: {
          sourceKey: record.sourceId,
          status: record.status,
          probeDurationMs: record.probeDurationMs,
          checkedAt: record.checkedAt,
          expiresAt: record.expiresAt,
          jobIdentity: record.jobId || record.billingProject,
          accessible: record.accessible,
          message: record.accessible
            ? 'Query path succeeded with current application execution identity.'
            : (record.error || 'Probe failed'),
          error: record.rawErrorDetail || record.error,
          historicalFailingDependency: failureNotice?.failingDependency || null,
          ownerActionRequired: failureNotice?.ownerActionRequired || (record.accessible ? 'None' : 'Grant read permission on dataset/table to application identity'),
        },
      });
    } catch (err) {
      next(err);
    }
  }));

  router.get('/sources/ontact/summary', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = getClientConfig(String(res.locals.scope?.clientId || req.query.clientId || 'default_tenant')).id;
      checkAuth(req, res, clientId);
      const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 500);

      const { getBigQueryClient } = await import('./client');
      const { validateOntactTiming } = await import('../analytics/integrity/rawAdapters');
      const client = getBigQueryClient('vibe-code-warren-stear');

      let rows: any[] = [];
      const evidenceMode = 'LIVE_WAREHOUSE';

      try {
        const [result] = await client.query({
          query: `SELECT unique_id, source, timestamp, raw_data FROM \`vibe-code-warren-stear.analytics_warehouse.ontact_raw_data\` WHERE raw_data IS NOT NULL LIMIT @limit`,
          params: { limit },
        });
        rows = result;
      } catch (err: any) {
        return res.status(503).json({
          success: false,
          status: 'UNAVAILABLE',
          error: 'Warehouse source vibe-code-warren-stear.analytics_warehouse.ontact_raw_data is unavailable.',
          detail: err?.message || 'Query execution failed',
        });
      }

      let durationVerifiedCount = 0;
      let durationMismatchCount = 0;
      let statusDisagreementCount = 0;
      let totalDurationSec = 0;
      const statusCounts: Record<string, number> = {};
      const callResultCounts: Record<string, number> = {};
      const listCounts: Record<string, number> = {};
      const campaignCounts: Record<string, number> = {};

      for (const row of rows) {
        const payload = typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : (row.raw_data || {});
        const validation = validateOntactTiming(payload);
        if (validation.durationMatchesEpochs) durationVerifiedCount++;
        else durationMismatchCount++;

        if (validation.statusDisagreement) statusDisagreementCount++;

        const dur = validation.reportedDurationSec || 0;
        totalDurationSec += dur;

        const st = validation.status || 'UNKNOWN';
        statusCounts[st] = (statusCounts[st] || 0) + 1;

        const cr = validation.callResult || 'UNKNOWN';
        callResultCounts[cr] = (callResultCounts[cr] || 0) + 1;

        const list = String(payload.list_id || 'UNKNOWN');
        listCounts[list] = (listCounts[list] || 0) + 1;

        const camp = String(payload.campaign_id || 'UNKNOWN');
        campaignCounts[camp] = (campaignCounts[camp] || 0) + 1;
      }

      const totalObservations = rows.length;

      res.json({
        success: true,
        data: {
          source: 'vibe-code-warren-stear.analytics_warehouse.ontact_raw_data',
          evidenceMode,
          totalObservations,
          countingBasis: 'Raw dialler observations. Multiple observations per lead/dialler unique ID exist and are not certified unique calls.',
          averageDurationSec: totalObservations > 0 ? Number((totalDurationSec / totalObservations).toFixed(1)) : 0,
          timingValidation: {
            durationVerifiedCount,
            durationMismatchCount,
            durationVerificationRatePct: totalObservations > 0 ? Number(((durationVerifiedCount / totalObservations) * 100).toFixed(1)) : 0,
            statusDisagreementCount,
            statusDisagreementRatePct: totalObservations > 0 ? Number(((statusDisagreementCount / totalObservations) * 100).toFixed(1)) : 0,
            observedWallClockUtcOffsetHours: 2,
            note: 'In sample, call_date is 2 hours ahead of start_epoch interpreted as UTC (SAST timezone alignment).',
          },
          statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
          callResultBreakdown: Object.entries(callResultCounts).map(([result, count]) => ({ result, count })).sort((a, b) => b.count - a.count),
          listBreakdown: Object.entries(listCounts).map(([listId, count]) => ({ listId, count })).sort((a, b) => b.count - a.count),
          campaignBreakdown: Object.entries(campaignCounts).map(([campaignId, count]) => ({ campaignId, count })),
        },
      });
    } catch (err) {
      next(err);
    }
  }));

  router.get('/sources/onvest/touchpoints', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = getClientConfig(String(res.locals.scope?.clientId || req.query.clientId || 'default_tenant')).id;
      checkAuth(req, res, clientId);

      if (req.query.campaign) {
        throw new RequestError('Campaign filtering is unsupported for aggregate ONvest source; no campaign dimension exists in this schema.', 422);
      }

      const { getBigQueryClient } = await import('./client');
      const { extractOnvestAggregate } = await import('../analytics/integrity/rawAdapters');
      const { addExactDecimals } = await import('../../contracts/exactDecimal');
      const client = getBigQueryClient('vibe-code-warren-stear');

      let rows: any[] = [];
      const evidenceMode = 'LIVE_WAREHOUSE';

      try {
        const [result] = await client.query({
          query: `SELECT unique_id, source, timestamp, raw_data FROM \`vibe-code-warren-stear.analytics_warehouse.onvest_raw_data\` WHERE raw_data IS NOT NULL LIMIT 100`,
        });
        rows = result;
      } catch (err: any) {
        return res.status(503).json({
          success: false,
          status: 'UNAVAILABLE',
          error: 'Warehouse source vibe-code-warren-stear.analytics_warehouse.onvest_raw_data is unavailable.',
          detail: err?.message || 'Query execution failed',
        });
      }

      let totalExactSpend = '0';
      let fetchedSum = 0;
      let acceptedSum = 0;
      let qualifiedSum = 0;
      let totalValidPhoneIdSum = 0;
      const recordsBySource: Record<string, any[]> = {};
      const datesCovered = new Set<string>();

      for (const row of rows) {
        const payload = typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : (row.raw_data || {});
        const extracted = extractOnvestAggregate(payload, clientId);

        if (extracted.amountSpent) {
          totalExactSpend = addExactDecimals(totalExactSpend, extracted.amountSpent);
        }

        fetchedSum += extracted.stageCounts.fetchedLeads || 0;
        acceptedSum += extracted.stageCounts.acceptedLeads || 0;
        qualifiedSum += extracted.stageCounts.qualifiedLeads || 0;
        totalValidPhoneIdSum += extracted.stageCounts.validPhoneId || 0;

        if (extracted.date) datesCovered.add(extracted.date);

        const src = extracted.offershopSource || 'Unknown';
        if (!recordsBySource[src]) recordsBySource[src] = [];
        recordsBySource[src].push(extracted);
      }

      res.json({
        success: true,
        data: {
          source: 'vibe-code-warren-stear.analytics_warehouse.onvest_raw_data',
          evidenceMode,
          clientScopedTenant: clientId,
          totalReportsCount: rows.length,
          datesCoveredCount: datesCovered.size,
          stageComparison: {
            fetchedLeads: fetchedSum,
            qualifiedLeads: qualifiedSum,
            acceptedLeads: acceptedSum,
            validPhoneId: totalValidPhoneIdSum,
            note: 'Aligned independent stage bars. In this source, Qualified and Accepted can exceed Fetched due to different processing cohorts; counts are not artificially clamped into a shrinking funnel.',
          },
          spendDiagnostics: {
            rawAmountSpentSum: totalExactSpend,
            currencyStatus: 'UNAPPROVED',
            spendPolicyNote: 'Reported numeric amount is displayed without certified currency or media spend approval. Budget remains a separate planning value.',
          },
          reachPolicy: 'Reach is reported per row and is non-additive across dates or sources due to audience overlap.',
          sourcesBreakdown: Object.entries(recordsBySource).map(([source, items]) => ({
            source,
            reportsCount: items.length,
            sampleReportDates: items.slice(0, 3).map(i => i.date),
            totalFetched: items.reduce((acc, cur) => acc + (cur.stageCounts.fetchedLeads || 0), 0),
            totalAccepted: items.reduce((acc, cur) => acc + (cur.stageCounts.acceptedLeads || 0), 0),
            totalQualified: items.reduce((acc, cur) => acc + (cur.stageCounts.qualifiedLeads || 0), 0),
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  }));

  return router;
}
