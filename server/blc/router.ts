import { Router } from 'express';
import { BLC_SOURCES, BLC_REPORT_VERSION } from '../../contracts/blcReporting';
import { RequestError, type QueryScope } from '../bigquery/filters';
import { getClientConfig } from '../bigquery/config';
import { activationSourceIsOwned } from '../bigquery/sourceTenantScope';
import { sourceAccess, type SourceAccess } from '../bigquery/sourceAccess';
import { analyticalRoute } from '../analyticalWork';
import { getBlcReport, validateBlcRequest } from './report';
import { createRubixPowerBiRouter } from './powerbi/router';

/** Mounted after the existing authenticated analytics scope middleware. GET only. */
export function createBlcRouter(accessProvider: (clientId: string) => SourceAccess = sourceAccess) {
  const router = Router();
  router.use('/blc/powerbi', createRubixPowerBiRouter());
  router.use('/blc', (_req, res, next) => {
    try {
      const principal = res.locals.principal;
      if (!principal) throw new RequestError('Authentication required', 401);
      const scope = res.locals.scope as QueryScope | undefined;
      if (!scope) throw new RequestError('Validated analytics scope required', 400);
      const client = getClientConfig(scope.clientId);
      if (!principal.tenants?.includes(client.id) || !activationSourceIsOwned(client.id)) throw new RequestError('BLC workspace access denied', 403);
      res.setHeader('Cache-Control', 'private, no-store');
      next();
    } catch (error) { next(error); }
  });
  router.get('/blc/catalogue', (_req, res) => res.json({ success: true, data: {
    version: BLC_REPORT_VERSION, readOnly: true, sources: Object.values(BLC_SOURCES),
    scope: 'Recorded schema definitions; not a live availability check.',
  } }));
  router.get('/blc/report', analyticalRoute(async (req, res) => {
    const input = validateBlcRequest(res.locals.scope, req.query.sourceId || 'journey');
    const data = await getBlcReport(input.scope, input.sourceId, accessProvider(input.scope.clientId));
    // Record-level values never leave this route. Job identifiers are administrative evidence.
    res.json({ success: true, data: { ...data, queryEvidence: res.locals.principal.role === 'admin' ? data.queryEvidence : null } });
  }));
  return router;
}
