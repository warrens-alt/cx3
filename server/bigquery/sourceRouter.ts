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

  return router;
}
