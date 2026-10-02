import type { Request, Response } from 'express';
import { scalarString, boundedInteger, RequestError, type QueryScope } from '../bigquery/filters';
import { operationalFilterValues, canonicalOperationalFilters } from '../offernetScope';
import type { OffernetQueryParams } from './common/types';

/** Translate an authorized request scope into operational and investigation parameters.
 * The router owns authentication, tenant authorization, caching and record access.
 * Conflicting query/body narrowing is rejected rather than broadening the population. */
export function buildOffernetQueryParams(req: Request, res: Response): OffernetQueryParams {
  const scope = res.locals.scope as QueryScope;
  const values = operationalFilterValues(scope.filters, req.path);
  const effectiveFilters = canonicalOperationalFilters(values);
  scope.filters = effectiveFilters;
  const investigationString = (name: string, maxLength?: number) => {
    const queryValue = scalarString(req.query[name], name, maxLength);
    const bodyValue = req.method === 'GET' ? undefined : scalarString(req.body?.[name], name, maxLength);
    if (queryValue !== undefined && bodyValue !== undefined && queryValue !== bodyValue) {
      throw new RequestError(`Conflicting ${name} investigation scope between query and body`, 422);
    }
    return bodyValue ?? queryValue;
  };
  return {
    clientId: scope.clientId,
    startDate: scope.startDate,
    endDate: scope.endDate,
    ...values,
    filters: effectiveFilters,
    search: investigationString('search', 200),
    question: scalarString(req.method === 'GET' ? req.query.question : req.body?.question ?? req.query.question, 'question', 1000),
    drill: investigationString('drill'),
    drillValue: investigationString('drillValue'),
    segmentVendor: investigationString('segmentVendor', 200),
    segmentSource: investigationString('segmentSource', 200),
    segmentGrade: investigationString('segmentGrade', 200),
    segmentLeadAge: investigationString('segmentLeadAge', 100),
    metric: investigationString('metric'),
    limit: boundedInteger(req.query.limit, 50, 200, 10),
    offset: boundedInteger(req.query.offset, 0, 100000),
  };
}
