import ChartTooltip from '../shared/visuals/ChartTooltip';
import TelemetryRail from '../shared/visuals/TelemetryRail';
import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import { ReportSkeleton } from '../components/OperationalState';
import TablePreview from '../shared/reporting/TablePreview';
import { ReportActions } from '../shared/reporting/ReportPresentation';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import type { LifecycleExtension } from '../../contracts/lifecycleAnalytics';
import { LifecycleSegmentsPanel } from '../components/LifecycleDiagnostics';
import { useOperationalData } from '../lib/useOperationalData';
import React, { useEffect, useMemo, useState } from 'react';
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
import InspectorHost, { type InspectorContent } from '../shared/evidence/InspectorHost';
import { AuditMetadata } from '../shared/evidence/AuditMode';
import { suppliedProvenance, vendorAudit } from '../features/evidenceWorkspace/secondaryAudit';
import VendorComparison from '../features/vendors/components/VendorComparison';
import '../styles/journeyContactVisuals.css';
import '../styles/trustQualityVisuals.css';
import '../styles/acquisitionEvidenceVisuals.css';

import { formatPercent, formatTableNumber } from '../lib/formatters';

const fmt = formatTableNumber;

export default function VendorLeadQuality() {
  const scoped = useScopedNavigationTarget();
  const controls = useOperatingControls();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters, setFilter } = useFilters();
  const [audit, setAudit] = useState<InspectorContent | null>(null);
  const auditScope = { clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined, filters };
  useEffect(() => setAudit(null), [selectedClient, startDate, endDate, filters]);

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
    return {
      totalLeads,
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
    <AnalyticsPageLayout className="cx-trust-workspace" ariaLabel="Vendor quality workspace" title="Vendor quality" description={<>Compare vendor execution and downstream evidence.</>} actions={<ReportActions>
            <Link to={scoped('/campaigns')} className="cx-button-secondary">Campaigns & spend</Link>
            <Link to={scoped('/commercial')} className="cx-button-secondary">Commercial</Link>
</ReportActions>} scope={<OffernetFilterBar onRefresh={async () => { await Promise.all([loadData(true), controls.refetch()]); }} />}>

        {error && <div className="cx-command-error"><AlertTriangle size={17} />{error}</div>}
        {loading && !data && <ReportSkeleton label="Loading performance analysis" metricCount={1} />}

        {data && (
          <>
            {vendorSummary && (
              <TelemetryRail label="Vendor performance summary" className="cx-vendor-telemetry">
                <UnifiedMetricCard
                  label="Lead counts across vendor groups"
                  value={formatTableNumber(vendorSummary.totalLeads)}
                  note={`${vendorSummary.vendorCount} active vendors`}
                  onInspect={() => setAudit({ type: 'metric', title: 'Captured demand across vendor groups', value: vendorSummary.totalLeads, scope: auditScope, definition: { meaning: 'Sum of the returned vendor lead counts. Vendor populations can overlap, so this is not the distinct workspace fetched-lead count.', grain: 'Lead within vendor group', dateBasis: 'Lead intake cohort', nullMeaning: 'Missing vendor results do not establish zero demand.' }, provenance: suppliedProvenance(data), detailLimitation: 'No distinct portfolio record population is supplied for this sum.' })}
                  inspectLabel="Inspect evidence"
                />

                <p className="cx-vendor-scope-note">Vendor groups may overlap. Portfolio rates and latency are unavailable.</p>
              </TelemetryRail>
            )}

            <AuditMetadata grain="Lead within vendor group" dateBasis="Lead intake cohort" validationStatus={suppliedProvenance(data).validationStatus} />
            <VendorComparison key={JSON.stringify([selectedClient, startDate, endDate, filters])} vendors={data.vendors}
              onSelectVendor={vendor => setFilter('vendor', { operator: 'in', values: [vendor] })}
              onInspectVendor={(vendor, measure) => setAudit(vendorAudit(vendor, measure, auditScope, data))} />
            <details className="cx-evidence-disclosure"><summary>View grade composition and lifecycle evidence</summary>
            <div className="cx-analytics-visual-grid">
              {vendorGradeVisual.data.length > 0 && <StackedCompositionChart
                title="Vendor grade composition"
                subtitle="Top 8 grades across the 10 largest vendors. Shares use all recorded grades per vendor; omitted grades can leave a remainder. All returned categories are in the table below."
                data={vendorGradeVisual.data}
                categoryKey="vendor"
                series={vendorGradeVisual.series}
              />}
            </div>

            {data.lifecycle && <LifecycleSegmentsPanel data={data.lifecycle} />}
            {data.vendorGrades && <section className="cx-command-panel"><header><div><h2>Vendor grade distribution</h2><p>{data.qualityEvidence}</p></div><ExportAnalysisButton filename="vendor_grade_distribution" rows={[["Vendor","Grade","Leads"], ...data.vendorGrades.map(r=>[r.vendor,r.grade,r.leads])]} definitions={[data.qualityEvidence || 'Lead/vendor grain']} /></header><TablePreview rows={data.vendorGrades} label="vendor grade rows">{visibleRows => <div className="cx-performance-table-wrap"><table className="cx-performance-table"><thead><tr><th>Vendor</th><th>Grade</th><th>Leads</th></tr></thead><tbody>{visibleRows.map(r => <tr key={`${r.vendor}-${r.grade}`}><th>{r.vendor}</th><td>{r.grade}</td><td>{fmt(r.leads)}</td></tr>)}</tbody></table></div>}</TablePreview></section>}

            </details>
            <section className="cx-command-panel" id="vendor-speed">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Diagnose</span>
                  <h2>Observed response speed and contact</h2>
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
                          return <ChartTooltip title={point.vendor} rows={[
                            { label: 'Fetched leads', value: fmt(point.volume) },
                            { label: 'Median first dial', value: `${point.firstDialMinutes}m` },
                            { label: 'RPC / dialled', value: formatPercent(point.rpcRate) },
                            { label: 'Sale / RPC', value: formatPercent(point.saleRate) },
                          ]} />;
                        }}
                      />
                      <Scatter data={scatter} fill="var(--cx-action)" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="cx-command-empty">Measured first-dial latency and RPC rate are both required for this chart.</div>}
            </section>

            <details className="cx-evidence-disclosure"><summary>View source, quality and operating evidence</summary>
            {controls.data && <VendorControlsPanel data={controls.data} />}

            <section className="cx-command-panel" id="source-performance">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Acquisition quality</span>
                  <h2>Source performance through the funnel</h2>
                  <p>Lead volume alone is not enough: compare delivery, dial coverage, RPC, sales and invalid-rate outcomes for every source.</p>
                </div>
              </header>
              <TablePreview rows={data.sources} label="source rows">{visibleRows => <div className="cx-performance-table-wrap" role="region" aria-label="Source performance through the funnel" tabIndex={0}>
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
                      <th>Invalid</th><th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((source, index) => (
                      <tr key={`${source.source}-${index}`}>
                        <th>{source.source}</th>
                        <td>{fmt(source.leads)}</td>
                        <td>{formatPercent(source.deliveryRate)}</td>
                        <td>{formatPercent(source.dialRate)}</td>
                        <td>{formatPercent(source.contactRate)}</td>
                        <td>{formatPercent(source.leadToSaleRate)}</td>
                        <td>{formatPercent(source.activationRate)}</td>
                        <td>{formatPercent(source.invalidRate)}</td><td><button type="button" className="cx-button-secondary" onClick={() => setAudit({ type: 'segment', metricId: 'fetched_leads', title: `${source.source} · fetched leads`, value: source.leads, scope: auditScope, provenance: suppliedProvenance(data), recordDrill: { drill: 'lifecycle-source', drillValue: source.source }, reportPath: '/vendor-quality', relatedValue: { label: 'Recorded sales', value: source.sales } })}>Inspect</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}</TablePreview>
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
            </details>
          </>
        )}

      <InspectorHost open={Boolean(audit)} onClose={() => setAudit(null)} content={audit} />
    </AnalyticsPageLayout>
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
        <BarChart3 size={16} className="text-text-muted" />
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
