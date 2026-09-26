import React, { useState } from 'react';
import { AlertTriangle, CalendarDays, Layers3 } from 'lucide-react';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useClient } from '../lib/ClientContext';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import OperationalPageHeader from '../components/OperationalPageHeader';
import { formatTableNumber } from '../lib/formatters';
import { heatmapColors } from '../lib/heatmapColors';

type CohortMetric = 'call_coverage' | 'sale' | 'activation';
type CohortGrain = 'daily' | 'weekly' | 'monthly';

export default function Cohorts() {
  const [cohortType, setCohortType] = useState<CohortGrain>('weekly');
  const [metricType, setMetricType] = useState<CohortMetric>('sale');
  const { clientConfig } = useClient();
  const currencyPrefix = clientConfig?.currency === 'GBP' ? '£' : clientConfig?.currency === 'USD' ? '$' : 'R ';
  const { data: cohorts, loading, error, refetch } = useAnalyticsData('cohorts', { cohortType, metricType });

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
  const maturationReasons = Array.from(new Set<string>((cohorts || [])
    .filter((row: any) => row.maturationStatus === 'UNAVAILABLE' && row.maturationReason)
    .map((row: any) => String(row.maturationReason))));

  return (
    <div className="cx-command-page">
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

        {cohorts && cohorts.length > 0 && (
          <>
            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Maturation</span>
                  <h2>{metricLabel[metricType]} by days since capture</h2>
                  <p>Each cell shows the observed cumulative cohort metric at D0, D1, D3, D7, D14 and D30.</p>
                </div>
                <CalendarDays size={16} className="text-slate-400"/>
              </header>

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
                        <td>{formatTableNumber(row.delivered||0)} <small>{Number(row.deliveryRate||0).toFixed(1)}%</small></td>
                        <td>{formatTableNumber(row.called||0)} <small>{Number(row.callCoverage||row.callRate||0).toFixed(1)}%</small></td>
                        <td>{formatTableNumber(row.rpcs||0)} <small>{Number(row.rpcRate||0).toFixed(1)}%</small></td>
                        <td>{formatTableNumber(row.sales||0)} <small>{Number(row.saleRate||0).toFixed(1)}%</small></td>
                        <td>{formatTableNumber(row.billableSales||0)} <small>{Number(row.billableSaleRate||0).toFixed(1)}%</small></td>
                        <td>{formatTableNumber(row.activations||0)} <small>{Number(row.activationRate||0).toFixed(1)}%</small></td>
                        <td>{currencyPrefix}{formatTableNumber(row.revenue||0)}</td>
                        <td>{currencyPrefix}{Number(row.revPerLead||0).toFixed(2)}</td>
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
