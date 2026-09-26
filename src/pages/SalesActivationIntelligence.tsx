import { downloadAnalysisCsv } from '../lib/analysisExport';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import { useOperationalData } from '../lib/useOperationalData';
import React from 'react';
import { AlertTriangle, ArrowRight, Clock3, DollarSign, Download, PackageCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchSalesActivation, type SalesActivationData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import OperationalPageHeader from '../components/OperationalPageHeader';
import { formatPercent, formatRatioPercent, formatTableCurrency, formatTableNumber } from '../lib/formatters';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import { useOperatingControls } from '../hooks/useOperatingControls';
import { ActivationAgeingPanel } from '../components/OfferNetControlPanels';
import { RankedMetricChart, VolumeRateComboChart } from '../components/charts/OperationalVisuals';

const money = (value: number | null | undefined) => formatTableCurrency(value, 'R');

export default function SalesActivationIntelligence() {
  const scoped = useScopedNavigationTarget();
  const controls = useOperatingControls();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();

  const { data, loading, error, loadData } = useOperationalData<Omit<SalesActivationData, 'reconciliation'> & { reconciliation: SalesActivationData['reconciliation'] & { salesWithRecordedRevenue?: number; medianTimeToSale?: string; medianTimeToActivation?: string }; bySource?: Array<{segment:string;sales:number;activations:number;revenue:number|null}>; byGrade?: Array<{segment:string;sales:number;activations:number;revenue:number|null}>; activationAgeing?: Array<{bucket:string;sales:number}>; revenueEvidence?: string; segmentMethodology?: string }>('SalesActivationIntelligence', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchSalesActivation);

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Vendor', 'Recorded sales', 'Activations', 'Activation rate', 'Recorded revenue'],
      ...data.byVendor.map(row => [
        row.vendor,
        row.sales,
        row.activations,
        row.sales > 0 ? Number(((row.activations / row.sales) * 100).toFixed(1)) : null,
        row.revenue,
      ]),
    ];
    downloadAnalysisCsv(`sales_activation_${selectedClient}_${startDate || 'all'}_${endDate || 'all'}`, rows, { clientId: selectedClient, startDate, endDate, filters, validationStatus: 'NOT_VERIFIED' });
  };

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={async () => { await Promise.all([loadData(true), controls.refetch()]); }} onExportCsv={handleExportCsv} />

      <div className="cx-command-content">
        <OperationalPageHeader
          eyebrow="Outcome"
          title="Sales & activation"
          description="Track recorded sales, activation fulfilment and revenue without mixing in assumed profitability."
          actions={
            <Link to={scoped('/commercial')} className="cx-button-secondary">
              Spend & commercial <ArrowRight size={13}/>
            </Link>
          }
        />

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner"/>Loading recorded outcomes…</div>}

        {data && (
          <>
            <section className="cx-command-metrics cx-outcome-metrics">
              <article className="cx-command-metric">
                <span>Recorded sales</span>
                <strong>{formatTableNumber(data.reconciliation?.totalSales)}</strong>
                <div><small>Observed sale events</small></div>
              </article>
              <article className="cx-command-metric">
                <span>Sales with revenue</span>
                <strong>{formatTableNumber(data.reconciliation?.salesWithRecordedRevenue ?? data.reconciliation?.billableSales)}</strong>
                <div><small>{formatTableNumber(data.reconciliation?.unrecordedRevenueSales)} sales missing revenue; {formatTableNumber(data.reconciliation?.unbilledSales)} recorded zero</small></div>
              </article>
              <article className="cx-command-metric">
                <span>Recorded activations</span>
                <strong>{formatTableNumber(data.reconciliation?.totalActivations)}</strong>
                <div><small>{formatPercent(data.reconciliation?.activationRate)} of recorded sales</small></div>
              </article>
              <article className="cx-command-metric">
                <span>Recorded revenue</span>
                <strong>{money(data.reconciliation?.realizedRevenue ?? null)}</strong>
                <div><small>Source-recorded revenue only</small></div>
              </article>
            </section>

            <div className="cx-command-grid cx-outcome-summary-grid">
              <section className="cx-command-panel">
                <header>
                  <div>
                    <span className="cx-command-section-kicker">Fulfilment timing</span>
                    <h2>Outcome latency</h2>
                    <p>Measured elapsed time to recorded sale and activation where timestamps are available.</p>
                  </div>
                  <Clock3 size={16} className="text-slate-400"/>
                </header>
                <div className="cx-outcome-latency">
                  <div><span>Average time to sale</span><strong>{data.reconciliation.avgTimeToSale}</strong></div>
                  <ArrowRight size={16}/>
                  <div><span>Average sale → activation</span><strong>{data.reconciliation.avgTimeToActivation}</strong></div><div><span>Median capture → sale</span><strong>{data.reconciliation.medianTimeToSale || '—'}</strong></div><div><span>Median sale → activation</span><strong>{data.reconciliation.medianTimeToActivation || '—'}</strong></div>
                </div>
              </section>

              <section className="cx-command-panel">
                <header>
                  <div>
                    <span className="cx-command-section-kicker">Maturity</span>
                    <h2>Activation cohort status</h2>
                    <p>Recent sales should not be judged against older cohorts until maturation evidence is validated.</p>
                  </div>
                  <PackageCheck size={16} className="text-slate-400"/>
                </header>

                {data.maturationCurve.length ? (
                  <div className="cx-maturation-list">
                    {data.maturationCurve.map((row, index) => (
                      <div key={`${row.day}-${index}`}>
                        <span>{row.day}</span>
                        <div><i style={{ width: `${Math.min(100, Math.max(0, row.cumulativePct))}%` }}/></div>
                        <strong>{formatPercent(row.cumulativePct)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="cx-command-empty">
                    <Clock3 size={17}/>
                    <span><strong>{data.maturationStatus || 'UNAVAILABLE'}</strong> — {data.maturationReason}</span>
                  </div>
                )}
              </section>
            </div>

            <div className="cx-analytics-visual-grid">
              <VolumeRateComboChart
                title="Vendor sales and activation"
                subtitle="Recorded sales by vendor with activation / sale overlaid."
                data={data.byVendor.map(row => ({
                  ...row,
                  activationRate: row.sales > 0 ? (row.activations / row.sales) * 100 : null,
                }))}
                xKey="vendor"
                volumeKey="sales"
                volumeLabel="Sales"
                rateSeries={[{ key: 'activationRate', label: 'Activation / sale' }]}
              />
              {data.activationAgeing && <RankedMetricChart
                title="Sales awaiting activation"
                subtitle="Non-overlapping completed-age cohorts from the recorded sale timestamp."
                data={data.activationAgeing.map(row => ({ bucket: row.bucket, sales: row.sales }))}
                categoryKey="bucket"
                valueKey="sales"
                valueLabel="Sales"
                maxItems={10}
              />}
            </div>

            {controls.data && <ActivationAgeingPanel data={controls.data} />}
            {data.revenueEvidence && <p className="cx-control-note">{data.revenueEvidence}</p>}
            {data.activationAgeing && <section className="cx-command-panel"><header><div><h2>Sales awaiting activation by completed age</h2><p>Non-overlapping cohorts from the recorded sale timestamp.</p></div></header><div className="cx-performance-table-wrap"><table className="cx-performance-table"><thead><tr><th>Age</th><th>Sales</th></tr></thead><tbody>{data.activationAgeing.map(r => <tr key={r.bucket}><th>{r.bucket}</th><td>{formatTableNumber(r.sales)}</td></tr>)}</tbody></table></div></section>}
            {([['Source',data.bySource],['Grade',data.byGrade]] as const).map(([dimension, rows]) => rows && <section className="cx-command-panel" key={dimension}><header><div><h2>{dimension} outcomes</h2><p>{data.segmentMethodology}</p></div><ExportAnalysisButton filename={`sales_activation_${dimension}`} rows={[[dimension,'Sales','Activations','Recorded revenue'], ...rows.map(r => [r.segment,r.sales,r.activations,r.revenue])]} definitions={[data.segmentMethodology || 'Recorded outcomes']} /></header><div className="cx-performance-table-wrap"><table className="cx-performance-table"><thead><tr><th>{dimension}</th><th>Sales</th><th>Activations</th><th>Activation / sale</th><th>Recorded revenue</th><th>Revenue / sale</th></tr></thead><tbody>{rows.map(r => <tr key={r.segment}><th>{r.segment}</th><td>{formatTableNumber(r.sales)}</td><td>{formatTableNumber(r.activations)}</td><td>{formatRatioPercent(r.activations,r.sales)}</td><td>{money(r.revenue)}</td><td>{r.revenue != null && r.sales > 0 ? money(r.revenue/r.sales) : '—'}</td></tr>)}</tbody></table></div></section>)}


            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Vendor outcomes</span>
                  <h2>Sales, activation & recorded revenue</h2>
                  <p>Compare outcome volume and fulfilment by vendor in one stable table.</p>
                </div>
              </header>
              <div className="cx-performance-table-wrap">
                <table className="cx-performance-table cx-outcome-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Sales</th>
                      <th>Activations</th>
                      <th>Activation / sale</th>
                      <th>Recorded revenue</th>
                      <th>Revenue / sale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.byVendor || []).map((row, index) => (
                      <tr key={`${row.vendor}-${index}`}>
                        <th>{row.vendor}</th>
                        <td>{formatTableNumber(row.sales)}</td>
                        <td>{formatTableNumber(row.activations)}</td>
                        <td>{formatRatioPercent(row.activations, row.sales)}</td>
                        <td>{money(row.revenue)}</td>
                        <td>{row.sales > 0 && row.revenue != null ? money(row.revenue / row.sales) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cx-command-shortcuts">
              <Link to={scoped('/commercial')}><DollarSign size={16}/><span><strong>Spend & commercial</strong><small>Relate observed media spend to recorded outcomes</small></span><ArrowRight size={14}/></Link>
              <Link to={scoped('/funnel')}><PackageCheck size={16}/><span><strong>Funnel</strong><small>Trace where leads stop before sale and activation</small></span><ArrowRight size={14}/></Link>
              <button type="button" onClick={handleExportCsv}><Download size={16}/><span><strong>Export outcomes</strong><small>Download current vendor outcome table</small></span><ArrowRight size={14}/></button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
