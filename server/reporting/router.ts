import { analyticalRoute } from '../analyticalWork';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { BigQueryReportRepository } from './repository';
import { RequestError } from '../bigquery/filters';
import { exceptionCatalogue } from '../../contracts/operations';
import { requireTenant } from '../securityPolicy';

export function createReportingRouter(repoFactory?: (() => BigQueryReportRepository) | BigQueryReportRepository | any) {
  const router = Router();
  const getRepo = typeof repoFactory === 'function' ? repoFactory : repoFactory ? (() => repoFactory) : (() => new BigQueryReportRepository());

  const tenantFor = (req: Request, res: Response, explicit?: unknown) => {
    const candidate = typeof explicit === 'string' && explicit.trim()
      ? explicit.trim()
      : (res.locals.scope?.clientId || res.locals.principal?.tenants?.[0] || 'default_tenant');
    requireTenant(res.locals.principal, candidate);
    return candidate;
  };

  router.get('/catalogue', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = getRepo();
      const tenant = tenantFor(req, res, req.query.tenantId);
      const release = await repo.release(tenant);
      res.json({
        success: true,
        data: {
          configured: repo.configured,
          release: release || null,
          status: release ? 'AVAILABLE' : 'NO_APPROVED_RELEASE',
          message: release ? undefined : 'No approved release available',
        },
      });
    } catch (err) {
      next(err);
    }
  }));

  router.get('/exceptions', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = getRepo();
      const tenant = tenantFor(req, res, req.query.tenantId);
      const releaseId = req.query.releaseId as string | undefined;
      const release = await repo.release(tenant, releaseId);

      if (release) {
        const rules = exceptionCatalogue(release.sources, release.checks, (release as any).configuration || {});
        return res.json({
          success: true,
          data: {
            available: true,
            releaseId: release.releaseId,
            cutoff: release.cutoff,
            rules,
          },
        });
      }

      return res.json({
        success: true,
        data: {
          available: false,
          reason: 'No approved reporting release available for this tenant',
          releaseId: null,
          cutoff: null,
          rules: [],
        },
      });
    } catch (err) {
      next(err);
    }
  }));

  router.post('/', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = getRepo();
      const tenant = tenantFor(req, res, req.body?.tenantId);
      const release = await repo.release(tenant, req.body?.releaseId);
      if (!release) {
        return res.status(404).json({
          success: false,
          error: 'No approved release available',
          status: 'NO_APPROVED_RELEASE',
        });
      }
      return res.status(501).json({
        success: false,
        error: 'Versioned report execution is not implemented in this repository revision',
        status: 'NOT_IMPLEMENTED',
        releaseId: release.releaseId,
      });
    } catch (err) {
      next(err);
    }
  }));

  router.post('/replay', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      tenantFor(req, res, req.body?.tenantId);
      return res.status(501).json({
        success: false,
        error: 'Evidence replay is not implemented in this repository revision',
        status: 'NOT_IMPLEMENTED',
      });
    } catch (err) {
      next(err);
    }
  }));

  return router;
}
