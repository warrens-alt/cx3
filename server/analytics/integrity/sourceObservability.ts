import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig, tenantVendorScopeValues } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { safeWarehouseColumn } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';
import { marketingTenantFilter } from '../common/marketing';

export async function getSourceObservability(params: Pick<OffernetQueryParams, 'clientId'>) {
  const clientConfig = getClientConfig(params.clientId);
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const sources: Array<{
    key: string;
    label: string;
    status: string;
    table: string | null;
    latestRecordAt: string | null;
    ageHours: number | null;
    rowCount: number | null;
    detail: string;
  }> = [];

  const pushFreshness = async (
    key: string,
    label: string,
    table: string | undefined,
    timestampExpression: string,
    whereSql = '',
    queryParams: Record<string, any> = {},
    tableAlias = '',
  ) => {
    if (!table) {
      sources.push({ key, label, status: 'UNAVAILABLE', table: null, latestRecordAt: null, ageHours: null, rowCount: null, detail: 'No source table is configured.' });
      return;
    }
    try {
      const [rows] = await client.query({
        query: `
          SELECT
            MAX(${timestampExpression}) AS latest_record_at,
            COUNT(*) AS row_count,
            TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(${timestampExpression}), HOUR) AS age_hours
          FROM \`${table}\` ${tableAlias}
          ${whereSql}
        `,
        params: queryParams,
      });
      const row = rows[0] || {};
      const latest = row.latest_record_at?.value || row.latest_record_at || null;
      const ageHours = row.age_hours === null || row.age_hours === undefined ? null : Number(row.age_hours);
      sources.push({
        key,
        label,
        status: latest ? 'OBSERVED' : 'EMPTY',
        table,
        latestRecordAt: latest ? String(latest) : null,
        ageHours,
        rowCount: Number(row.row_count || 0),
        detail: latest ? 'Freshness is observed directly from the configured source table.' : 'No usable source timestamp was observed.',
      });
    } catch (error) {
      sources.push({
        key,
        label,
        status: 'ERROR',
        table,
        latestRecordAt: null,
        ageHours: null,
        rowCount: null,
        detail: error instanceof Error ? error.message : 'Source freshness query failed.',
      });
    }
  };

  const leadScope = buildFilterClause({ clientId: params.clientId }, 'l', '');
  await pushFreshness(
    'leads',
    'Lead ledger',
    clientConfig.semanticMappings.tables.leads,
    'SAFE_CAST(l.fetched AS TIMESTAMP)',
    leadScope.whereSql,
    leadScope.queryParams,
    'l',
  );

  const callTable = clientConfig.semanticMappings.tables.calls;
  const callConditions = ["call_start_date IS NOT NULL"];
  const callParams: Record<string, any> = {};
  if (clientConfig.id !== 'default_tenant') {
    const tenantVendors = tenantVendorScopeValues(clientConfig);
    if (tenantVendors.length) {
      callConditions.push('LOWER(vendor) IN UNNEST(@tenantVendors)');
      callParams.tenantVendors = tenantVendors;
    }
  }
  await pushFreshness(
    'calls',
    'Dialler calls',
    callTable,
    'SAFE_CAST(call_start_date AS TIMESTAMP)',
    `WHERE ${callConditions.join(' AND ')}`,
    callParams,
  );

  const contract = clientConfig.marketing;
  if (!contract || !clientConfig.capabilities.marketing) {
    sources.push({
      key: 'marketing',
      label: 'Marketing API',
      status: 'UNAVAILABLE',
      table: contract?.table || null,
      latestRecordAt: null,
      ageHours: null,
      rowCount: null,
      detail: 'No marketing API-table contract is configured for this tenant.',
    });
  } else if (contract.mappingStatus === 'UNRESOLVED' || (contract.mappingStatus === 'MAPPED' && !contract.clientNames.length)) {
    sources.push({
      key: 'marketing',
      label: 'Marketing API',
      status: 'MAPPING_REQUIRED',
      table: contract.table,
      latestRecordAt: null,
      ageHours: null,
      rowCount: null,
      detail: 'Source exists, but tenant client_name mapping is not approved.',
    });
  } else {
    const tenantFilter = marketingTenantFilter(contract);
    const marketingConditions = tenantFilter.sql ? `WHERE ${tenantFilter.sql}` : '';
    await pushFreshness(
      'marketing',
      'Marketing API',
      contract.table,
      `SAFE_CAST(${safeWarehouseColumn(contract.dateField)} AS TIMESTAMP)`,
      marketingConditions,
      tenantFilter.params,
    );
  }

  if (clientConfig.semanticMappings.tables.activations) {
    await pushFreshness(
      'activations',
      'Activation source',
      clientConfig.semanticMappings.tables.activations,
      'SAFE_CAST(date_created AS TIMESTAMP)',
    );
  } else {
    sources.push({
      key: 'activations',
      label: 'Activation source',
      status: 'UNAVAILABLE',
      table: null,
      latestRecordAt: null,
      ageHours: null,
      rowCount: null,
      detail: 'No separate activation lifecycle table is contracted for this tenant; nested operational activation timestamps remain the available source.',
    });
  }

  sources.push({
    key: 'diallerRealtime',
    label: 'VICIdial real-time / hopper API',
    status: 'UNCONFIGURED',
    table: null,
    latestRecordAt: null,
    ageHours: null,
    rowCount: null,
    detail: 'Required for live agent states, hopper priority/levels, dial level, drop rate and hopper-reset events. Historical BigQuery call rows do not provide this live control-plane state.',
  });

  sources.push({
    key: 'activationLifecycle',
    label: 'BLC Rubix / activation lifecycle contract',
    status: 'CONTRACT_REQUIRED',
    table: clientConfig.semanticMappings.tables.activations || null,
    latestRecordAt: null,
    ageHours: null,
    rowCount: null,
    detail: 'Contract ID, Rubix status, activation status, activation timestamp and deal/color need a reconciled record-level source contract before CX3 treats lifecycle stages as canonical.',
  });

  return {
    status: 'OBSERVED',
    generatedAt: new Date().toISOString(),
    sources,
  };
}
