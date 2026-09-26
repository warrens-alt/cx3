import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Clock3, Download, GitFork } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchFunnel, type FunnelData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import OperationalPageHeader from '../components/OperationalPageHeader';
import { downloadCsv, formatRatioPercent, formatTableNumber } from '../lib/formatters';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import { useOperatingControls } from '../hooks/useOperatingControls';
import { SlaBandsPanel } from '../components/OfferNetControlPanels';

const pct = formatRatioPercent;

export default function FunnelIntelligence() {
  const scoped = useScopedNavigationTarget();
  const controls = useOperatingControls();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (forceRefresh = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      setData(await fetchFunnel({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...extractOffernetFilters(filters),
      }, forceRefresh));
    } catch (err: any) {
      setError(err?.message || 'Failed to load funnel analysis');
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
      ['Dimension', 'Segment', 'Fetched', 'Delivered', 'Dialled', 'RPC', 'Sales', 'Activations'],
      ...data.byVendor.map(v => ['Vendor', v.vendor, v.leads, v.delivered, v.dialled, v.contacted, v.sales, v.activations]),
      ...data.bySource.map(s => ['Source', s.source, s.leads, '', '', s.contacted, s.sales, s.activations]),
      ...data.byGrade.map(g => ['Grade', g.grade, g.leads, '', '', g.contacted, g.sales, g.activations]),
    ];
    downloadCsv(`funnel_${selectedClient}_${startDate || 'all'}_${endDate || 'all'}`, rows);
  };

  const sourceMax = useMemo(() => Math.max(1, ...(data?.bySource || []).map(row => row.leads)), [data?.bySource]);
  const gradeMax = useMemo(() => Math.max(1, ...(data?.byGrade || []).map(row => row.leads)), [data?.byGrade]);

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={async () => { await Promise.all([loadData(true), controls.refetch()]); }} onExportCsv={handleExportCsv} />

      <div className="cx-command-content">
        <OperationalPageHeader
          eyebrow="Funnel"
          title="Stage progression"
          description="See where lead populations progress, where they stop, and how vendor, source and grade cohorts differ."
          actions={
            <Link to={scoped('/lead-explorer')} className="cx-button-secondary">
              Inspect records <ArrowRight size={13} />
            </Link>
          }
        />

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner"/>Loading funnel progression…</div>}

        {data && (
          <>
            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Latency</span>
                  <h2>Lifecycle timing</h2>
                  <p>Measured elapsed time between available source timestamps. Unavailable stages stay explicitly unavailable.</p>
                </div>
                <Clock3 size={16} className="text-slate-400"/>
              </header>

              <div className="cx-lifecycle-rail">
                {[
                  ['Capture → Delivery', data.velocity.fetchToDelivery, 'Routing and delivery'],
                  ['Delivery → First Dial', data.velocity.deliveryToFirstDial, 'Dialler response'],
                  ['First Dial → RPC', data.velocity.firstDialToContact, 'RPC timestamp unavailable'],
                  ['First Dial → Sale', data.velocity.contactToSale, 'Recorded sale timing'],
                  ['Sale → Activation', data.velocity.saleToActivation, 'Fulfilment timing'],
                ].map(([label, value, note], index) => (
                  <React.Fragment key={label}>
                    <article data-unavailable={String(value).toLowerCase() === 'unavailable'}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                      <small>{note}</small>
                    </article>
                    {index < 4 && <ArrowRight size={14} className="cx-lifecycle-arrow" />}
                  </React.Fragment>
                ))}
              </div>
            </section>

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Vendor execution</span>
                  <h2>Vendor funnel comparison</h2>
                  <p>One table keeps stage volume and transition rates together, so the user does not have to switch between chart and table modes.</p>
                </div>
                <GitFork size={16} className="text-slate-400"/>
              </header>

              <div className="cx-performance-table-wrap">
                <table className="cx-performance-table cx-funnel-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Fetched</th>
                      <th>Delivered</th>
                      <th>Delivery %</th>
                      <th>Dialled</th>
                      <th>Dial / delivered</th>
                      <th>RPC</th>
                      <th>RPC / dialled</th>
                      <th>Sales</th>
                      <th>Sale / RPC</th>
                      <th>Activated</th>
                      <th>Activation / sale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.byVendor || []).map((row, index) => (
                      <tr key={`${row.vendor}-${index}`}>
                        <th>{row.vendor}</th>
                        <td>{formatTableNumber(row.leads)}</td>
                        <td>{formatTableNumber(row.delivered)}</td>
                        <td>{pct(row.delivered, row.leads)}</td>
                        <td>{formatTableNumber(row.dialled)}</td>
                        <td>{pct(row.dialled, row.delivered)}</td>
                        <td>{formatTableNumber(row.contacted)}</td>
                        <td>{pct(row.contacted, row.dialled)}</td>
                        <td>{formatTableNumber(row.sales)}</td>
                        <td>{pct(row.sales, row.contacted)}</td>
                        <td>{formatTableNumber(row.activations)}</td>
                        <td>{pct(row.activations, row.sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {controls.data && <SlaBandsPanel data={controls.data} />}

            <div className="cx-command-grid cx-diagnostic-grid">
              <section className="cx-command-panel">
                <header>
                  <div>
                    <span className="cx-command-section-kicker">Acquisition</span>
                    <h2>Source → outcome</h2>
                    <p>Fetched volume with RPC and sale yield for each source.</p>
                  </div>
                </header>
                <div className="cx-segment-bars">
                  {(data.bySource || []).map((row, index) => (
                    <div key={`${row.source}-${index}`} className="cx-segment-row">
                      <div>
                        <strong>{row.source}</strong>
                        <small>{formatTableNumber(row.leads)} leads</small>
                      </div>
                      <div className="cx-segment-track"><i style={{ width: `${(row.leads / sourceMax) * 100}%` }}/></div>
                      <dl className="cx-segment-funnel-rates">
                        <div><dt>Delivery</dt><dd>{pct(row.delivered, row.leads)}</dd></div>
                        <div><dt>Dial</dt><dd>{pct(row.dialled, row.delivered)}</dd></div>
                        <div><dt>RPC</dt><dd>{pct(row.contacted, row.dialled)}</dd></div>
                        <div><dt>Sale</dt><dd>{pct(row.sales, row.leads, 2)}</dd></div>
                      </dl>
                    </div>
                  ))}
                </div>
              </section>

              <section className="cx-command-panel">
                <header>
                  <div>
                    <span className="cx-command-section-kicker">Quality</span>
                    <h2>Grade → outcome</h2>
                    <p>Test whether recorded lead grades are associated with stronger downstream results.</p>
                  </div>
                </header>
                <div className="cx-segment-bars">
                  {(data.byGrade || []).map((row, index) => (
                    <div key={`${row.grade}-${index}`} className="cx-segment-row">
                      <div>
                        <strong>{row.grade}</strong>
                        <small>{formatTableNumber(row.leads)} leads</small>
                      </div>
                      <div className="cx-segment-track"><i style={{ width: `${(row.leads / gradeMax) * 100}%` }}/></div>
                      <dl className="cx-segment-funnel-rates">
                        <div><dt>Delivery</dt><dd>{pct(row.delivered, row.leads)}</dd></div>
                        <div><dt>Dial</dt><dd>{pct(row.dialled, row.delivered)}</dd></div>
                        <div><dt>RPC</dt><dd>{pct(row.contacted, row.dialled)}</dd></div>
                        <div><dt>Sale</dt><dd>{pct(row.sales, row.leads, 2)}</dd></div>
                      </dl>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="cx-command-shortcuts">
              <Link to={scoped('/speed-to-lead')}><Clock3 size={16}/><span><strong>Contact timing</strong><small>Diagnose first-dial latency and age cohorts</small></span><ArrowRight size={14}/></Link>
              <Link to={scoped('/vendor-quality')}><GitFork size={16}/><span><strong>Performance</strong><small>Compare vendor, source and quality outcomes</small></span><ArrowRight size={14}/></Link>
              <button type="button" onClick={handleExportCsv}><Download size={16}/><span><strong>Export funnel</strong><small>Download current scoped breakdown</small></span><ArrowRight size={14}/></button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
