import { compareMetric } from '../../contracts/periodComparison';
import { useMemo, useState } from 'react';
import type { LifecycleDiagnostics, LifecycleSegment } from '../../contracts/lifecycleAnalytics';
import { formatPercent, formatTableCurrency, formatTableNumber } from '../lib/formatters';
import ExportAnalysisButton from './ExportAnalysisButton';
import PaginatedAnalysisTable from './PaginatedAnalysisTable';
import { FunnelWaterfall } from './charts/FunnelWaterfall';
import { RankedMetricChart } from './charts/OperationalVisuals';

const signed = (value: number | null | undefined, suffix = '') => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
const names: Record<string,string> = { fetched:'Fetched', delivered:'Delivered', dialled:'Dialled', rpc:'RPC', sales:'Sales', activations:'Activations', revenue:'Source-recorded revenue', deliveryRate:'Delivery rate', dialRate:'Dial coverage', rpcRate:'RPC / dialled', saleRate:'Lead → sale', activationRate:'Recorded activation / sale' };
export function MatchedPeriodPanel({ data }: { data: LifecycleDiagnostics }) {
  return <section className="cx-command-panel"><header><div><span className="cx-command-section-kicker">Change</span><h2>Matched period comparison</h2><p>{data.period ? `${data.period.current.startDate}–${data.period.current.endDate} vs ${data.period.previous.startDate}–${data.period.previous.endDate} · ${data.period.days} calendar days each` : 'Choose an inclusive date range of up to 366 days to compare the immediately preceding equal-length period.'}</p></div></header>
    {data.period && <div className="cx-performance-table-wrap"><table className="cx-performance-table"><thead><tr><th>Metric</th><th>Current</th><th>Previous</th><th>Change</th><th>Relative change</th></tr></thead><tbody>{Object.entries(data.comparisons).map(([key, row]) => <tr key={key}><th>{names[key] || key}</th><td>{row.kind === 'rate' ? formatPercent(row.current, 2) : formatTableNumber(row.current)}</td><td>{row.kind === 'rate' ? formatPercent(row.previous, 2) : formatTableNumber(row.previous)}</td><td>{signed(row.kind === 'rate' ? row.percentagePointChange : row.absoluteChange, row.kind === 'rate' ? 'pp' : '')}</td><td>{signed(row.percentageChange, '%')}</td></tr>)}</tbody></table></div>}
    <p className="cx-control-note">Capture cohorts have different follow-up maturity. Changes are measured associations; validation remains {data.validationStatus}.</p>
  </section>;
}
export function LifecycleFunnelPanel({ data }: { data: LifecycleDiagnostics }) {
  const funnelSteps = data.transitions.map(transition => ({
    label: `${transition.from} → ${transition.to}`,
    value: transition.converted,
    population: transition.population,
    rate: transition.conversionRate,
    dropoff: transition.lost,
    evidence: transition.status === 'NON_NESTED' ? 'Downstream recorded events also exist outside this qualified transition.' : 'Source-recorded transition evidence; business certification remains unverified.',
  }));

  return <>
    {funnelSteps.length > 0 && <FunnelWaterfall
      title="Qualified lifecycle transitions"
      subtitle={data.largestLeakage ? `Largest measured loss: ${data.largestLeakage.from} → ${data.largestLeakage.to} · ${formatTableNumber(data.largestLeakage.lost)} leads` : 'Each transition retains its own population and intersection.'}
      steps={funnelSteps}
    />}
    <section className="cx-command-panel"><header><div><span className="cx-command-section-kicker">Lifecycle loss</span><h2>Transition evidence</h2><p>{data.largestDeterioration ? `Largest matched-period deterioration: ${data.largestDeterioration.from} → ${data.largestDeterioration.to}, ${signed(data.largestDeterioration.deteriorationPp, 'pp')}.` : 'Exact transition populations remain available below the visual.'}</p></div></header>
      <div className="cx-performance-table-wrap"><table className="cx-performance-table"><thead><tr><th>Transition</th><th>Population</th><th>Qualified transition</th><th>Conversion</th><th>Lost</th><th>Loss</th><th>Prior change</th><th>Evidence</th></tr></thead><tbody>{data.transitions.map(r => <tr key={r.from}><th>{r.from} → {r.to}</th><td>{formatTableNumber(r.population)}</td><td>{formatTableNumber(r.converted)}</td><td>{formatPercent(r.conversionRate)}</td><td>{formatTableNumber(r.lost)}</td><td>{formatPercent(r.lossRate)}</td><td>{signed(r.deteriorationPp, 'pp')}</td><td>{r.status === 'NON_NESTED' ? 'Downstream recorded events also exist outside this qualified transition' : 'Observed'}</td></tr>)}</tbody></table></div>
    </section>
  </>;
}

