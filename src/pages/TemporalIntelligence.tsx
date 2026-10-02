import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import { ReportSkeleton } from '../components/OperationalState';
import { downloadAnalysisCsv } from '../lib/analysisExport';
import { useOperationalData } from '../lib/useOperationalData';
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Clock3, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchTemporal, type TemporalData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import OperationalPageHeader from '../components/OperationalPageHeader';
import UnifiedMetricCard from '../components/UnifiedMetricCard';
import { formatPercent, formatTableNumber } from '../lib/formatters';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import { useOperatingControls } from '../hooks/useOperatingControls';
import { CaptureTurnaroundPanel, OperatingWindowPanel } from '../components/OfferNetControlPanels';
import TemporalHeatmap, { type TemporalMetric } from '../features/contact/components/TemporalHeatmap';
import EvidenceBars from '../shared/visuals/EvidenceBars';
import { lifecyclePresentation } from '../shared/visuals/lifecyclePresentation';
import '../styles/contactTemporalVisuals.css';
import { METRIC_REGISTRY_VERSION } from '../../contracts/metricRegistry';
import { selectTemporalHeatmap } from '../lib/temporalPresentation';
import { VolumeRateComboChart } from '../components/charts/OperationalVisuals';

type MetricView = TemporalMetric;
type TimeBucket = { label:string; volume:number; rpc:number; sales:number; activations:number; dialled?:number|null; rpcUnknownLeads?:number|null; dialledRpcUnknownLeads?:number|null; contactRate:number|null; saleRate:number|null; activationRate:number|null };
type TimeBasis = { basis:string; cohortLeads?:number; recordedTimestampLeads?:number; missingTimestampLeads:number; heatmap: TemporalData['heatmap']; byHour:TimeBucket[]; byDay:TimeBucket[]; weekType:TimeBucket[] };

