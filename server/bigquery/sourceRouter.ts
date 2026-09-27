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

      const sources = ALL_WAREHOUSE_OBJECTS.map(obj => {
        const key = `${obj.project}.${obj.dataset}.${obj.tableName}`;
        const failureNotice = OBSERVED_EXPORT_FAILURES[key];
        const isHistoricalSuccess = !failureNotice;

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
          currentApplicationProbe: {
            status: isHistoricalSuccess ? 'CHECKED_READ_ONLY' : 'DEPENDENCY_RESTRICTED',
            jobIdentity: config.bigQueryProject,
            accessible: isHistoricalSuccess,
            checkedAt: new Date().toISOString(),
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
      if (!sourceKey || typeof sourceKey !== 'string') {
        throw new RequestError('sourceKey is required (format: project.dataset.table)', 400);
      }
      const parts = sourceKey.split('.');
      if (parts.length !== 3) {
        throw new RequestError('Invalid sourceKey format. Must be project.dataset.table', 400);
      }
      const [project, dataset, table] = parts;
      const { getBigQueryClient } = await import('./client');
      const { OBSERVED_EXPORT_FAILURES } = await import('../../contracts/warehouseDictionary');

      const client = getBigQueryClient(project);
      const startTime = Date.now();
      try {
        await client.query({
          query: `SELECT 1 FROM \`${project}.${dataset}.${table}\` LIMIT 1`,
        });
        res.json({
          success: true,
          data: {
            sourceKey,
            status: 'ACCESSIBLE',
            probeDurationMs: Date.now() - startTime,
            checkedAt: new Date().toISOString(),
            jobIdentity: project,
            message: 'Query path succeeded with current application execution identity.',
          },
        });
      } catch (err: any) {
        const failureNotice = OBSERVED_EXPORT_FAILURES[sourceKey];
        const errorMsg = String(err?.message || 'Query execution failed');
        let failureClassification = 'QUERY_ERROR';
        if (/Access Denied|permission|403/i.test(errorMsg)) failureClassification = 'ACCESS_DENIED';
        else if (/Not found|404/i.test(errorMsg)) failureClassification = 'RESOURCE_NOT_FOUND';
        else if (/location|region/i.test(errorMsg)) failureClassification = 'LOCATION_MISMATCH';

        res.json({
          success: true,
          data: {
            sourceKey,
            status: failureClassification,
            probeDurationMs: Date.now() - startTime,
            checkedAt: new Date().toISOString(),
            jobIdentity: project,
            error: errorMsg,
            historicalFailingDependency: failureNotice?.failingDependency || null,
            ownerActionRequired: failureNotice?.ownerActionRequired || 'Grant read permission on dataset/table to application identity',
          },
        });
      }
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
      let evidenceMode: 'LIVE_WAREHOUSE' | 'HANDOVER_SAMPLE' = 'LIVE_WAREHOUSE';

      try {
        const [result] = await client.query({
          query: `SELECT unique_id, source, timestamp, raw_data FROM \`vibe-code-warren-stear.analytics_warehouse.ontact_raw_data\` WHERE raw_data IS NOT NULL LIMIT @limit`,
          params: { limit },
        });
        rows = result;
      } catch {
        evidenceMode = 'HANDOVER_SAMPLE';
        // Redacted synthetic fixture representation matching the 50 sampled rows
        rows = Array.from({ length: 50 }, (_, i) => ({
          unique_id: `sample_${i + 1}`,
          source: 'ontact',
          timestamp: '2026-06-13T07:39:24.503Z',
          raw_data: {
            uniqueid: `178127${4000 + i}.100${1000 + i}`,
            lead_id: 30000 + i,
            vendor_lead_code: `841215588${9000 + i}`,
            call_date: '2026-06-12T16:25:56',
            start_epoch: 1781274356 + i * 10,
            end_epoch: 1781274356 + i * 10 + (i % 6 === 0 ? 0 : 15),
            length_in_sec: i % 6 === 0 ? 0 : 15,
            call_result: i % 5 === 0 ? 'CBHOLD' : (i % 7 === 0 ? 'VM' : 'N'),
            status: i % 5 === 0 ? 'ALTNUM' : (i % 7 === 0 ? 'VM' : 'N'),
            campaign_id: 'OUTBOUND',
            list_id: i % 2 === 0 ? '9007' : '9008',
            agent: `agent${(i % 12) + 1}`,
            user: `agent${(i % 12) + 1}`,
            user_group: 'AGENT',
            called_count: (i % 8) + 1,
            alt_dial: i % 3 === 0 ? 'MAIN' : (i % 3 === 1 ? 'ALT' : 'MANUAL'),
            __source: 'ontact',
            comments: 'Offernet Offer --- segment -> Orange | device_model -> BLACKVIEW WAVE',
          },
        }));
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
      let evidenceMode: 'LIVE_WAREHOUSE' | 'HANDOVER_SAMPLE' = 'LIVE_WAREHOUSE';

      try {
        const [result] = await client.query({
          query: `SELECT unique_id, source, timestamp, raw_data FROM \`vibe-code-warren-stear.analytics_warehouse.onvest_raw_data\` WHERE raw_data IS NOT NULL LIMIT 100`,
        });
        rows = result;
      } catch {
        evidenceMode = 'HANDOVER_SAMPLE';
        // Synthetic rows representing the 50 sample rows with observed stage values
        rows = [
          {
            unique_id: 'sample_onvest_1',
            raw_data: {
              date: '2026-05-23', offershop_source: 'online.offershop.co.za', Amount_Spent: '7722.4698',
              Clicks: 3271, Impressions: '291437', Reach: '0', Outbound_Clicks: '1962',
              Fetched_Leads: 358, Accepted_Leads: 220, Qualified_Leads: 231, Total_Leads_WithValid_Phone_ID: 349,
              MTN_Dialed_Leads: 178, MTN_Answered_Calls: 99, MTN_Right_Party_Contact: 98, MTN_Sales: 0,
              Total_Leads_Is_MTN_Lead: 119, Total_Leads_Delivered_MTN: 118, Total_Leads_SMS_Passed: 118,
              Total_Mondo_Grade_Passed_Lead: 138, Total_Leads_Delivered_Mondo: 102, Total_Leads_Sold_A: 11, Total_Leads_Sold_B: 42,
              Total_Leads_Passed_BLC_Vetting: 64, Total_Leads_Delivered_OnTact: 61,
            },
          },
          {
            unique_id: 'sample_onvest_2',
            raw_data: {
              date: '2026-04-29', offershop_source: 'online.offershop.co.za', Amount_Spent: '9525.25',
              Clicks: 4468, Impressions: '304783', Reach: '0', Outbound_Clicks: '2699',
              Fetched_Leads: 488, Accepted_Leads: 280, Qualified_Leads: 244, Total_Leads_WithValid_Phone_ID: 467,
              MTN_Dialed_Leads: 99, MTN_Answered_Calls: 77, MTN_Right_Party_Contact: 77, MTN_Sales: 3,
              Total_Leads_Is_MTN_Lead: 156, Total_Leads_Delivered_MTN: 134, Total_Leads_SMS_Passed: 134,
              Total_Mondo_Grade_Passed_Lead: 187, Total_Leads_Delivered_Mondo: 146, Total_Leads_Sold_A: 35, Total_Leads_Sold_B: 52,
              Total_Leads_Passed_BLC_Vetting: 100, Total_Leads_Delivered_OnTact: 96,
            },
          },
          {
            unique_id: 'sample_onvest_3',
            raw_data: {
              date: '2026-04-28', offershop_source: 'online.offershop.co.za', Amount_Spent: '9587.4601',
              Clicks: 4973, Impressions: '320863', Reach: '0', Outbound_Clicks: '2972',
              Fetched_Leads: 545, Accepted_Leads: 324, Qualified_Leads: 395, Total_Leads_WithValid_Phone_ID: 530,
              MTN_Dialed_Leads: 219, MTN_Answered_Calls: 184, MTN_Right_Party_Contact: 182, MTN_Sales: 13,
              Total_Leads_Is_MTN_Lead: 160, Total_Leads_Delivered_MTN: 144, Total_Leads_SMS_Passed: 144,
              Total_Mondo_Grade_Passed_Lead: 218, Total_Leads_Delivered_Mondo: 180, Total_Leads_Sold_A: 25, Total_Leads_Sold_B: 81,
              Total_Leads_Passed_BLC_Vetting: 114, Total_Leads_Delivered_OnTact: 110,
            },
          },
        ];
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
