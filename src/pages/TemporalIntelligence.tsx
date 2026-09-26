import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Clock3, Download, Sun } from 'lucide-react';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchTemporal, type TemporalData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import OperationalPageHeader from '../components/OperationalPageHeader';
import { downloadCsv } from '../lib/formatters';

type MetricView = 'contactRate' | 'saleRate' | 'volume';

export default function TemporalIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<TemporalData | null>(null);
  const [metricView, setMetricView] = useState<MetricView>('contactRate');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (forceRefresh = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      setData(await fetchTemporal({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...extractOffernetFilters(filters),
      }, forceRefresh));
    } catch (err: any) {
      setError(err?.message || 'Failed to load time-of-day analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) loadData();
  }, [selectedClient, startDate, endDate, filters]);

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Day', 'Hour', 'Volume', 'RPC rate', 'Sale rate', 'Activation rate'],
      ...data.heatmap.map(row => [row.dayName, `${row.hour}:00`, row.volume, row.contactRate, row.saleRate, row.activationRate]),
    ];
    downloadCsv(`temporal_${selectedClient}_${startDate || 'all'}_${endDate || 'all'}`, rows);
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const maxMetric = useMemo(() => {
    if (!data?.heatmap.length) return 1;
    return Math.max(1, ...data.heatmap.map(row => metricView === 'volume' ? row.volume : metricView === 'saleRate' ? row.saleRate : row.contactRate));
  }, [data?.heatmap, metricView]);

  const cellOpacity = (value: number) => value <= 0 ? 0 : Math.max(.12, Math.min(1, value / maxMetric));

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />
      <div className="cx-command-content">
        <OperationalPageHeader
          eyebrow="Contact"
          title="Time & day performance"
          description="See when lead volume, RPC and sale outcomes are concentrated without turning observed peaks into prescriptive calling rules."
          actions={
            <div className="cx-segmented-control" role="group" aria-label="Temporal metric">
              <button type="button" data-active={metricView === 'contactRate'} onClick={() => setMetricView('contactRate')}>RPC rate</button>
              <button type="button" data-active={metricView === 'saleRate'} onClick={() => setMetricView('saleRate')}>Sale rate</button>
              <button type="button" data-active={metricView === 'volume'} onClick={() => setMetricView('volume')}>Volume</button>
            </div>
          }
        />

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner"/>Building day/hour matrix…</div>}

        {data && (
          <>
            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Observed pattern</span>
                  <h2>Day × hour matrix</h2>
                  <p>Intensity is scaled to the strongest observed cell in the selected scope.</p>
                </div>
                <Calendar size={16} className="text-slate-400"/>
              </header>

              <div className="cx-temporal-scroll">
                <div className="cx-temporal-grid">
                  <div className="cx-temporal-corner">Day / hour</div>
                  {hours.map(hour => <div key={hour} className="cx-temporal-hour">{String(hour).padStart(2, '0')}</div>)}
                  {days.map(day => {
                    const dayRows = data.heatmap.filter(row => row.dayName === day);
                    return (
                      <React.Fragment key={day}>
                        <div className="cx-temporal-day">{day}</div>
                        {hours.map(hour => {
                          const row = dayRows.find(item => item.hour === hour);
                          const value = row ? (metricView === 'volume' ? row.volume : metricView === 'saleRate' ? row.saleRate : row.contactRate) : 0;
                          const label = metricView === 'volume' ? value.toLocaleString() : `${value}%`;
                          return (
                            <div
                              key={`${day}-${hour}`}
                              className="cx-temporal-cell"
                              data-empty={value === 0}
                              title={`${day} ${String(hour).padStart(2, '0')}:00 · ${label}`}
                              style={value > 0 ? { '--cell-opacity': cellOpacity(value) } as React.CSSProperties : undefined}
                            >
                              {value > 0 ? label : '–'}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="cx-command-panel">
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
                      <div><dt>Sale</dt><dd>{row.saleIndex}%</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>

            <section className="cx-command-shortcuts">
              <button type="button" onClick={handleExportCsv}><Download size={16}/><span><strong>Export matrix</strong><small>Download the current day/hour population</small></span></button>
              <a href="/speed-to-lead"><Clock3 size={16}/><span><strong>Speed to lead</strong><small>Compare first-dial age with downstream outcomes</small></span></a>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
