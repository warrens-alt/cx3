import { Router, type Request, type RequestHandler } from 'express';
import { parseSavedInvestigationDraft } from '../../contracts/savedAnalysis';
import { RequestError } from '../bigquery/filters';
import { requireTenant, type Principal } from '../securityPolicy';
import { configuredSavedInvestigationBackend } from './gcs';
import {
  DurableSavedInvestigationRepository, MAX_SAVED_INVESTIGATIONS, SavedAnalysisError,
  savedInvestigationObjectName, validateSavedInvestigationId, validateSavedInvestigationQuery, type SavedInvestigationBackend,
} from './repository';

function scalar(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value || value.length > 256 || /[\x00-\x1f\x7f]/.test(value)) throw new RequestError(`A single ${name} value is required.`);
  return value;
}
function requestFields(req: Request, method: string): { tenantId: string; revision?: number } {
  const queryKeys = method === 'DELETE' ? ['clientId', 'revision'] : ['clientId'];
  if (Object.keys(req.query).some(key => !queryKeys.includes(key))) throw new RequestError('Unsupported saved-investigation query field.', 422);
  const bodyKeys = method === 'POST' ? ['clientId', 'definition'] : method === 'PUT' ? ['clientId', 'definition', 'revision'] : [];
  if (req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
    || Object.keys(req.body).some(key => !bodyKeys.includes(key)))) throw new RequestError('Unsupported saved-investigation request body.', 422);
  const queryTenant = scalar(req.query.clientId, 'clientId');
  const bodyTenant = scalar(req.body?.clientId, 'clientId');
  if (queryTenant !== undefined && bodyTenant !== undefined && queryTenant !== bodyTenant) throw new RequestError('Conflicting workspace selections.', 422);
  const tenantId = queryTenant || bodyTenant;
  if (!tenantId || !/^[a-zA-Z0-9_-]{1,80}$/.test(tenantId)) throw new RequestError('An explicit valid clientId is required.');
  const headerTenant = scalar(req.get('X-Client-Id'), 'X-Client-Id');
  if (headerTenant !== undefined && headerTenant !== tenantId) throw new RequestError('Conflicting workspace selections in X-Client-Id and request.', 422);
  if (method !== 'PUT' && method !== 'DELETE') return { tenantId };
  const raw = method === 'DELETE' ? scalar(req.query.revision, 'revision') : req.body?.revision;
  if ((method === 'DELETE' && (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)))
    || (method === 'PUT' && typeof raw !== 'number')) throw new RequestError('A positive saved-investigation revision is required.');
  const revision = Number(raw);
  if (!Number.isSafeInteger(revision) || revision < 1) throw new RequestError('A positive saved-investigation revision is required.');
  return { tenantId, revision };
}

export function createSavedInvestigationRouter(resolveBackend: () => SavedInvestigationBackend | null = configuredSavedInvestigationBackend): Router {
  const router = Router();
  const handle: RequestHandler = (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    void (async () => {
      const principal = res.locals.principal as Principal | undefined;
      if (!principal?.subject) throw new RequestError('Authentication required.', 401);
      const root = req.path === '/';
      const item = /^\/[^/]+\/?$/.test(req.path);
      if (!(root && ['GET', 'POST'].includes(req.method)) && !(item && ['PUT', 'DELETE'].includes(req.method))) {
        res.status(root || item ? 405 : 404).json({ success: false, error: root || item ? 'Method not allowed.' : 'Saved investigation route not found.' });
        return;
      }
      const { tenantId, revision } = requestFields(req, req.method);
      requireTenant(principal, tenantId);
      savedInvestigationObjectName(principal.subject, tenantId);
      let draft;
      if (req.method === 'POST' || req.method === 'PUT') {
        draft = parseSavedInvestigationDraft(req.body?.definition);
        if (draft.scope.tenantId !== tenantId) throw new RequestError('The definition must belong to the selected workspace.', 422);
        validateSavedInvestigationQuery(draft);
      }
      let id: string | undefined;
      if (!root) {
        try { id = decodeURIComponent(req.path.slice(1).replace(/\/$/, '')); } catch { throw new RequestError('Invalid saved-investigation identifier.'); }
        validateSavedInvestigationId(id);
      }
      // Authentication, ownership, tenant and input checks all precede storage configuration and I/O.
      const backend = resolveBackend();
      if (!backend) {
        if (req.method === 'GET') {
          res.json({ success: true, data: { configured: false, definitions: [], limit: MAX_SAVED_INVESTIGATIONS } });
          return;
        }
        throw new SavedAnalysisError('SAVED_STORAGE_NOT_CONFIGURED', 'Persistent saved-investigation storage is not configured. No definition was saved.', 503);
      }
      const repository = new DurableSavedInvestigationRepository(backend);
      if (req.method === 'GET') {
        res.json({ success: true, data: { configured: true, definitions: await repository.list(principal.subject, tenantId), limit: MAX_SAVED_INVESTIGATIONS } });
      } else if (req.method === 'POST') {
        res.status(201).json({ success: true, data: await repository.create(principal.subject, tenantId, draft!) });
      } else if (req.method === 'PUT') {
        res.json({ success: true, data: await repository.update(principal.subject, tenantId, id!, revision!, draft!) });
      } else {
        await repository.remove(principal.subject, tenantId, id!, revision!);
        res.json({ success: true, data: { deleted: true } });
      }
    })().catch(error => {
      if (res.headersSent || res.destroyed) return next(error);
      if (error instanceof SavedAnalysisError) {
        res.status(error.status).json({ success: false, error: error.message, code: error.code });
        return;
      }
      next(error);
    });
  };
  router.get('/', handle);
  router.post('/', handle);
  router.put('/:id', handle);
  router.delete('/:id', handle);
  router.use(handle);
  return router;
}
