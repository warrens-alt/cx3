import { Router, type Request, type Response, type NextFunction } from 'express';
import { RequestError, type QueryScope } from '../../bigquery/filters';
import { getClientConfig } from '../../bigquery/config';
import { analyticalRoute } from '../../analyticalWork';
import {
  RUBIX_POWERBI_VERSION,
  RUBIX_QUERY_TYPES,
  type RubixQueryType,
  type RubixReportResponse,
} from '../../../contracts/rubixPowerBi';
import {
  RUBIX_CAPABILITIES_LIST,
  RUBIX_SUPPORTED_FILTERS,
  RUBIX_UNSUPPORTED_FILTERS,
} from './queryRegistry';
import { RubixPowerBiService, defaultRubixPowerBiService } from './service';

export function createRubixPowerBiRouter(service: RubixPowerBiService = defaultRubixPowerBiService): Router {
  const router = Router();

  // Tenant and Authorization Guard
  router.use((_req: Request, res: Response, next: NextFunction) => {
    try {
      const principal = res.locals.principal;
      if (!principal) throw new RequestError('Authentication required', 401);

      const scope = res.locals.scope as QueryScope | undefined;
      if (!scope) throw new RequestError('Validated analytics scope required', 400);

      const client = getClientConfig(scope.clientId);
      const isBlc = client.id === 'ontact_blc';
      const isMaster = client.id === 'default_tenant';

      // Tenant authorization check
      const hasTenant = principal.tenants?.some((t: string) => t === client.id || (isBlc && (t === 'blc' || t === 'ontact_blc')) || (isMaster && (t === 'default_tenant' || t === 'master')));
      if (!hasTenant || (!isBlc && !isMaster)) {
        throw new RequestError('Rubix / BLC Power BI workspace access denied', 403);
      }

      res.setHeader('Cache-Control', 'private, no-store');
      next();
    } catch (error) {
      next(error);
    }
  });

  // GET /status
  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: service.getStatus(),
    });
  });

  // GET /capabilities
  router.get('/capabilities', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        version: RUBIX_POWERBI_VERSION,
        provider: 'rubix_powerbi',
        capabilities: RUBIX_CAPABILITIES_LIST,
        supportedFilters: RUBIX_SUPPORTED_FILTERS,
        unsupportedFilters: RUBIX_UNSUPPORTED_FILTERS,
      },
    });
  });

  // GET /report
  router.get('/report', analyticalRoute(async (req: Request, res: Response) => {
    const scope = res.locals.scope as QueryScope;
    const principal = res.locals.principal;
    const queryType = (req.query.queryType as string) || 'activation_over_time';

    if (!RUBIX_QUERY_TYPES.includes(queryType as RubixQueryType)) {
      throw new RequestError(`Invalid queryType: ${queryType}. Allowed: ${RUBIX_QUERY_TYPES.join(', ')}`, 400);
    }

    // Check if unsupported filters are active in global scope
    const unsupportedApplied = detectUnsupportedFilters(scope);
    if (unsupportedApplied.length > 0) {
      const placeholder: RubixReportResponse = {
        metadata: {
          provider: 'rubix_powerbi',
          datasetId: '59cef14d-8dd0-4016-a349-c227162a0fee',
          reportId: 'fe973424-23fd-433a-a81f-0f08416228ef',
          modelId: 598641,
          templateVersion: RUBIX_POWERBI_VERSION,
          queryType: queryType as RubixQueryType,
          metricId: 'rubix.unsupported_filter',
          aggregation: 'CountNonNull',
          requestedScope: {
            clientId: scope.clientId,
            startDate: scope.startDate || '',
            endDate: scope.endDate || '',
          },
          appliedScope: {
            companyFilter: 'ONtact',
            startDate: scope.startDate || '',
            endDate: scope.endDate || '',
          },
          supportedFilters: RUBIX_SUPPORTED_FILTERS,
          unsupportedFilters: RUBIX_UNSUPPORTED_FILTERS,
          eventDateField: 'activation',
          intervalConvention: 'inclusive_calendar_day',
          timezoneStatus: 'source_as_reported_no_shift',
          queriedAt: new Date().toISOString(),
          providerResponseTimestamp: null,
          sourceRefreshedAt: null,
          maxObservedEventDate: null,
          cacheAgeSeconds: 0,
          queryStatus: 'UNSUPPORTED_FILTER',
          completenessStatus: 'UNKNOWN',
          truncation: false,
          warnings: [
            `Global filters [${unsupportedApplied.join(', ')}] are not supported by the upstream Power BI model. Power BI reports operate at team, segment and agent dimensions. Clear these filters to view Power BI observations.`,
          ],
          reconciliationStatus: 'UNSUPPORTED_FILTER',
        },
        summary: {
          totalCount: null,
          rowCount: 0,
          minDate: null,
          maxDate: null,
          distinctTeams: null,
          distinctSegments: null,
          distinctAgents: null,
        },
        rows: [],
      };
      return res.json({ success: true, data: placeholder });
    }

    const startDate = (req.query.startDate as string) || scope.startDate;
    const endDate = (req.query.endDate as string) || scope.endDate;

    const filters = {
      team: req.query.team ? String(req.query.team).trim() : undefined,
      segment: req.query.segment ? String(req.query.segment).trim() : undefined,
      agent: req.query.agent ? String(req.query.agent).trim() : undefined,
    };

    const isAdmin = principal?.role === 'admin';

    const data = await service.executeReport(
      queryType as RubixQueryType,
      { startDate, endDate },
      filters,
      { clientId: scope.clientId, isAdmin, subject: principal?.subject }
    );

    res.json({ success: true, data });
  }));

  // GET /reconciliation
  router.get('/reconciliation', analyticalRoute(async (req: Request, res: Response) => {
    const scope = res.locals.scope as QueryScope;
    const principal = res.locals.principal;
    const startDate = (req.query.startDate as string) || scope.startDate;
    const endDate = (req.query.endDate as string) || scope.endDate;
    const isAdmin = principal?.role === 'admin';

    const data = await service.getReconciliation(
      { startDate, endDate },
      { clientId: scope.clientId, isAdmin, subject: principal?.subject }
    );

    res.json({ success: true, data });
  }));

  return router;
}

function detectUnsupportedFilters(scope: QueryScope): string[] {
  const unsupported: string[] = [];
  const filters = scope.filters || {};
  for (const key of RUBIX_UNSUPPORTED_FILTERS) {
    if (filters[key] !== undefined) {
      unsupported.push(key);
    }
  }
  return unsupported;
}
