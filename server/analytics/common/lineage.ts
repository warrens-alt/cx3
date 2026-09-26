import { definitionsForDomain } from '../../../contracts/analyticsLineage';
import { leadSourceEvidence } from '../../../contracts/warehouseSchemaSnapshot';
import { getClientConfig } from '../../bigquery/config';
import type { QueryScope } from '../../bigquery/filters';

export function operationalMetadata(scope: QueryScope, domain: string) {
  const client = getClientConfig(scope.clientId);
  const marketing = ['campaigns', 'marketing-root-cause', 'marketing-attribution'].includes(domain);
  const calls = domain === 'agent-performance';
  const sourceWide = ['marketing-discovery', 'source-observability'].includes(domain);
  return {
    clientId: client.id, clientName: client.name, timezone: client.timezone,
    startDate: sourceWide ? null : scope.startDate ?? null, endDate: sourceWide ? null : scope.endDate ?? null,
    appliedFilters: sourceWide ? {} : scope.filters || {}, validationStatus: 'NOT_VERIFIED',
    dateBasis: sourceWide ? 'all_tenant_owned_source_rows' : domain === 'commercial' ? 'source_specific_see_metric_definitions' : marketing ? 'marketing_reporting_date' : calls ? 'call_event_date' : 'lead_capture_cohort',
    generatedAt: new Date().toISOString(),
    sourceShape: !marketing && !calls && !sourceWide ? leadSourceEvidence(client.semanticMappings.tables.leads) : undefined,
    metricDefinitions: sourceWide ? [] : definitionsForDomain(domain).map(metric => ({ ...metric,
      sourceTable: metric.source === 'marketing_contract' ? client.marketing?.table ?? null : calls ? client.semanticMappings.tables.calls : client.semanticMappings.tables.leads,
    })),
  };
}
