import { getClientConfig, tenantVendorScopeValues } from '../../bigquery/config';
import type { OffernetQueryParams } from './types';
import { RequestError } from '../../bigquery/filters';

// Build standard WHERE filter clause for clustered_lead_ledger queries
export function buildFilterClause(params: OffernetQueryParams, alias = 'l', hlcAlias = 'hlc') {
  for (const dimension of ['campaign', 'channel', 'adset', 'agent', 'cli'] as const) {
    if (params[dimension]) throw new RequestError(`UNSUPPORTED_FILTER: ${dimension} has no approved mapping to this lead population.`, 422);
  }
  const conditions: string[] = [
    `${alias}.fetched NOT LIKE '1900%'`,
    `${alias}.fetched NOT LIKE '1970%'`,
    `${alias}.fetched IS NOT NULL`
  ];
  const clientConfig = getClientConfig(params.clientId);
  const queryParams: Record<string, any> = {};

  if (params.startDate) {
    conditions.push(`DATE(SAFE_CAST(${alias}.fetched AS TIMESTAMP), @scopeTimezone) >= @startDate`);
    queryParams.startDate = params.startDate;
    queryParams.scopeTimezone = clientConfig.timezone;
  }
  if (params.endDate) {
    conditions.push(`DATE(SAFE_CAST(${alias}.fetched AS TIMESTAMP), @scopeTimezone) <= @endDate`);
    queryParams.endDate = params.endDate;
    queryParams.scopeTimezone = clientConfig.timezone;
  }

  // Dedicated tenant views are already isolated. Add a tenant-vendor predicate only for shared lead sources.
  if (
    clientConfig.dataSourceMode === 'shared' &&
    clientConfig.id !== 'default_tenant' &&
    clientConfig.id !== 'offernet_master'
  ) {
    const tenantVendors = tenantVendorScopeValues(clientConfig);
    if (!tenantVendors.length) throw new RequestError('No approved vendor mapping exists for this shared tenant source.', 422);
    if (tenantVendors.length > 0) {
      conditions.push(`EXISTS (SELECT 1 FROM UNNEST(${alias}.hlc_details) h WHERE LOWER(h.vendor) IN UNNEST(@tenantVendors))`);
      if (hlcAlias) conditions.push(`LOWER(${hlcAlias}.vendor) IN UNNEST(@tenantVendors)`);
      queryParams.tenantVendors = tenantVendors;
    }
  }

  const cleanVendor = params.vendor && !['all', 'all vendors', 'undefined', 'null'].includes(params.vendor.trim().toLowerCase()) 
    ? params.vendor.trim() 
    : undefined;

  if (cleanVendor) {
    conditions.push(`EXISTS (SELECT 1 FROM UNNEST(${alias}.hlc_details) h WHERE LOWER(h.vendor) = LOWER(@vendor))`);
    if (hlcAlias) {
      conditions.push(`LOWER(${hlcAlias}.vendor) = LOWER(@vendor)`);
    }
    queryParams.vendor = cleanVendor;
  }

  const cleanSource = params.source && !['all', 'all sources', 'undefined', 'null'].includes(params.source.trim().toLowerCase()) 
    ? params.source.trim() 
    : undefined;
  if (cleanSource) {
    conditions.push(`LOWER(${alias}.offershop_source) = LOWER(@source)`);
    queryParams.source = cleanSource;
  }

  const cleanMedium = params.medium && !['all', 'undefined', 'null'].includes(params.medium.trim().toLowerCase()) 
    ? params.medium.trim() 
    : undefined;
  if (cleanMedium) {
    conditions.push(`LOWER(${alias}.offernet_medium) = LOWER(@medium)`);
    queryParams.medium = cleanMedium;
  }

  const cleanGrade = params.grade && !['all', 'all grades', 'undefined', 'null'].includes(params.grade.trim().toLowerCase()) 
    ? params.grade.trim() 
    : undefined;
  if (cleanGrade) {
    conditions.push(`LOWER(${alias}.offershop_grade) = LOWER(@grade)`);
    queryParams.grade = cleanGrade;
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    queryParams
  };
}
