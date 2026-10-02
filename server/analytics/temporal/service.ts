import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { buildFilterClause } from '../common/scope';
import { percentOrNull } from '../common/metrics';
import { operationalLeadCtes } from '../common/leadMetrics';

// The event bases regroup the selected intake cohort; they never select a new event-date cohort.
export function buildTemporalQuery(params: OffernetQueryParams) {
  const clientConfig = getClientConfig(params.clientId);
  const { queryParams } = buildFilterClause(params);
  const operating = clientConfig.operationalConfig?.operatingHours || { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };
  queryParams.tenantTimezone = clientConfig.timezone || 'Africa/Johannesburg';
  queryParams.operatingStart = operating.start.length === 5 ? operating.start + ':00' : operating.start;
  queryParams.operatingEnd = operating.end.length === 5 ? operating.end + ':00' : operating.end;
  queryParams.operatingWorkdays = operating.workdays;

  const query = `
    WITH ${operationalLeadCtes(params)},
    classified AS (
      SELECT
        *,
        CAST(FORMAT_TIMESTAMP('%u', fetched_ts, @tenantTimezone) AS INT64) AS iso_day,
        CAST(FORMAT_TIMESTAMP('%H', fetched_ts, @tenantTimezone) AS INT64) AS hour_of_day,
        CAST(FORMAT_TIMESTAMP('%u', fetched_ts, @tenantTimezone) AS INT64) NOT IN UNNEST(@operatingWorkdays)
          OR FORMAT_TIMESTAMP('%H:%M:%S', fetched_ts, @tenantTimezone) < @operatingStart
          OR FORMAT_TIMESTAMP('%H:%M:%S', fetched_ts, @tenantTimezone) >= @operatingEnd AS is_after_hours
      FROM operational_leads
    ),
    matrix AS (
      SELECT
        iso_day,
        hour_of_day,
        COUNT(*) AS volume,
        COUNTIF(is_dialled) AS dialled,
        COUNTIF(is_dialled AND is_rpc IS TRUE) AS contacted,
        COUNTIF(is_rpc IS NULL) AS rpc_unknown_leads,
        COUNTIF(is_dialled AND is_rpc IS NULL) AS dialled_rpc_unknown_leads,
        COUNTIF(is_sale) AS sales,
        COUNTIF(is_activated) AS activations
      FROM classified
      GROUP BY iso_day, hour_of_day
    ),
    event_matrix AS (
      SELECT basis, CAST(FORMAT_TIMESTAMP('%u', event_ts, @tenantTimezone) AS INT64) AS iso_day,
        CAST(FORMAT_TIMESTAMP('%H', event_ts, @tenantTimezone) AS INT64) AS hour_of_day,
        COUNT(*) AS volume, COUNTIF(is_dialled) AS dialled, COUNTIF(is_dialled AND is_rpc IS TRUE) AS contacted,
        COUNTIF(is_rpc IS NULL) AS rpc_unknown_leads,
        COUNTIF(is_dialled AND is_rpc IS NULL) AS dialled_rpc_unknown_leads,
        COUNTIF(is_sale) AS sales, COUNTIF(is_activated) AS activations
      FROM operational_leads CROSS JOIN UNNEST([STRUCT('Capture' AS basis, fetched_ts AS event_ts), STRUCT('Delivery', delivered_ts), STRUCT('First dial', first_call_ts)])
      GROUP BY basis, iso_day, hour_of_day
    ),
    operating_summary AS (
      SELECT
        is_after_hours,
        COUNT(*) AS leads,
        COUNTIF(is_dialled) AS dialled,
        COUNTIF(is_dialled AND is_rpc IS TRUE) AS contacted,
        COUNTIF(is_rpc IS NULL) AS rpc_unknown_leads,
        COUNTIF(is_dialled AND is_rpc IS NULL) AS dialled_rpc_unknown_leads,
        COUNTIF(is_sale) AS sales
      FROM classified
      GROUP BY is_after_hours
    )
    SELECT
      ARRAY(SELECT AS STRUCT * FROM matrix) AS matrix,
      ARRAY(SELECT AS STRUCT * FROM event_matrix) AS event_matrix,
      ARRAY(SELECT AS STRUCT * FROM operating_summary) AS operating_summary
  `;

  return { query, queryParams, clientConfig, operating };
}

export async function getTemporalAnalytics(params: OffernetQueryParams) {
  const { query, queryParams, clientConfig, operating } = buildTemporalQuery(params);
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const [rows] = await client.query({ query, params: queryParams });
  if (!rows[0]) throw new Error('Temporal aggregate evidence is unavailable.');
  return buildTemporalResult(rows[0], clientConfig, operating);
}

