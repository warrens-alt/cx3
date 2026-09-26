import { useOperationalData } from '../lib/useOperationalData';
import React, { useMemo } from 'react';
import { AlertTriangle, ArrowRight, BarChart3, ShieldCheck } from 'lucide-react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchVendorQuality, type VendorQualityData } from '../lib/offernetClient';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import { useOperatingControls } from '../hooks/useOperatingControls';
import { VendorControlsPanel } from '../components/OfferNetControlPanels';

import { formatPercent, formatTableNumber } from '../lib/formatters';

const fmt = formatTableNumber;

export default function VendorLeadQuality() {
  const scoped = useScopedNavigationTarget();
  const controls = useOperatingControls();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();

  const { data, loading, error, loadData } = useOperationalData<VendorQualityData>('VendorLeadQuality', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchVendorQuality);

  const scatter = useMemo(
    () => (data?.vendors || [])
      .filter(vendor => vendor.medianFirstDialSec != null && vendor.contactRate != null)
      .map(vendor => ({
        vendor: vendor.vendor,
        firstDialMinutes: Number((vendor.medianFirstDialSec! / 60).toFixed(1)),
        rpcRate: vendor.contactRate,
        volume: vendor.leads,
        saleRate: vendor.saleRate,
      })),
    [data?.vendors],
  );

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={async () => { await Promise.all([loadData(true), controls.refetch()]); }} />
      <div className="cx-command-content">
        <header className="cx-command-hero">
          <div>
            <span className="cx-command-eyebrow">Performance</span>
            <h1>Vendors, sources and lead quality</h1>
            <p>Compare operational execution and test whether lead-quality signals are associated with better downstream outcomes.</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end items-center">
            <Link to={scoped('/campaigns')} className="cx-button-secondary">Campaigns & spend</Link>
            <Link to={scoped('/commercial')} className="cx-button-secondary">Commercial</Link>
            <Link to={scoped('/reports')} className="cx-trust-pill">
              <ShieldCheck size={15} />
              <span><strong>NOT_VERIFIED</strong><small>Observed operational metrics</small></span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </header>

        {error && <div className="cx-command-error"><AlertTriangle size={17} />{error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner" />Loading performance analysis…</div>}

        {data && (
          <>
            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Diagnose</span>
                  <h2>Vendor operating matrix</h2>
                  <p>Median delivery-to-first-dial speed versus RPC / dialled. Bubble size represents fetched lead volume.</p>
                </div>
              </header>

              {scatter.length ? (
                <div className="cx-performance-scatter">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 18, right: 28, bottom: 32, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" />
                      <XAxis
                        type="number"
                        dataKey="firstDialMinutes"
                        name="Median first dial"
                        unit="m"
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        label={{ value: 'Median delivery → first dial (minutes)', position: 'insideBottom', offset: -20, fontSize: 10, fill: '#64748B' }}
                      />
                      <YAxis
                        type="number"
                        dataKey="rpcRate"
                        name="RPC rate"
                        unit="%"
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        label={{ value: 'RPC / dialled (%)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748B' }}
                      />
                      <ZAxis type="number" dataKey="volume" range={[70, 600]} name="Lead volume" />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const point = payload[0].payload;
                          return (
                            <div className="cx-performance-tooltip">
                              <strong>{point.vendor}</strong>
                              <span>{fmt(point.volume)} leads</span>
                              <span>{point.firstDialMinutes}m median first dial</span>
                              <span>{formatPercent(point.rpcRate)} RPC / dialled</span>
                              <span>{formatPercent(point.saleRate)} sale / RPC</span>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={scatter} fill="#3562B3" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="cx-command-empty">Measured first-dial latency and RPC rate are both required for this chart.</div>}
            </section>

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Vendor detail</span>
                  <h2>Operational performance</h2>
                  <p>Stage rates remain separate so a slow vendor is not automatically interpreted as a low-quality vendor. A dash means the metric is unavailable for this scope.</p>
                </div>
              </header>
              <div className="cx-performance-table-wrap">
                <table className="cx-performance-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Leads</th>
                      <th>Delivery</th>
                      <th>Dial / delivered</th>
                      <th>RPC / dialled</th>
                      <th>Sale / RPC</th>
                      <th>Activation / sale</th>
                      <th>Median first dial</th>
                      <th>Calls / lead</th>
                      <th>Invalid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vendors.map((vendor, index) => (
                      <tr key={`${vendor.vendor}-${index}`}>
                        <th>{vendor.vendor}</th>
                        <td>{fmt(vendor.leads)}</td>
                        <td>{formatPercent(vendor.deliveryRate)}</td>
                        <td>{formatPercent(vendor.dialRate)}</td>
                        <td>{formatPercent(vendor.contactRate)}</td>
                        <td>{formatPercent(vendor.saleRate)}</td>
                        <td>{formatPercent(vendor.activationRate)}</td>
                        <td>{vendor.medianFirstDial}</td>
                        <td>{fmt(vendor.callsPerLead)}</td>
                        <td>{formatPercent(vendor.invalidRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {controls.data && <VendorControlsPanel data={controls.data} />}

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Acquisition quality</span>
                  <h2>Source performance through the funnel</h2>
                  <p>Lead volume alone is not enough: compare delivery, dial coverage, RPC, sales and invalid-rate outcomes for every source.</p>
                </div>
              </header>
              <div className="cx-performance-table-wrap">
                <table className="cx-performance-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Leads</th>
                      <th>Delivery</th>
                      <th>Dial / delivered</th>
                      <th>RPC / dialled</th>
                      <th>Sale / fetched</th>
                      <th>Activation / sale</th>
                      <th>Invalid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sources.map((source, index) => (
                      <tr key={`${source.source}-${index}`}>
                        <th>{source.source}</th>
                        <td>{fmt(source.leads)}</td>
                        <td>{formatPercent(source.deliveryRate)}</td>
                        <td>{formatPercent(source.dialRate)}</td>
                        <td>{formatPercent(source.contactRate)}</td>
                        <td>{formatPercent(source.leadToSaleRate)}</td>
                        <td>{formatPercent(source.activationRate)}</td>
                        <td>{formatPercent(source.invalidRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="cx-command-grid cx-quality-grid">
              <QualityOutcome
                title="Grade → outcome"
                description="Do higher lead grades actually produce better contact and sale outcomes?"
                rows={data.grades.map(row => ({ label: row.grade, ...row }))}
              />
              <QualityOutcome
                title="Vetting → outcome"
                description="Compare vetting groups against observed RPC, sale and activation behaviour."
                rows={data.vetting.map(row => ({ label: row.vetting_color, ...row }))}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QualityOutcome({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<{ label: string; leads: number; contactRate: number | null; leadToSaleRate: number | null; activationRate: number | null }>;
}) {
  return (
    <section className="cx-command-panel">
      <header>
        <div>
          <span className="cx-command-section-kicker">Quality signal</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <BarChart3 size={16} className="text-slate-400" />
      </header>
      <div className="cx-quality-outcomes">
        <div className="cx-quality-head">
          <span>Segment</span><span>Leads</span><span>RPC</span><span>Sale</span><span>Activation</span>
        </div>
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`}>
            <strong>{row.label}</strong>
            <span>{fmt(row.leads)}</span>
            <span>{formatPercent(row.contactRate)}</span>
            <span>{formatPercent(row.leadToSaleRate)}</span>
            <span>{formatPercent(row.activationRate)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
