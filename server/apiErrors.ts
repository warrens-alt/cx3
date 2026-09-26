import type { Request, Response, NextFunction } from 'express';
import { RequestError } from './bigquery/filters';

export function apiErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }
  const status = err instanceof RequestError || (typeof err?.status === 'number' && err.status >= 400 && err.status < 600)
    ? err.status
    : (typeof err?.code === 'number' && err.code >= 400 && err.code < 600 ? err.code : 500);

  const message = err?.message || 'Internal Server Error';
  res.status(status).json({
    success: false,
    error: message,
    status,
    requestId: res.locals?.requestId,
  });
}
