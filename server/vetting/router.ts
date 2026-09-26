import { Router, type Request, type Response, type NextFunction } from 'express';
import { compileVetting, vettingScope } from './query';
import { sourceAccess } from '../bigquery/sourceAccess';
import { sourceTable } from '../bigquery/sourceCatalog';

export function createVettingRouter() {
  const router = Router();

  router.get('/vetting', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = res.locals.scope;
      const access = sourceAccess(scope.clientId);
      const table = sourceTable(scope.clientId, 'leads');
      if (!table) {
        return res.json({ success: true, data: null });
      }
      const meta = await access.metadata(table);
      const compiled = compileVetting(scope, meta);
      const result = await access.execute({ query: compiled.query, params: compiled.params });
      res.json({
        success: true,
        data: result.rows[0] || null,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
