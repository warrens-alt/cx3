import ExportAnalysisButton from '../components/ExportAnalysisButton';
import type { LifecycleExtension } from '../../contracts/lifecycleAnalytics';
import { LifecycleSegmentsPanel } from '../components/LifecycleDiagnostics';
import { useOperationalData } from '../lib/useOperationalData';
import React, { useMemo, useState } from 'react';
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
import { StackedCompositionChart, VolumeRateComboChart } from '../components/charts/OperationalVisuals';
import UnifiedMetricCard from '../components/UnifiedMetricCard';
import RootCauseDrawer from '../components/RootCauseDrawer';
import VendorComparison from '../features/vendors/components/VendorComparison';
import '../styles/journeyContactVisuals.css';
import '../styles/trustQualityVisuals.css';

import { formatPercent, formatTableNumber } from '../lib/formatters';

const fmt = formatTableNumber;

export default function VendorLeadQuality() {
  const scoped = useScopedNavigationTarget();
  const controls = useOperatingControls();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters, setFilter } = useFilters();
  const [rootMetric, setRootMetric] = useState<string | null>(null);
  const [rootMetricLabel, setRootMetricLabel] = useState<string | undefined>(undefined);

  const { data, loading, error, loadData } = useOperationalData<VendorQualityData & LifecycleExtension & { vendorGrades?: Array<{vendor:string;grade:string;leads:number}>; qualityEvidence?:string }>('VendorLeadQuality', {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }, fetchVendorQuality);

  const vendorSummary = useMemo(() => {
    const list = data?.vendors || [];
    if (!list.length) return null;
    const totalLeads = list.reduce((sum, v) => sum + (v.leads || 0), 0);
    const totalWeightedContact = list.reduce((sum, v) => sum + (v.leads || 0) * (v.contactRate || 0), 0);
    const totalWeightedSale = list.reduce((sum, v) => sum + (v.leads || 0) * (v.saleRate || 0), 0);
    const totalWeightedActivation = list.reduce((sum, v) => sum + (v.leads || 0) * (v.activationRate || 0), 0);
    const avgContactRate = totalLeads > 0 ? totalWeightedContact / totalLeads : null;
    const avgSaleRate = totalLeads > 0 ? totalWeightedSale / totalLeads : null;
    const avgActivationRate = totalLeads > 0 ? totalWeightedActivation / totalLeads : null;
    const medians = list.map(v => v.medianFirstDialSec).filter((s): s is number => s != null && s > 0);
    medians.sort((a, b) => a - b);
    const medianFirstDialMin = medians.length > 0 ? (medians[Math.floor(medians.length / 2)] / 60).toFixed(1) : null;
    return {
      totalLeads,
      avgContactRate,
      avgSaleRate,
      avgActivationRate,
      medianFirstDialMin,
      vendorCount: list.length,
    };
  }, [data?.vendors]);

  const vendorGradeVisual = useMemo(() => {
    const rows = data?.vendorGrades || [];
    if (!rows.length) return { data: [] as Array<Record<string, any>>, series: [] as Array<{key:string;label:string}> };

    const vendorTotals = new Map<string, number>();
    const gradeTotals = new Map<string, number>();
    const matrix = new Map<string, Map<string, number>>();
    for (const row of rows) {
      vendorTotals.set(row.vendor, (vendorTotals.get(row.vendor) || 0) + row.leads);
      gradeTotals.set(row.grade, (gradeTotals.get(row.grade) || 0) + row.leads);
      if (!matrix.has(row.vendor)) matrix.set(row.vendor, new Map());
      const vendorGrades = matrix.get(row.vendor)!;
      vendorGrades.set(row.grade, (vendorGrades.get(row.grade) || 0) + row.leads);
    }

    const vendors = [...vendorTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name]) => name);
    const grades = [...gradeTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name]) => name);
    const chartRows = vendors.map(vendor => {
      const total = vendorTotals.get(vendor) || 0;
      const row: Record<string, any> = { vendor };
      grades.forEach((grade, index) => {
        const count = matrix.get(vendor)?.get(grade) || 0;
        row[`grade_${index}`] = total > 0 ? (count / total) * 100 : 0;
      });
      return row;
    });
    return {
      data: chartRows,
      series: grades.map((grade, index) => ({ key: `grade_${index}`, label: grade })),
    };
  }, [data?.vendorGrades]);

  const vendorOutcomeVisual = useMemo(() => [...(data?.vendors || [])]
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 12)
    .map(row => ({
      vendor: row.vendor,
      leads: row.leads,
      contactRate: row.contactRate,
      saleRate: row.saleRate,
      activationRate: row.activationRate,
    })), [data?.vendors]);

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
    <div className="cx-command-page cx-trust-workspace" aria-label="Vendor quality workspace">
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

        <nav className="cx-viz-jump-nav" aria-label="Vendor quality sections"><a href="#vendor-comparison">Compare vendors</a><a href="#vendor-speed">Speed & contact</a><a href="#source-performance">Source performance</a><a href="#quality-signals">Grade & vetting</a></nav>
        {error && <div className="cx-command-error"><AlertTriangle size={17} />{error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner" />Loading performance analysis…</div>}

        {data && (
          <>
            {vendorSummary && (
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6" aria-label="Vendor performance summary">
                <UnifiedMetricCard
                  label="Captured Demand"
                  value={formatTableNumber(vendorSummary.totalLeads)}
                  note={`${vendorSummary.vendorCount} active vendors`}
                  onWhyChanged={() => {
                    setRootMetric('fetchedLeads');
                    setRootMetricLabel('Vendor Lead Volume');
                  }}
                  to={scoped('/funnel')}
                  inspectLabel="Inspect funnel"
                />

                <UnifiedMetricCard
                  label="Median First Dial"
                  value={vendorSummary.medianFirstDialMin ? `${vendorSummary.medianFirstDialMin}m` : '—'}
                  note="Delivery to dial latency"
                  onWhyChanged={() => {
                    setRootMetric('dialRate');
                    setRootMetricLabel('Speed to First Dial');
                  }}
                  to={scoped('/speed-to-lead')}
                  inspectLabel="Inspect speed"
                />

                <UnifiedMetricCard
                  label="Contact Rate (RPC)"
                  value={vendorSummary.avgContactRate != null ? formatPercent(vendorSummary.avgContactRate) : '—'}
                  note="Volume-weighted RPC"
                  onWhyChanged={() => {
                    setRootMetric('contactRate');
                    setRootMetricLabel('Vendor Contact Rate');
                  }}
                  to={scoped('/contact-strategy')}
                  inspectLabel="Inspect contact"
                />

                <UnifiedMetricCard
                  label="Lead → Sale Rate"
                  value={vendorSummary.avgSaleRate != null ? formatPercent(vendorSummary.avgSaleRate) : '—'}
                  note="Downstream sales / leads"
                  onWhyChanged={() => {
                    setRootMetric('leadToSaleRate');
                    setRootMetricLabel('Vendor Sale Rate');
                  }}
                  to={scoped('/sales-activation')}
                  inspectLabel="Inspect sales"
                />

                <UnifiedMetricCard
                  label="Activation Rate"
                  value={vendorSummary.avgActivationRate != null ? formatPercent(vendorSummary.avgActivationRate) : '—'}
                  note="Fulfilled / recorded sales"
                  onWhyChanged={() => {
                    setRootMetric('activationRate');
                    setRootMetricLabel('Vendor Activation Rate');
                  }}
                  to={scoped('/sales-activation')}
                  inspectLabel="Inspect activations"
                />
              </section>
            )}

            <VendorComparison key={JSON.stringify([selectedClient, startDate, endDate, filters])} vendors={data.vendors}
              onSelectVendor={vendor => setFilter('vendor', { operator: 'in', values: [vendor] })} />
            <div className="cx-analytics-visual-grid">
              {vendorGradeVisual.data.length > 0 && <StackedCompositionChart
                title="Vendor grade composition"
                subtitle="100% composition of recorded grades within each vendor's observed lead population."
                data={vendorGradeVisual.data}
                categoryKey="vendor"
                series={vendorGradeVisual.series}
              />}
            </div>

            {data.lifecycle && <LifecycleSegmentsPanel data={data.lifecycle} />}
            {data.vendorGrades && <section className="cx-command-panel"><header><div><h2>Vendor grade distribution</h2><p>{data.qualityEvidence}</p></div><ExportAnalysisButton filename="vendor_grade_distribution" rows={[["Vendor","Grade","Leads"], ...data.vendorGrades.map(r=>[r.vendor,r.grade,r.leads])]} definitions={[data.qualityEvidence || 'Lead/vendor grain']} /></header><div className="cx-performance-table-wrap"><table className="cx-performance-table"><thead><tr><th>Vendor</th><th>Grade</th><th>Leads</th></tr></thead><tbody>{data.vendorGrades.map(r => <tr key={`${r.vendor}-${r.grade}`}><th>{r.vendor}</th><td>{r.grade}</td><td>{fmt(r.leads)}</td></tr>)}</tbody></table></div></section>}

            <section className="cx-command-panel" id="vendor-speed">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Diagnose</span>
                  <h2>Vendor operating matrix</h2>
                  <p>Median delivery-to-first-dial speed versus RPC / dialled. Bubble size represents fetched lead volume.</p>
                </div>
              </header>

              {scatter.length ? (
                <div className="cx-performance-scatter">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60}>
                    <ScatterChart margin={{ top: 18, right: 28, bottom: 32, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--cx-border-subtle)" />
                      <XAxis
                        type="number"
                        dataKey="firstDialMinutes"
                        name="Median first dial"
                        unit="m"
                        tick={{ fontSize: 10, fill: 'var(--cx-text-muted)' }}
                        label={{ value: 'Median delivery → first dial (minutes)', position: 'insideBottom', offset: -20, fontSize: 10, fill: 'var(--cx-text-muted)' }}
                      />
                      <YAxis
                        type="number"
                        dataKey="rpcRate"
                        name="RPC rate"
                        unit="%"
                        tick={{ fontSize: 10, fill: 'var(--cx-text-muted)' }}
                        label={{ value: 'RPC / dialled (%)', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'var(--cx-text-muted)' }}
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
                      <Scatter data={scatter} fill="var(--cx-action)" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="cx-command-empty">Measured first-dial latency and RPC rate are both required for this chart.</div>}
            </section>

            {controls.data && <VendorControlsPanel data={controls.data} />}

            <section className="cx-command-panel" id="source-performance">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Acquisition quality</span>
                  <h2>Source performance through the funnel</h2>
                  <p>Lead volume alone is not enough: compare delivery, dial coverage, RPC, sales and invalid-rate outcomes for every source.</p>
                </div>
              </header>
              <div className="cx-performance-table-wrap" role="region" aria-label="Source performance through the funnel" tabIndex={0}>
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

            <div className="cx-command-grid cx-quality-grid" id="quality-signals">
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

      <RootCauseDrawer
        open={Boolean(rootMetric)}
        metric={rootMetric}
        metricLabel={rootMetricLabel}
        onClose={() => {
          setRootMetric(null);
          setRootMetricLabel(undefined);
        }}
      />
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
