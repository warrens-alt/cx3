import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Layers3 } from 'lucide-react';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useClient } from '../lib/ClientContext';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import OperationalPageHeader from '../components/OperationalPageHeader';
import UnifiedMetricCard from '../components/UnifiedMetricCard';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import { formatTableNumber, formatPercent, formatTableCurrency } from '../lib/formatters';
import { heatmapColors } from '../lib/heatmapColors';
import { MultiSeriesTrendChart, VolumeRateComboChart } from '../components/charts/OperationalVisuals';

type CohortMetric = 'call_coverage' | 'sale' | 'activation';
type CohortGrain = 'daily' | 'weekly' | 'monthly';

export default function Cohorts() {
  const scoped = useScopedNavigationTarget();
  const [cohortType, setCohortType] = useState<CohortGrain>('weekly');
  const [metricType, setMetricType] = useState<CohortMetric>('sale');
  const { clientConfig } = useClient();
  const currencyPrefix = clientConfig?.currency === 'GBP' ? '£' : clientConfig?.currency === 'USD' ? '$' : 'R ';
  const { data: cohorts, loading, error, refetch } = useAnalyticsData('cohorts', { cohortType, metricType });

  const cohortSummary = useMemo(() => {
    if (!cohorts || !cohorts.length) return null;
    const totalLeads = cohorts.reduce((sum: number, c: any) => sum + (c.size || 0), 0);
    return {
      totalLeads,
      cohortCount: cohorts.length,
    };
  }, [cohorts]);

  const metricLabel: Record<CohortMetric, string> = {
    call_coverage: 'Dialled / fetched',
    sale: 'Sales / fetched',
    activation: 'Activations / fetched',
  };
  const intervals = ['d0','d1','d3','d7','d14','d30'] as const;
  const maxValue = Math.max(
    1,
    ...((cohorts || []).flatMap((row:any)=>intervals.map(interval=>Number(row.metrics?.[interval] || 0))))
  );

  const formatMetric = (value: number | null | undefined) =>
    value == null ? '—' : `${Number(value).toFixed(1)}%`;
  const recentCohorts = useMemo(() => (cohorts || []).slice(0, 6), [cohorts]);
  const maturationChart = useMemo(() => intervals.map(interval => {
    const row: Record<string, any> = { interval: interval.toUpperCase() };
    recentCohorts.forEach((cohort: any, index: number) => {
      row[`cohort_${index}`] = cohort.metrics?.[interval] == null ? null : Number(cohort.metrics[interval]);
    });
    return row;
  }), [recentCohorts]);

  const maturationSeries = useMemo(() => recentCohorts.map((cohort: any, index: number) => ({
    key: `cohort_${index}`,
    label: String(cohort.cohort),
  })), [recentCohorts]);

  const cohortOutcomeVisual = useMemo(() => (cohorts || []).slice(0, 12).map((row: any) => ({
    cohort: row.cohort,
    leads: row.size,
    callCoverage: row.callCoverage ?? row.callRate ?? null,
    saleRate: row.saleRate ?? null,
    activationRate: row.activationRate ?? null,
  })), [cohorts]);

  const maturationReasons = Array.from(new Set<string>((cohorts || [])
    .filter((row: any) => row.maturationStatus === 'UNAVAILABLE' && row.maturationReason)
    .map((row: any) => String(row.maturationReason))));

  return (
    <div className="cx-command-page cx-cohorts-page">
      <OffernetFilterBar onRefresh={() => refetch()} />
      <div className="cx-command-content">
        <OperationalPageHeader
          eyebrow="Lifecycle"
          title="Cohort maturation"
          description="Compare captured cohorts as their observed call, sale and activation outcomes accumulate over time."
          status="NOT_VERIFIED"
          statusLabel="Legacy cohort analytics"
          actions={
            <div className="cx-cohort-controls">
              <label>
                <span>Grain</span>
                <select value={cohortType} onChange={event=>setCohortType(event.target.value as CohortGrain)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label>
                <span>Metric</span>
                <select value={metricType} onChange={event=>setMetricType(event.target.value as CohortMetric)}>
                  <option value="call_coverage">Dial coverage</option>
                  <option value="sale">Sales / fetched</option>
                  <option value="activation">Activations / fetched</option>
                </select>
              </label>
            </div>
          }
        />

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{String(error)}</div>}
        {loading && !cohorts && <div className="cx-command-loading"><div className="cx-command-spinner"/>Loading cohorts…</div>}

        {cohorts && cohorts.length === 0 && (
          <div className="cx-command-empty"><CalendarDays size={17}/>No cohort records were returned for this scope.</div>
        )}

        {cohorts?.some((row:any) => row.detailTruncated) && <p className="cx-control-note">Showing the latest 16 cohort groups. CSV contains these displayed groups and marks the truncation.</p>}

        {cohorts && cohorts.length > 0 && (
          <>
            {cohortSummary && (
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6" aria-label="Cohort maturation summary">
                <UnifiedMetricCard
                  label="Total Cohort Leads"
                  value={formatTableNumber(cohortSummary.totalLeads)}
                  note={`${cohortSummary.cohortCount} observed cohorts`}
                  to={scoped('/funnel')}
                  inspectLabel="Inspect funnel"
                />

                <div className="cx-control-note sm:col-span-2">Summary covers the returned cohort groups. Combined rates are not supplied; inspect each cohort's returned rates below. Missing cohort evidence remains unavailable.</div>
              </section>
            )}

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Maturation</span>
                  <h2>{metricLabel[metricType]} by days since capture</h2>
                  <p>Each cell shows the observed cumulative cohort metric at D0, D1, D3, D7, D14 and D30.</p>
                </div>
                <ExportAnalysisButton filename={`cohorts-${cohortType}-${metricType}`} rows={[
                  ['Cohort', 'Leads', ...intervals.map(interval => interval.toUpperCase())],
                  ...cohorts.map((row:any) => [row.cohort, row.size, ...intervals.map(interval => row.metrics?.[interval])]),
                ]} truncated={cohorts.some((row:any) => row.detailTruncated)} definitions={`${metricLabel[metricType]}; observed cumulative event dates. Missing event timing remains unavailable.`} />
              </header>

              <div className="cx-analytics-visual-grid">
                <MultiSeriesTrendChart
                  title={`${metricLabel[metricType]} maturation curves`}
                  subtitle={`Latest ${recentCohorts.length} displayed cohorts across D0 → D30. Missing event timing remains unavailable.`}
                  data={maturationChart}
                  xKey="interval"
                  series={maturationSeries}
                />
                <VolumeRateComboChart
                  title="Cohort volume and observed outcomes"
                  subtitle="Fetched cohort size with dial coverage, sale and activation rates overlaid."
                  data={cohortOutcomeVisual}
                  xKey="cohort"
                  volumeKey="leads"
                  volumeLabel="Fetched leads"
                  rateSeries={[
                    { key: 'callCoverage', label: 'Dial coverage' },
                    { key: 'saleRate', label: 'Sale rate' },
                    { key: 'activationRate', label: 'Activation rate' },
                  ]}
                />
              </div>

              {maturationReasons.length > 0 && (
                <div className="cx-command-empty" role="status">
                  <AlertTriangle size={17}/>
                  <div><strong>Some cohort measures are unavailable.</strong>{maturationReasons.map(reason => <p key={reason}>{reason}</p>)}</div>
                </div>
              )}

              <div className="cx-cohort-matrix-wrap" role="region" aria-label="Cohort maturation matrix" tabIndex={0}>
                <table className="cx-cohort-matrix">
                  <thead>
                    <tr><th>Cohort</th><th>Size</th>{intervals.map(interval=><th key={interval}>{interval.toUpperCase()}</th>)}</tr>
                  </thead>
                  <tbody>
                    {cohorts.map((row:any,index:number)=>(
                      <tr key={`${row.cohort}-${index}`}>
                        <th>{row.cohort}{row.maturationStatus === 'UNAVAILABLE' && <small className="block" title={row.maturationReason}>Maturation unavailable</small>}</th>
                        <td>{formatTableNumber(row.size)}</td>
                        {intervals.map(interval=>{
                          const value=row.metrics?.[interval] == null ? null : Number(row.metrics[interval]);
                          return <td key={interval}><span data-empty={value==null} style={heatmapColors(value,maxValue)}>{formatMetric(value)}</span></td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Full funnel</span>
                  <h2>Outcome progression by cohort</h2>
                  <p>Volume and conversion measures stay together in one table for cross-cohort comparison.</p>
                </div>
                <Layers3 size={16} className="text-slate-400"/>
              </header>
              <div className="cx-performance-table-wrap">
                <table className="cx-performance-table cx-cohort-table">
                  <thead>
                    <tr><th>Cohort</th><th>Fetched</th><th>Delivered</th><th>Dialled</th><th>RPC</th><th>Sales</th><th>Revenue-matched sales</th><th>Activations</th><th>Recorded revenue</th><th>Revenue / lead</th></tr>
                  </thead>
                  <tbody>
                    {cohorts.map((row:any,index:number)=>(
                      <tr key={`${row.cohort}-funnel-${index}`}>
                        <th>{row.cohort}</th>
                        <td>{formatTableNumber(row.size)}</td>
                        <td>{formatTableNumber(row.delivered)} <small>{formatPercent(row.deliveryRate)}</small></td>
                        <td>{formatTableNumber(row.called)} <small>{formatPercent(row.callCoverage ?? row.callRate)}</small></td>
                        <td>{formatTableNumber(row.rpcs)} <small>{formatPercent(row.rpcRate)}</small></td>
                        <td>{formatTableNumber(row.sales)} <small>{formatPercent(row.saleRate)}</small></td>
                        <td>{formatTableNumber(row.billableSales)} <small>{formatPercent(row.billableSaleRate)}</small></td>
                        <td>{formatTableNumber(row.activations)} <small>{formatPercent(row.activationRate)}</small></td>
                        <td>{formatTableCurrency(row.revenue, currencyPrefix)}</td>
                        <td>{formatTableCurrency(row.revPerLead, currencyPrefix)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="cx-command-empty cx-cohort-note">
              Cohort outputs remain exploratory until the legacy cohort service is migrated onto the current evidence and source-contract layer.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