export default function TemporalIntelligence() {
  const scoped = useScopedNavigationTarget();
  const controls = useOperatingControls();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [timeBasis, setTimeBasis] = useState('Capture');
  const [metricView, setMetricView] = useState<MetricView>('contactRate');

  const { data, loading, error, loadData } = useOperationalData<TemporalData & { timeBases?: TimeBasis[]; methodology?:string }>('TemporalIntelligence', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchTemporal);

  const selectedBasis = data?.timeBases?.find(b => b.basis === timeBasis);
  const activeHeatmap = selectTemporalHeatmap(data, timeBasis);

  const temporalSummary = useMemo(() => {
    if (!activeHeatmap.length) return null;
    const totalVolume = activeHeatmap.reduce((sum, r) => sum + (r.volume || 0), 0);
    const hourTotals = new Map<number, number>();
    for (const r of activeHeatmap) {
      hourTotals.set(r.hour, (hourTotals.get(r.hour) || 0) + (r.volume || 0));
    }
    let peakHour = 0;
    let peakVol = 0;
    for (const [h, v] of hourTotals.entries()) {
      if (v > peakVol) {
        peakVol = v;
        peakHour = h;
      }
    }
    const peakHourLabel = peakVol > 0 ? `${String(peakHour).padStart(2, '0')}:00 – ${String((peakHour + 1) % 24).padStart(2, '0')}:00` : 'Unavailable';

    return {
      totalVolume,
      peakHourLabel,
    };
  }, [activeHeatmap]);
  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Day', 'Hour', 'Volume', 'Qualified dialled', 'RPC evidence unknown', 'Dialled with RPC evidence unknown', 'RPC / qualified dialled', 'Recorded sale / lead', 'Recorded activation / recorded sale'],
      ...activeHeatmap.map(row => [row.dayName, `${row.hour}:00`, row.volume, row.dialled, row.rpcUnknownLeads, row.dialledRpcUnknownLeads, row.contactRate, row.saleRate, row.activationRate]),
      ['Event timestamp unrecorded', '', selectedBasis?.missingTimestampLeads],
    ];
    downloadAnalysisCsv(`temporal_${timeBasis.toLowerCase().replaceAll(' ', '_')}_${selectedClient}_${startDate || 'all'}_${endDate || 'all'}`, rows, { clientId: selectedClient, startDate, endDate, filters, validationStatus: 'NOT_VERIFIED', dateBasis: `Lead capture cohort grouped by recorded ${timeBasis.toLowerCase()} timestamp`, countingGrain: 'Distinct lead per recorded event time bucket', definitionVersion: METRIC_REGISTRY_VERSION, timezone: data.operatingContext?.timezone, definitions: `Selected capture cohort grouped by ${timeBasis.toLowerCase()} time in tenant timezone. Positive recorded RPC among qualified dialled / qualified dialled; recorded sales/leads; recorded activations/recorded sales (independent populations). Missing event timestamps are exported separately.` });
  };

  const observedWindows = useMemo(() => activeHeatmap
    .filter(row => row.contactRate != null && Number.isFinite(row.contactRate))
    .slice().sort((a, b) => b.contactRate! - a.contactRate! || b.volume - a.volume)
    .slice(0, 6), [activeHeatmap]);

  return (
    <AnalyticsPageLayout className="cx-temporal-page" title="Time & day" header={<OperationalPageHeader
          eyebrow="Contact"
          title="Time & day"
          description="See when captured lead volume, RPC and sale outcomes are concentrated in the tenant's local timezone without turning observed peaks into prescriptive calling rules."

        />} scope={<OffernetFilterBar onRefresh={async () => { await Promise.all([loadData(true), controls.refetch()]); }} onExportCsv={handleExportCsv} />}>

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{error}</div>}
        {loading && !data && <ReportSkeleton label="Building day/hour matrix" metricCount={2} />}

        {data && (
          <>
            {temporalSummary && (
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6" aria-label="Temporal performance summary">
                <UnifiedMetricCard
                  label="Recorded event volume"
                  icon={Calendar}
                  value={formatTableNumber(temporalSummary.totalVolume)}
                  note={`${timeBasis} event distribution`}
                  to={scoped('/funnel')}
                  inspectLabel="Inspect funnel"
                />

                <UnifiedMetricCard
                  label="Observed peak activity"
                  icon={Clock3}
                  value={temporalSummary.peakHourLabel || '—'}
                  note="Highest event concentration"
                  onInspect={() => setMetricView('volume')}
                  inspectLabel="View volume map"
                />

                <div className="cx-control-note sm:col-span-2">Combined rates are not supplied for this time distribution. Compare the returned cell and time-bucket rates below using their stated denominators.</div>
              </section>
            )}

            <div className="cx-segmented-control" role="group" aria-label="Temporal metric">
              <button type="button" data-active={metricView === 'contactRate'} aria-pressed={metricView === 'contactRate'} onClick={() => setMetricView('contactRate')}>RPC rate</button>
              <button type="button" data-active={metricView === 'saleRate'} aria-pressed={metricView === 'saleRate'} onClick={() => setMetricView('saleRate')}>Sale rate</button>
              <button type="button" data-active={metricView === 'activationRate'} aria-pressed={metricView === 'activationRate'} onClick={() => setMetricView('activationRate')}>Activation / sale</button>
              <button type="button" data-active={metricView === 'volume'} aria-pressed={metricView === 'volume'} onClick={() => setMetricView('volume')}>Volume</button>
            </div>
            <div className="cx-temporal-basis-control">
              <label>Event time <select aria-label="Temporal event basis" value={timeBasis} onChange={e => setTimeBasis(e.target.value)}>{(data.timeBases?.length ? data.timeBases : [{ basis: 'Capture' }]).map(b => <option key={b.basis}>{b.basis}</option>)}</select></label>
              <span>{formatTableNumber(selectedBasis?.missingTimestampLeads)} leads without this event timestamp · {formatTableNumber(selectedBasis?.cohortLeads)} leads in capture cohort</span>
            </div>
            <TemporalHeatmap rows={activeHeatmap} metric={metricView} basis={timeBasis} operatingContext={data.operatingContext} />

            <section id="temporal-peaks" className="cx-temporal-ranked-windows">
              <EvidenceBars title="Observed high-contact windows" description={`${timeBasis} event windows ranked by returned RPC rate, with volume to support interpretation. These are observed associations, not calling recommendations.`}
                maximum={Math.max(100, ...observedWindows.map(row => row.contactRate!))}
                items={observedWindows.map(row => ({ key: `${row.dayName}-${row.hour}`, label: `${row.dayName} · ${String(row.hour).padStart(2, '0')}:00`, value: row.contactRate, displayValue: formatPercent(row.contactRate), detail: `${formatTableNumber(row.volume)} leads · Sale ${formatPercent(row.saleRate, 2)}`, color: lifecyclePresentation.rpc.color }))}
                scaleNote="Higher returned RPC rates may describe small populations. Each bar shows a supplied day/hour rate without pooling or estimating rates." />
            </section>

            <details className="cx-contact-evidence-disclosure">
              <summary>Compare hourly and daily outcomes</summary>
              {!selectedBasis && <p className="p-4 text-xs text-text-sec">Hourly and daily aggregate evidence is unavailable for this event basis.</p>}
            {selectedBasis && <div className="cx-analytics-visual-grid" id="temporal-hour">
              <VolumeRateComboChart
                title={`${timeBasis} outcomes by hour`}
                subtitle="Volume is shown as bars; RPC, sale and activation rates are overlaid."
                data={selectedBasis.byHour}
                xKey="label"
                volumeKey="volume"
                volumeLabel="Leads"
                rateSeries={[
                  { key: 'contactRate', label: 'RPC rate' },
                  { key: 'saleRate', label: 'Sale rate' },
                  { key: 'activationRate', label: 'Activation / sale' },
                ]}
              />
              <VolumeRateComboChart
                title={`${timeBasis} outcomes by day`}
                subtitle="Compare observed volume and downstream rates across weekdays."
                data={selectedBasis.byDay}
                xKey="label"
                volumeKey="volume"
                volumeLabel="Leads"
                rateSeries={[
                  { key: 'contactRate', label: 'RPC rate' },
                  { key: 'saleRate', label: 'Sale rate' },
                ]}
              />
            </div>}

            </details>
            <details className="cx-contact-evidence-disclosure">
              <summary>View exact time and day evidence</summary>
              <div className="cx-performance-table-wrap" role="region" aria-label="Exact day and hour observations" tabIndex={0}>
                <table className="cx-performance-table"><caption className="sr-only">Every returned day and hour observation for the selected event basis</caption>
                  <thead><tr><th scope="col">Day</th><th scope="col">Hour</th><th scope="col">Leads</th><th scope="col">Qualified dialled</th><th scope="col">RPC unknown</th><th scope="col">Dialled RPC unknown</th><th scope="col">RPC rate</th><th scope="col">Sale rate</th><th scope="col">Activation / sale</th></tr></thead>
                  <tbody>{activeHeatmap.map((row, index) => <tr key={`${row.dayName}-${row.hour}-${index}`}><th scope="row">{row.dayName}</th><td>{String(row.hour).padStart(2, '0')}:00</td><td>{formatTableNumber(row.volume)}</td><td>{formatTableNumber(row.dialled)}</td><td>{formatTableNumber(row.rpcUnknownLeads)}</td><td>{formatTableNumber(row.dialledRpcUnknownLeads)}</td><td>{formatPercent(row.contactRate)}</td><td>{formatPercent(row.saleRate, 2)}</td><td>{formatPercent(row.activationRate)}</td></tr>)}</tbody>
                </table>
              </div>
            {selectedBasis && ([['Hour',selectedBasis.byHour],['Day',selectedBasis.byDay],['Week',selectedBasis.weekType]] as const).map(([title,rows]) => <section className="cx-command-panel" id={title === 'Day' ? 'temporal-day' : undefined} key={title}><header><div><h2>{timeBasis} by {title.toLowerCase()}</h2><p>Positive RPC / qualified dialled · recorded sales / leads · recorded activations / recorded sales (independent populations).</p></div></header><div className="cx-performance-table-wrap" role="region" aria-label={`${title} evidence`} tabIndex={0}><table className="cx-performance-table"><thead><tr><th scope="col">{title}</th><th scope="col">Leads</th><th scope="col">RPC</th><th scope="col">RPC unknown</th><th scope="col">RPC rate</th><th scope="col">Recorded sales</th><th scope="col">Sale rate</th><th scope="col">Recorded activations</th><th scope="col">Activation / sale</th></tr></thead><tbody>{rows.map(r => <tr key={r.label}><th scope="row">{r.label}</th><td>{formatTableNumber(r.volume)}</td><td>{formatTableNumber(r.rpc)}</td><td>{formatTableNumber(r.rpcUnknownLeads)}</td><td>{formatPercent(r.contactRate)}</td><td>{formatTableNumber(r.sales)}</td><td>{formatPercent(r.saleRate, 2)}</td><td>{formatTableNumber(r.activations)}</td><td>{formatPercent(r.activationRate)}</td></tr>)}</tbody></table></div></section>)}
            </details>
            <details className="cx-contact-evidence-disclosure">
              <summary>Operating-hours evidence and methodology</summary>
              <p className="p-4 text-xs text-text-sec">{data.methodology || 'Returned rates are descriptive associations in the tenant timezone.'}</p>
              {controls.data && <OperatingWindowPanel data={controls.data} />}
              {controls.data && <CaptureTurnaroundPanel data={controls.data} />}
            </details>

            <section className="cx-command-shortcuts">
              <button type="button" onClick={handleExportCsv}><Download size={16}/><span><strong>Export matrix</strong><small>Download the current day/hour population</small></span></button>
              <Link to={scoped('/speed-to-lead')}><Clock3 size={16}/><span><strong>Speed to lead</strong><small>Compare first-dial age with downstream outcomes</small></span></Link>
            </section>
          </>
        )}

    </AnalyticsPageLayout>
  );
}
