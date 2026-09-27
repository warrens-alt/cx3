import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { safeWarehouseColumn } from '../common/warehouse';
import { resolveMarketingContract } from '../common/marketing';

export async function getMarketingSourceDiscovery(params: Pick<OffernetQueryParams, 'clientId'>) {
  const clientConfig = getClientConfig(params.clientId);
  const contract = clientConfig.marketing;
  if (!contract || !clientConfig.capabilities.marketing) {
    return {
      status: 'UNAVAILABLE',
      reason: 'No marketing contract is configured for this tenant.',
      contract: null,
      schema: null,
      availableClientNames: [],
    };
  }

  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const resolved = await resolveMarketingContract(client, contract);
  const clientNameField = safeWarehouseColumn(contract.clientNameField);
  const dateField = safeWarehouseColumn(contract.dateField);
  let nameRows: any[] = [];
  if (!resolved.missingRequired.includes(contract.clientNameField) && !resolved.missingRequired.includes(contract.dateField)) {
    try {
      const [rows] = await client.query({
        query: `
          SELECT
            CAST(${clientNameField} AS STRING) AS client_name,
            COUNT(*) AS row_count,
            MIN(DATE(${dateField})) AS earliest_date,
            MAX(DATE(${dateField})) AS latest_date
          FROM \`${contract.table}\`
          WHERE ${clientNameField} IS NOT NULL
          GROUP BY 1
          ORDER BY row_count DESC
          LIMIT 200
        `,
      });
      nameRows = rows || [];
    } catch {
      nameRows = [];
    }
  }

  return {
    status: resolved.missingRequired.length ? 'INVALID_CONTRACT' : contract.mappingStatus,
    reason: resolved.missingRequired.length
      ? `Configured marketing fields are missing from the API table: ${resolved.missingRequired.join(', ')}`
      : contract.mappingStatus === 'UNRESOLVED'
        ? 'Choose and configure the approved client_name values for this tenant before tenant-level campaign reporting is enabled.'
        : 'Marketing API-table contract is structurally valid.',
    contract: {
      table: contract.table,
      mappingStatus: contract.mappingStatus,
      configuredClientNames: contract.clientNames,
      fields: {
        clientName: contract.clientNameField,
        date: contract.dateField,
        channel: contract.channelField,
        campaign: contract.campaignField,
        adset: contract.adsetField,
        impressions: contract.impressionsField,
        reach: contract.reachField || null,
        clicks: contract.clicksField,
        outboundClicks: contract.outboundClicksField || null,
        leads: contract.leadsField,
      },
      approvedSpendFields: contract.approvedSpendFields,
      resolvedSpendField: resolved.spendColumn,
      resolvedBudgetField: resolved.budgetColumn,
      attribution: contract.attribution,
    },
    schema: {
      columns: resolved.columns,
      missingRequired: resolved.missingRequired,
    },
    availableClientNames: nameRows.map((row: any) => ({
      value: row.client_name,
      rows: Number(row.row_count ?? row.rows ?? 0),
      earliestDate: row.earliest_date?.value || row.earliest_date || null,
      latestDate: row.latest_date?.value || row.latest_date || null,
    })),
  };
}