export function buildTemporalResult(
  data: any,
  clientConfig: { timezone?: string } = {},
  operating: { start: string; end: string; workdays: number[] } = { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] }
) {
  const rowsByCell = data.matrix || [];
  const isoDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const heatmap: any[] = [];

  for (let d = 1; d <= 7; d++) {
    for (let h = 0; h < 24; h++) {
      const match = rowsByCell.find((row: any) => Number(row.iso_day) === d && Number(row.hour_of_day) === h);
      const volume = match ? Number(match.volume || 0) : 0;
      const dialled = match ? match.dialled : 0;
      const sales = match ? Number(match.sales || 0) : 0;
      const activations = match ? Number(match.activations || 0) : 0;
      heatmap.push({
        dayIndex: d,
        dayName: isoDays[d - 1],
        hour: h,
        volume,
        dialled: match ? match.dialled ?? null : 0,
        rpcUnknownLeads: match ? match.rpc_unknown_leads ?? null : 0,
        dialledRpcUnknownLeads: match ? match.dialled_rpc_unknown_leads ?? null : 0,
        contactRate: percentOrNull(match ? match.contacted : 0, dialled, 1),
        saleRate: percentOrNull(sales, volume, 2),
        activationRate: percentOrNull(activations, sales, 1)
      });
    }
  }

  const peakWindows = heatmap
    .filter(cell => cell.volume > 0)
    .sort((a, b) => ((b.contactRate ?? -1) - (a.contactRate ?? -1)) || (b.volume - a.volume))
    .slice(0, 6)
    .map(cell => ({
      window: `${cell.dayName} ${String(cell.hour).padStart(2, '0')}:00–${String((cell.hour + 1) % 24).padStart(2, '0')}:00`,
      contactRate: cell.contactRate !== null ? `${cell.contactRate.toFixed(1)}%` : '—',
      saleIndex: cell.saleRate !== null ? cell.saleRate.toFixed(2) : '—',
      verdict: 'Observed high-contact capture window'
    }));

  const operatingComparison = (data.operating_summary || []).map((row: any) => {
    const leads = Number(row.leads || 0);
    const dialled = row.dialled;
    const contacted = Number(row.contacted || 0);
    const sales = Number(row.sales || 0);
    const type = row.is_after_hours === null || row.is_after_hours === undefined
      ? 'Unrecorded capture time'
      : row.is_after_hours
        ? 'Outside configured operating hours'
        : 'Inside configured operating hours';
    return {
      type,
      leads,
      contactRate: percentOrNull(contacted, dialled, 1),
      saleRate: percentOrNull(sales, leads, 2),
    };
  });

  const evidenceRows = (data.event_matrix || []) as any[];
  const mapBucket = (label: string, evidence: any[]) => {
    const sum = (key: string) => evidence.reduce((total, r) => total + Number(r[key] || 0), 0);
    const volume = sum('volume'), rpc = sum('contacted'), sales = sum('sales'), activations = sum('activations');
    const completeSum = (key: string) => evidence.some(r => r[key] == null) ? null : sum(key);
    return { label, volume, rpc, sales, activations, dialled: completeSum('dialled'), rpcUnknownLeads: completeSum('rpc_unknown_leads'), dialledRpcUnknownLeads: completeSum('dialled_rpc_unknown_leads'), contactRate: percentOrNull(completeSum('contacted'), completeSum('dialled')), saleRate: percentOrNull(completeSum('sales'), volume, 2), activationRate: percentOrNull(completeSum('activations'), completeSum('sales')) };
  };
  const timeBases = ['Capture','Delivery','First dial'].map(basis => {
    const observed = evidenceRows.filter(r => r.basis === basis);
    return { basis, cohortLeads: observed.reduce((n, r) => n + Number(r.volume || 0), 0), recordedTimestampLeads: observed.filter(r => r.iso_day != null).reduce((n, r) => n + Number(r.volume || 0), 0), missingTimestampLeads: observed.filter(r => r.iso_day == null).reduce((n,r) => n+Number(r.volume || 0),0),
      heatmap: Array.from({length:168},(_, index) => { const day = Math.floor(index/24)+1, hour = index%24;
        return { ...mapBucket(`${isoDays[day-1]} ${hour}:00`, observed.filter(r => Number(r.iso_day) === day && Number(r.hour_of_day) === hour)), dayIndex:day, dayName:isoDays[day-1], hour }; }),
      byHour: Array.from({length:24},(_,hour) => mapBucket(`${String(hour).padStart(2,'0')}:00`,observed.filter(r => r.hour_of_day != null && Number(r.hour_of_day) === hour))),
      byDay: isoDays.map((day,index) => mapBucket(day,observed.filter(r => Number(r.iso_day) === index+1))),
      weekType: [mapBucket('Weekday',observed.filter(r => Number(r.iso_day) >= 1 && Number(r.iso_day) <= 5)), mapBucket('Weekend',observed.filter(r => Number(r.iso_day) >= 6))],
    };
  });

  return {
    heatmap,
    timeBases,
    methodology: 'All bases use the selected capture cohort, grouped by the recorded event timestamp in tenant timezone. Missing event timestamps are reported separately. RPC rates use positive recorded RPC among chronologically qualified dialled leads / qualified dialled leads; unknown RPC is reported separately. Recorded activation / recorded sale is an independent-population ratio, not linked conversion. These are observed associations by recorded event timestamp, not causal calling recommendations.',
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