type SegmentMetric = 'fetched' | 'delivered' | 'dialled' | 'rpc' | 'sales' | 'activations' | 'deliveryRate' | 'dialRate' | 'rpcRate' | 'saleRate' | 'activationRate';
type SegmentSort = 'fetched' | 'saleRate' | 'activationRate' | 'rpcRate';
const comparisonMetrics: SegmentMetric[] = ['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activations', 'deliveryRate', 'dialRate', 'rpcRate', 'saleRate', 'activationRate'];
const emptySegments: LifecycleSegment[] = [];

export function LifecycleSegmentsPanel({ data, initialDimension = 'vendor' }: { data: LifecycleDiagnostics; initialDimension?: string }) {
  const [dimension, setDimension] = useState(initialDimension);
  const [comparisonMetric, setComparisonMetric] = useState<SegmentMetric>('saleRate');
  const [sort, setSort] = useState<SegmentSort>('fetched');
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase();
  const segments = data.segments[dimension] || emptySegments;
  const priorSegments = data.priorSegments[dimension] || emptySegments;
  const rows = useMemo(() => [...segments].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1) || a.key.localeCompare(b.key)), [segments, sort]);
  const previous = useMemo(() => new Map(priorSegments.map(row => [row.key, row])), [priorSegments]);
  const visibleSegments = useMemo(() => rows.filter(row => row.key.toLocaleLowerCase().includes(query)), [rows, query]);
  const contribution = data.rateContributions?.[comparisonMetric]?.[dimension];
  const visibleContributions = useMemo(() => (contribution?.contributions || []).filter(row => row.key.toLocaleLowerCase().includes(query)), [contribution, query]);
  const comparisonRows = useMemo(() => {
    const current = new Map(rows.map(row => [row.key, row]));
    const kind = comparisonMetric.endsWith('Rate') ? 'rate' : 'count';
    return [...new Set([...current.keys(), ...previous.keys()])]
      .filter(key => key.toLocaleLowerCase().includes(query))
      .map(key => ({ key, ...compareMetric(current.get(key)?.[comparisonMetric] ?? (kind === 'count' ? 0 : null), previous.get(key)?.[comparisonMetric] ?? (kind === 'count' ? 0 : null), kind) }));
  }, [rows, previous, comparisonMetric, query]);

  const exportRows = () => [
    ['Segment', 'Fetched', 'Delivered', 'Dialled', 'RPC', 'Sales', 'Activations', 'Delivery %', 'Dial %', 'RPC %', 'Lead → sale %', 'Recorded activation / sale %', '15m SLA %', 'One-call share %', '5+ no RPC', 'Disposition completeness %', 'Source-recorded revenue', 'Leads without recorded revenue'],
    ...rows.map(row => [row.key, row.fetched, row.delivered, row.dialled, row.rpc, row.sales, row.activations, row.deliveryRate, row.dialRate, row.rpcRate, row.saleRate, row.activationRate, row.within15mRate, row.oneCallShare, row.fivePlusNoRpc, row.dispositionCompleteness, row.revenue, row.missingRevenueLeads]),
  ];

  return <section className="cx-command-panel">
    <header>
      <div><span className="cx-command-section-kicker">Segments</span><h2>Lifecycle and change by {dimension}</h2><p>Compare explicit metrics. Vendor figures here use one assigned vendor per lead so the totals reconcile.</p></div>
      <ExportAnalysisButton rows={exportRows} rowCount={rows.length} filename={`lifecycle_${dimension}`} label={`Export all ${rows.length.toLocaleString()} segments`} definitions={[data.methodology, `Complete ${dimension} population; table search and pagination do not narrow this export.`]} />
    </header>
    <div className="cx-control-note flex flex-wrap items-end gap-4">
      <label>Dimension <select aria-label="Lifecycle dimension" value={dimension} onChange={event => setDimension(event.target.value)}>{Object.keys(data.segments).map(key => <option key={key} value={key}>{key}</option>)}</select></label>
      <label>Sort by <select aria-label="Sort lifecycle segments" value={sort} onChange={event => setSort(event.target.value as SegmentSort)}><option value="fetched">Fetched</option><option value="saleRate">Lead → sale</option><option value="rpcRate">RPC / dialled</option><option value="activationRate">Recorded activation / sale</option></select></label>
      <label className="flex flex-col gap-1">Find a segment <input type="search" aria-label="Find a lifecycle segment" className="max-w-full rounded border px-3 py-2" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this dimension" /></label>
    </div>
    <div className="cx-analytics-visual-grid">
      <RankedMetricChart
        title={`${names[sort]} by ${dimension}`}
        subtitle="Top segments in the selected scope; exact evidence remains in the table below."
        data={visibleSegments.map(row => ({ segment: row.key, value: row[sort] }))}
        categoryKey="segment"
        valueKey="value"
        valueLabel={names[sort]}
        valueSuffix={sort === 'fetched' ? '' : '%'}
        decimals={sort === 'fetched' ? 0 : 2}
      />
    </div>
    <p className="cx-control-note">Tables show 25 rows per page. Search filters the visible rows across all three tables; full-scope calculations and exports retain every segment.</p>
    <PaginatedAnalysisTable rows={visibleSegments} label="lifecycle segments">{pageRows =>
      <div className="cx-performance-table-wrap"><table className="cx-performance-table" aria-label="Lifecycle segment metrics">
        <thead><tr><th>Segment</th><th>Fetched</th><th>Delivered</th><th>Dialled</th><th>RPC</th><th>Sales</th><th>Activations</th><th>Delivery %</th><th>Dial %</th><th>RPC %</th><th>Lead → sale %</th><th>Prior sale %</th><th>Δ pp</th><th>Activation %</th><th>15m / delivered</th><th>One call / dialled</th><th>5+ no RPC</th><th>Disposition</th><th>Invalid leads</th><th>Missing source</th><th>Missing grade</th><th>Source-recorded revenue</th><th>Leads without recorded revenue</th></tr></thead>
        <tbody>{pageRows.map(row => {
          const prior = previous.get(row.key);
          return <tr key={row.key}><th scope="row">{row.key}</th>
            {(['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activations'] as const).map(key => <td key={key}>{formatTableNumber(row[key])}</td>)}
            {(['deliveryRate', 'dialRate', 'rpcRate', 'saleRate'] as const).map(key => <td key={key}>{formatPercent(row[key], 2)}</td>)}
            <td>{formatPercent(prior?.saleRate, 2)}</td><td>{signed(row.saleRate != null && prior?.saleRate != null ? row.saleRate - prior.saleRate : null, 'pp')}</td>
            <td>{formatPercent(row.activationRate)}</td><td>{formatPercent(row.within15mRate)}</td><td>{formatPercent(row.oneCallShare)}</td><td>{formatTableNumber(row.fivePlusNoRpc)}</td><td>{formatPercent(row.dispositionCompleteness)}</td>
            <td>{formatTableNumber(row.invalidLeads)}</td><td>{formatTableNumber(row.missingSource)}</td><td>{formatTableNumber(row.missingGrade)}</td><td>{formatTableCurrency(row.revenue, 'R')}</td><td>{formatTableNumber(row.missingRevenueLeads)}</td>
          </tr>;
        })}</tbody>
      </table></div>
    }</PaginatedAnalysisTable>
    {data.period && <>
      <header><div><h2>Segment comparison</h2><p>{data.period.days} matched days. Entering and exiting segments are included.</p></div><label>Compare <select aria-label="Segment comparison metric" value={comparisonMetric} onChange={event => setComparisonMetric(event.target.value as SegmentMetric)}>{comparisonMetrics.map(key => <option value={key} key={key}>{names[key]}</option>)}</select></label></header>
      <PaginatedAnalysisTable rows={comparisonRows} label="segment comparisons">{pageRows =>
        <div className="cx-performance-table-wrap"><table className="cx-performance-table" aria-label="Matched segment comparison"><thead><tr><th>Segment</th><th>Current {names[comparisonMetric]}</th><th>Previous</th><th>Absolute / pp change</th><th>Relative change</th></tr></thead>
          <tbody>{pageRows.map(row => <tr key={row.key}><th scope="row">{row.key}</th><td>{row.kind === 'rate' ? formatPercent(row.current, 2) : formatTableNumber(row.current)}</td><td>{row.kind === 'rate' ? formatPercent(row.previous, 2) : formatTableNumber(row.previous)}</td><td>{signed(row.kind === 'rate' ? row.percentagePointChange : row.absoluteChange, row.kind === 'rate' ? 'pp' : '')}</td><td>{signed(row.percentageChange, '%')}</td></tr>)}</tbody>
        </table></div>
      }</PaginatedAnalysisTable>
    </>}
    {contribution && <>
      <header><div><h2>Contribution to overall {names[comparisonMetric]} change</h2><p>{signed(contribution.deltaPp, 'pp')} full-scope change · {contribution.status}. All {contribution.contributions.length.toLocaleString()} contributions sum to this change. Search results and individual pages may show only part of that total. Each dimension is a separate decomposition.</p></div></header>
      <PaginatedAnalysisTable rows={visibleContributions} label="change contributions">{pageRows =>
        <div className="cx-performance-table-wrap"><table className="cx-performance-table" aria-label="Segment change contributions"><thead><tr><th>Segment</th><th>Current outcome count</th><th>Previous outcome count</th><th>Contribution</th></tr></thead><tbody>{pageRows.map(row => <tr key={row.key}><th scope="row">{row.key}</th><td>{formatTableNumber(row.currentNumerator)}</td><td>{formatTableNumber(row.previousNumerator)}</td><td>{signed(row.contributionPp, 'pp')}</td></tr>)}</tbody></table></div>
      }</PaginatedAnalysisTable>
      <p className="cx-control-note">{contribution.method}</p>
    </>}
    <p className="cx-control-note">{data.methodology} Complete source-recorded revenue is unavailable when any included lead has incomplete revenue evidence; missing values are not imputed. The missing-revenue column counts leads with incomplete revenue evidence, including unresolved keys, currencies and conflicts; a known subtotal does not establish a complete total. Campaign and channel segmentation are unavailable until an approved operational mapping exists.</p>
  </section>;
}
