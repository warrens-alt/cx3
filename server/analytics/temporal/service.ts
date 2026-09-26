import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { configuredSourceTable } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';

// 6. TEMPORAL INTELLIGENCE (Day x Hour Heatmaps)
export async function getTemporalAnalytics(params: OffernetQueryParams) {
  const clientConfig = getClientConfig(params.clientId);
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);
  const operating = clientConfig.operationalConfig?.operatingHours || { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };
  queryParams.tenantTimezone = clientConfig.timezone || 'Africa/Johannesburg';
  queryParams.operatingStart = operating.start.length === 5 ? operating.start + ':00' : operating.start;
  queryParams.operatingEnd = operating.end.length === 5 ? operating.end + ':00' : operating.end;
  queryParams.operatingWorkdays = operating.workdays;

  const query = `
    WITH lead_level AS (
      SELECT
        l.lead_id,
        ANY_VALUE(SAFE_CAST(l.fetched AS TIMESTAMP)) AS fetched_ts,
        COUNTIF(SAFE_CAST(hlc.rpc AS INT64) > 0) > 0 AS is_rpc,
        COUNTIF(hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '') > 0 AS is_sale,
        COUNTIF(hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '') > 0 AS is_activated
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
      GROUP BY l.lead_id
    ),
    classified AS (
      SELECT
        *,
        CAST(FORMAT_TIMESTAMP('%u', fetched_ts, @tenantTimezone) AS INT64) AS iso_day,
        CAST(FORMAT_TIMESTAMP('%H', fetched_ts, @tenantTimezone) AS INT64) AS hour_of_day,
        CAST(FORMAT_TIMESTAMP('%u', fetched_ts, @tenantTimezone) AS INT64) NOT IN UNNEST(@operatingWorkdays)
          OR FORMAT_TIMESTAMP('%H:%M:%S', fetched_ts, @tenantTimezone) < @operatingStart
          OR FORMAT_TIMESTAMP('%H:%M:%S', fetched_ts, @tenantTimezone) >= @operatingEnd AS is_after_hours
      FROM lead_level
    ),
    matrix AS (
      SELECT
        iso_day,
        hour_of_day,
        COUNT(*) AS volume,
        COUNTIF(is_rpc) AS contacted,
        COUNTIF(is_sale) AS sales,
        COUNTIF(is_activated) AS activations
      FROM classified
      GROUP BY iso_day, hour_of_day
    ),
    operating_summary AS (
      SELECT
        is_after_hours,
        COUNT(*) AS leads,
        COUNTIF(is_rpc) AS contacted,
        COUNTIF(is_sale) AS sales
      FROM classified
      GROUP BY is_after_hours
    )
    SELECT
      ARRAY(SELECT AS STRUCT * FROM matrix) AS matrix,
      ARRAY(SELECT AS STRUCT * FROM operating_summary) AS operating_summary
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const data = rows[0] || { matrix: [], operating_summary: [] };
  const rowsByCell = data.matrix || [];
  const isoDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const heatmap: any[] = [];

  for (let d = 1; d <= 7; d++) {
    for (let h = 0; h < 24; h++) {
      const match = rowsByCell.find((row: any) => Number(row.iso_day) === d && Number(row.hour_of_day) === h);
      const volume = match ? Number(match.volume || 0) : 0;
      const contacted = match ? Number(match.contacted || 0) : 0;
      const sales = match ? Number(match.sales || 0) : 0;
      const activations = match ? Number(match.activations || 0) : 0;
      heatmap.push({
        dayIndex: d,
        dayName: isoDays[d - 1],
        hour: h,
        volume,
        contactRate: volume > 0 ? Number(((contacted / volume) * 100).toFixed(1)) : 0,
        saleRate: volume > 0 ? Number(((sales / volume) * 100).toFixed(2)) : 0,
        activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0
      });
    }
  }

  const peakWindows = heatmap
    .filter(cell => cell.volume > 0)
    .sort((a, b) => (b.contactRate - a.contactRate) || (b.volume - a.volume))
    .slice(0, 6)
    .map(cell => ({
      window: `${cell.dayName} ${String(cell.hour).padStart(2, '0')}:00–${String((cell.hour + 1) % 24).padStart(2, '0')}:00`,
      contactRate: `${cell.contactRate.toFixed(1)}%`,
      saleIndex: cell.saleRate.toFixed(2),
      verdict: 'Observed high-contact capture window'
    }));

  const operatingComparison = (data.operating_summary || []).map((row: any) => {
    const leads = Number(row.leads || 0);
    const contacted = Number(row.contacted || 0);
    const sales = Number(row.sales || 0);
    return {
      type: row.is_after_hours ? 'Outside configured operating hours' : 'Inside configured operating hours',
      leads,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      saleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
    };
  });

  return {
    heatmap,
    peakWindows,
    operatingComparison,
    operatingContext: {
      timezone: clientConfig.timezone,
      start: operating.start,
      end: operating.end,
      workdays: operating.workdays,
    },
    timeDimension: 'Lead capture time'
  };
}
