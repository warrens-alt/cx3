import { ReportSkeleton } from '../components/OperationalState';
import { downloadAnalysisCsv } from '../lib/analysisExport';
import { useOperationalData } from '../lib/useOperationalData';
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Clock3, Download, Sun } from 'lucide-react';
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
import { heatmapColors } from '../lib/heatmapColors';
import { VolumeRateComboChart } from '../components/charts/OperationalVisuals';

type MetricView = 'contactRate' | 'saleRate' | 'activationRate' | 'volume';
type TimeBucket = { label:string; volume:number; rpc:number; sales:number; activations:number; contactRate:number|null; saleRate:number|null; activationRate:number|null };
type TimeBasis = { basis:string; missingTimestampLeads:number; heatmap: TemporalData['heatmap']; byHour:TimeBucket[]; byDay:TimeBucket[]; weekType:TimeBucket[] };

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
  const activeHeatmap = selectedBasis?.heatmap || data?.heatmap || [];

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
      ['Day', 'Hour', 'Volume', 'RPC rate', 'Sale rate', 'Activation rate'],
      ...activeHeatmap.map(row => [row.dayName, `${row.hour}:00`, row.volume, row.contactRate, row.saleRate, row.activationRate]),
    ];
    downloadAnalysisCsv(`temporal_${timeBasis.toLowerCase().replaceAll(' ', '_')}_${selectedClient}_${startDate || 'all'}_${endDate || 'all'}`, rows, { clientId: selectedClient, startDate, endDate, filters, validationStatus: 'NOT_VERIFIED', definitions: `Selected capture cohort grouped by ${timeBasis.toLowerCase()} time in tenant timezone. RPC/dialled, sales/leads, activations/sales.` });
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const maxMetric = useMemo(() => {
    if (!activeHeatmap.length) return 1;
    return Math.max(1, ...activeHeatmap.map(row => row[metricView] ?? 0));
  }, [activeHeatmap, metricView]);

  return (
    <div className="cx-command-page cx-temporal-page">
      <OffernetFilterBar onRefresh={async () => { await Promise.all([loadData(true), controls.refetch()]); }} onExportCsv={handleExportCsv} />
      <div className="cx-command-content">
        <OperationalPageHeader
          eyebrow="Contact"
          title="Time & day performance"
          description="See when captured lead volume, RPC and sale outcomes are concentrated in the tenant's local timezone without turning observed peaks into prescriptive calling rules."
          actions={
            <div className="cx-segmented-control" role="group" aria-label="Temporal metric">
              <button type="button" data-active={metricView === 'contactRate'} aria-pressed={metricView === 'contactRate'} onClick={() => setMetricView('contactRate')}>RPC rate</button>
              <button type="button" data-active={metricView === 'saleRate'} aria-pressed={metricView === 'saleRate'} onClick={() => setMetricView('saleRate')}>Sale rate</button>
              <button type="button" data-active={metricView === 'activationRate'} aria-pressed={metricView === 'activationRate'} onClick={() => setMetricView('activationRate')}>Activation rate</button>
              <button type="button" data-active={metricView === 'volume'} aria-pressed={metricView === 'volume'} onClick={() => setMetricView('volume')}>Volume</button>
            </div>
          }
        />

        <nav className="cx-analysis-jump-nav" aria-label="Time analysis sections">
          <a href="#temporal-matrix">Day × hour matrix</a>
          <a href="#temporal-hour">By hour</a>
          <a href="#temporal-day">By day</a>
          <a href="#temporal-peaks">Observed peaks</a>
        </nav>

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{error}</div>}
        {loading && !data && <ReportSkeleton label="Building day/hour matrix" metricCount={2} />}

        {data && (
          <>
            {temporalSummary && (
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6" aria-label="Temporal performance summary">
                <UnifiedMetricCard
                  label="Period Volume"
                  value={formatTableNumber(temporalSummary.totalVolume)}
                  note={`${timeBasis} event distribution`}
                  to={scoped('/funnel')}
                  inspectLabel="Inspect funnel"
                />

                <UnifiedMetricCard
                  label="Peak Activity Window"
                  value={temporalSummary.peakHourLabel || '—'}
                  note="Highest event concentration"
                  onInspect={() => setMetricView('volume')}
                  inspectLabel="View volume map"
                />

                <div className="cx-control-note sm:col-span-2">Combined rates are not supplied for this time distribution. Compare the returned cell and time-bucket rates below using their stated denominators.</div>
              </section>
            )}

            <div className="cx-control-note"><label>Event time <select aria-label="Temporal event basis" value={timeBasis} onChange={e => setTimeBasis(e.target.value)}>{(data.timeBases || []).map(b => <option key={b.basis}>{b.basis}</option>)}</select></label> · {formatTableNumber(selectedBasis?.missingTimestampLeads)} leads without this event timestamp. {data.methodology}</div>
            <section className="cx-command-panel" id="temporal-matrix">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Observed pattern</span>
                  <h2>Day × hour matrix</h2>
                  <p>{timeBasis} time · {data.operatingContext?.timezone || 'tenant timezone'}. Intensity is scaled to the strongest observed cell in scope.</p>
                </div>
                <Calendar size={16} className="text-slate-400"/>
              </header>

              <div className="cx-temporal-scroll" role="region" aria-label="Day and hour performance matrix" tabIndex={0}>
                <div className="cx-temporal-grid">
                  <div className="cx-temporal-corner">Day / hour</div>
                  {hours.map(hour => <div key={hour} className="cx-temporal-hour">{String(hour).padStart(2, '0')}</div>)}
                  {days.map(day => {
                    const dayRows = activeHeatmap.filter(row => row.dayName === day);
                    return (
                      <React.Fragment key={day}>
                        <div className="cx-temporal-day">{day}</div>
                        {hours.map(hour => {
                          const row = dayRows.find(item => item.hour === hour);
                          const rawVal = row ? row[metricView] : null;
                          const numericValue = rawVal == null ? null : Number(rawVal);
                          const value = numericValue !== null && Number.isFinite(numericValue) ? numericValue : null;
                          const label = value === null
                            ? '—'
                            : metricView === 'volume'
                              ? formatTableNumber(value)
                              : formatPercent(value);
                          return (
                            <div
                              key={`${day}-${hour}`}
                              className="cx-temporal-cell"
                              data-empty={value === null}
                              role="img"
                              aria-label={`${day} ${String(hour).padStart(2, '0')}:00 · ${metricView} · ${value === null ? 'Unavailable' : label}`}
                              title={`${day} ${String(hour).padStart(2, '0')}:00 · ${label}`}
                              style={heatmapColors(value, maxMetric)}
                            >
                              {label}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </section>

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
                  { key: 'activationRate', label: 'Activation rate' },
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

            {selectedBasis && ([['Hour',selectedBasis.byHour],['Day',selectedBasis.byDay],['Week',selectedBasis.weekType]] as const).map(([title,rows]) => <section className="cx-command-panel" id={title === 'Day' ? 'temporal-day' : undefined} key={title}><header><div><h2>{timeBasis} by {title.toLowerCase()}</h2><p>RPC / dialled · sales / leads · activations / sales.</p></div></header><div className="cx-performance-table-wrap"><table className="cx-performance-table"><thead><tr><th>{title}</th><th>Leads</th><th>RPC</th><th>RPC rate</th><th>Sales</th><th>Sale rate</th><th>Activations</th><th>Activation rate</th></tr></thead><tbody>{rows.map(r => <tr key={r.label}><th>{r.label}</th><td>{formatTableNumber(r.volume)}</td><td>{formatTableNumber(r.rpc)}</td><td>{formatPercent(r.contactRate)}</td><td>{formatTableNumber(r.sales)}</td><td>{formatPercent(r.saleRate)}</td><td>{formatTableNumber(r.activations)}</td><td>{formatPercent(r.activationRate)}</td></tr>)}</tbody></table></div></section>)}
            {controls.data && <OperatingWindowPanel data={controls.data} />}
            {controls.data && <CaptureTurnaroundPanel data={controls.data} />}

            <section className="cx-command-panel" id="temporal-peaks">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Observed peaks</span>
                  <h2>Highest-contact windows</h2>
                  <p>Ranked from observed RPC rate and volume. These are descriptive windows, not recommended schedules.</p>
                </div>
                <Sun size={16} className="text-slate-400"/>
              </header>
              <div className="cx-window-grid">
                {data.peakWindows.map((row, index) => (
                  <article key={`${row.window}-${index}`}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{row.window}</strong>
                      <small>{row.verdict}</small>
                    </div>
                    <dl>
                      <div><dt>RPC</dt><dd>{row.contactRate}</dd></div>
                      <div><dt>Sale</dt><dd>{row.saleIndex === '—' ? '—' : `${row.saleIndex}%`}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>

            <section className="cx-command-shortcuts">
              <button type="button" onClick={handleExportCsv}><Download size={16}/><span><strong>Export matrix</strong><small>Download the current day/hour population</small></span></button>
              <Link to={scoped('/speed-to-lead')}><Clock3 size={16}/><span><strong>Speed to lead</strong><small>Compare first-dial age with downstream outcomes</small></span></Link>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
