import { analyticalRoute } from '../analyticalWork';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { compileVetting, vettingScope } from './query';
import { sourceAccess } from '../bigquery/sourceAccess';
import { sourceTable } from '../bigquery/sourceCatalog';
import { VETTING_VERSION, type VettingReport } from '../../contracts/vetting';

export function createVettingRouter() {
  const router = Router();

  router.get('/vetting', analyticalRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = {
        ...res.locals.scope,
        startDate: (req.query.startDate as string) || res.locals.scope?.startDate,
        endDate: (req.query.endDate as string) || res.locals.scope?.endDate,
        interval: req.query.interval,
        classValue: req.query.classValue,
        colourValue: req.query.colourValue,
      };
      const access = sourceAccess(scope.clientId);
      const table = sourceTable(scope.clientId, 'leads');
      if (!table) {
        return res.json({ success: true, data: null });
      }
      const meta = await access.metadata(table);
      const compiled = compileVetting(scope, meta);
      const result = await access.execute({ query: compiled.query, params: compiled.params });
      const row = result.rows[0];
      if (!row) {
        return res.json({ success: true, data: null });
      }
      const data: VettingReport = {
        current: row.current || { classMeanSeconds: null, colourMeanSeconds: null },
        previous: row.previous || { classMeanSeconds: null, colourMeanSeconds: null },
        groups: row.groups || [],
        diagnostics: row.diagnostics || [],
        timing: row.timing || [],
        fields: compiled.fields,
        scope: {
          ...compiled.scope,
          filters: compiled.scope.filters ?? {},
        },
        evidence: {
          version: VETTING_VERSION,
          table: compiled.table,
          jobId: result.jobId || null,
          referencedTables: result.referencedTables?.length ? result.referencedTables : [compiled.table],
          bytesProcessed: result.bytesProcessed != null ? String(result.bytesProcessed) : null,
          generatedAt: row.generatedAt || new Date().toISOString(),
          snapshotPinned: false,
          validationStatus: 'SOURCE_QUERY_NOT_INDEPENDENTLY_RECONCILED',
        },
        notes: [
          'No snapshot is pinned. The same filters and period definitions apply throughout this response.',
        ],
      };
      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }));

  return router;
}
