import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, RequestHandler, NextFunction } from 'express';

interface WorkTracker { pending: number; ended: boolean; released: boolean; release: () => void; }
const workContext = new AsyncLocalStorage<WorkTracker>();

function releaseIfIdle(tracker: WorkTracker) {
  if (tracker.ended && tracker.pending === 0 && !tracker.released) {
    tracker.released = true;
    tracker.release();
  }
}

/** A disconnected HTTP response does not imply its warehouse work has stopped. */
export function requestWork(release: () => void) {
  const tracker: WorkTracker = { pending: 0, ended: false, released: false, release };
  return {
    run<T>(work: () => T): T { return workContext.run(tracker, work); },
    end() { tracker.ended = true; releaseIfIdle(tracker); },
  };
}

export async function trackAnalyticalWork<T>(work: () => T | Promise<T>): Promise<T> {
  const tracker = workContext.getStore();
  if (!tracker) return work();
  tracker.pending++;
  try { return await work(); }
  finally { tracker.pending--; releaseIfIdle(tracker); }
}

export function analyticalRoute(handler: (req: Request, res: Response, next: NextFunction) => unknown | Promise<unknown>): RequestHandler {
  return (req, res, next) => { void trackAnalyticalWork(() => handler(req, res, next)).catch(next); };
}
