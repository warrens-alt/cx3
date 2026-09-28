import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig, tenantVendorScopeValues } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { safeWarehouseColumn } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';
import { marketingTenantFilter } from '../common/marketing';
import { safeSourceError } from '../../bigquery/sourceAccess';
import { activationSourceIsOwned } from '../../bigquery/sourceTenantScope';
import { getBlcLifecycleDiagnostics, blcLifecycleSourceCards } from '../../blc/lifecycleDiagnostics';
import type { LifecycleSourceCard } from '../../../contracts/blcLifecycle';
import { validTimestampSql } from '../../bigquery/integrity';

export async function getSourceObservability(params: Pick<OffernetQueryParams, 'clientId'>) {
  const clientConfig = getClientConfig(params.clientId);
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const sources: LifecycleSourceCard[] = [];

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
            COUNTIF(${timestampExpression} IS NULL) AS missing_timestamp_rows,
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
        status: latest ? 'OBSERVED' : Number(row.row_count || 0) > 0 ? 'TIMESTAMP_UNAVAILABLE' : 'EMPTY',
        table,
        latestRecordAt: latest ? String(latest) : null,
        ageHours,
        rowCount: Number(row.row_count || 0),
        missingTimestampRows: Number(row.missing_timestamp_rows || 0),
        detail: latest ? `Freshness is observed across all tenant-owned source rows. ${Number(row.missing_timestamp_rows || 0)} rows have missing, invalid or sentinel timestamps; no freshness SLA is assumed.` : 'No usable source timestamp was observed; physical source rows are still counted.',
      });
    } catch (error) {
      const failure = safeSourceError(error);
      sources.push({
        key,
        label,
        status: failure.status,
        table,
        latestRecordAt: null,
        ageHours: null,
        rowCount: null,
        detail: failure.error,
      });
    }
  };

  const leadScope = buildFilterClause({ clientId: params.clientId }, 'l', '');
  // Source observability includes rows that cannot be assigned to a capture cohort.
  leadScope.whereSql = leadScope.whereSql.replace(/l\.fetched NOT LIKE '1900%' AND l\.fetched NOT LIKE '1970%' AND l\.fetched IS NOT NULL/, 'TRUE');
  await pushFreshness(
    'leads',
    'Lead ledger',
    clientConfig.semanticMappings.tables.leads,
    validTimestampSql('l.fetched'),
    leadScope.whereSql,
    leadScope.queryParams,
    'l',
  );

  const callTable = clientConfig.semanticMappings.tables.calls;
  const callConditions = ['TRUE'];
  const callParams: Record<string, any> = {};
  let callOwnershipEstablished = true;
  if (clientConfig.id !== 'default_tenant') {
    const tenantVendors = tenantVendorScopeValues(clientConfig);
    if (tenantVendors.length) {
      callConditions.push('LOWER(TRIM(vendor)) IN UNNEST(@tenantVendors)');
      callParams.tenantVendors = tenantVendors;
    } else {
      callOwnershipEstablished = false;
    }
  }
  if (callOwnershipEstablished) {
    await pushFreshness(
      'calls',
      'Dialler calls',
      callTable,
      validTimestampSql('call_start_date'),
      `WHERE ${callConditions.join(' AND ')}`,
      callParams,
    );
  } else {
    sources.push({
      key: 'calls', label: 'Dialler calls', status: 'MAPPING_REQUIRED', table: callTable || null,
      latestRecordAt: null, ageHours: null, rowCount: null,
      detail: 'Approved vendor ownership mapping is required for this tenant before it can inspect the shared call source.',
    });
  }

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
      validTimestampSql(safeWarehouseColumn(contract.dateField)),
      marketingConditions,
      tenantFilter.params,
    );
  }

  // Configuration alone does not establish ownership. Do not inspect an unowned
  // activation source or expose its identifier, and retain the actionable status.
  // Approved source and lifecycle cards still share one metadata check and read.
  const activationCards: LifecycleSourceCard[] = !activationSourceIsOwned(clientConfig.id) && clientConfig.semanticMappings.tables.activations
    ? [{
      key: 'activations', label: 'Activation source', status: 'MAPPING_REQUIRED', table: null,
      latestRecordAt: null, ageHours: null, rowCount: null,
      detail: 'Approved activation-source ownership mapping is required for this tenant before it can inspect the configured source.',
    }]
    : blcLifecycleSourceCards(await getBlcLifecycleDiagnostics(params.clientId));
  sources.push(activationCards[0]);

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

  if (activationCards[1]) sources.push(activationCards[1]);

  return {
    status: 'OBSERVED',
    generatedAt: new Date().toISOString(),
    sources,
  };
}
