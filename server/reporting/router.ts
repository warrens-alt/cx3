import { analyticalRoute } from '../analyticalWork';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { BigQueryReportRepository } from './repository';
import { RequestError } from '../bigquery/filters';
import { exceptionCatalogue } from '../../contracts/operations';
import { requireTenant } from '../securityPolicy';
import { executeReport, reportingPrincipal } from './service';
import { allowedKeys, reportIdentity } from './scope';
import { REPORT_DEFINITION_HASH } from './fingerprint';
import { METRIC_VERSION, MODEL_VERSION } from '../../contracts/reporting';
import { attachReplayToken, replayConfigured, replayReport } from './replay';

export function createReportingRouter(repoFactory?: (() => BigQueryReportRepository) | BigQueryReportRepository | any) {
  const router = Router();
  const getRepo = typeof repoFactory === 'function' ? repoFactory : repoFactory ? (() => repoFactory) : (() => new BigQueryReportRepository());

  const tenantFor = (req: Request, res: Response, explicit?: unknown) => {
    const principal = reportingPrincipal(res.locals.principal);
    const candidate = reportIdentity(explicit, 'tenantId');
    requireTenant(principal, candidate);
    return candidate;
  };

  router.get('/catalogue', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = getRepo();
      allowedKeys(req.query, ['tenantId', 'releaseId'], 'catalogue');
      const tenant = tenantFor(req, res, req.query.tenantId);
      const releaseId = req.query.releaseId === undefined ? undefined : reportIdentity(req.query.releaseId, 'releaseId');
      const release = await repo.release(tenant, releaseId);
      res.json({
        success: true,
        data: {
          configured: repo.configured,
          release: release || null,
          status: release ? 'AVAILABLE' : 'NO_APPROVED_RELEASE',
          message: release ? undefined : 'No approved release available',
          execution: {
            status: release?.execution && release.metricVersion === METRIC_VERSION && release.modelVersion === MODEL_VERSION && release.execution.definitionHash === REPORT_DEFINITION_HASH ? 'SUPPORTED' : 'NOT_SUPPORTED',
            definitionHash: REPORT_DEFINITION_HASH,
            reason: release?.execution ? undefined : 'An approved immutable aggregate snapshot execution contract is required.',
          },
          replayConfigured: replayConfigured(),
        },
      });
    } catch (err) {
      next(err);
    }
  }));

  router.get('/exceptions', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = getRepo();
      allowedKeys(req.query, ['tenantId', 'releaseId'], 'exception catalogue');
      const tenant = tenantFor(req, res, req.query.tenantId);
      const releaseId = req.query.releaseId === undefined ? undefined : reportIdentity(req.query.releaseId, 'releaseId');
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
      const result = attachReplayToken(await executeReport(getRepo(), res.locals.principal, req.body));
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }));

  router.post('/replay', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await replayReport(getRepo(), res.locals.principal, req.body);
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }));

  return router;
}
