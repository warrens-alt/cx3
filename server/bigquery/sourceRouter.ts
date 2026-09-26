import { Router, type Request, type Response, type NextFunction } from 'express';
import { SOURCE_ROLES, type SourceRole } from '../../contracts/sourceCoverage';
import { RequestError, validateScope, validateFilters } from './filters';
import { sourceAccess, type SourceAccess } from './sourceAccess';
import { sourceCatalogue } from './sourceCatalog';
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

  router.get('/source-coverage', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = String(req.query.clientId || 'default_tenant');
      checkAuth(req, res, clientId);
      if (res.locals.principal?.role !== 'admin') {
        throw new RequestError('Admin access required', 403);
      }
      const catalogue = await sourceCatalogue(clientId, getAccess(clientId));
      res.json({ success: true, data: catalogue });
    } catch (err) {
      next(err);
    }
  });

  router.get('/acquisition', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = String(req.query.clientId || 'default_tenant');
      checkAuth(req, res, clientId);
      const scope = validateScope({
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
  });

  router.get('/source-metrics/:role', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.params.role as SourceRole;
      if (!SOURCE_ROLES.includes(role)) {
        throw new RequestError('Unknown source role', 404);
      }
      const clientId = String(req.query.clientId || 'default_tenant');
      checkAuth(req, res, clientId);
      const scope = validateScope({
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
  });

  return router;
}
