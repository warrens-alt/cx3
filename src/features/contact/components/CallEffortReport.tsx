import React, { useRef, useState } from 'react';
import TelemetryRail from '../../../shared/visuals/TelemetryRail';
import type { AuditScope } from '../../../shared/evidence/auditPresentation';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';
import AuditEvidenceButton from '../../../shared/evidence/AuditEvidenceButton';
import ContactCoverage from './ContactCoverage';
import CallEffortDistribution from './CallEffortDistribution';
import { AlertTriangle, Database, Download, Repeat2 } from 'lucide-react';
import { lifecyclePresentation } from '../../../shared/visuals/lifecyclePresentation';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import { VolumeRateComboChart } from '../../../components/charts/OperationalVisuals';
import UnifiedMetricCard from '../../../components/UnifiedMetricCard';
import type { ContactStrategyData } from '../../../lib/offernetClient';

interface CallEffortReportProps {
  data?: Omit<ContactStrategyData, 'summary' | 'attemptPerformance'> & {
    attemptPerformance: Array<
      ContactStrategyData['attemptPerformance'][number] & { noRpc?: number; rpcUnrecorded?: number }
    >;
    summary?: ContactStrategyData['summary'] & { oneCallNoRpcLeads?: number; zeroCallNoRpcLeads?: number };
    effortEvidence?: { reason: string };
  };
  scope?: AuditScope;
  onInspectBucket?: (bucket: string, leads: number) => void;
  onWhyChanged?: (metricId: string) => void;
  onExportCsv?: () => void;
}

export default function CallEffortReport({
  data,
  scope,
  onInspectBucket,
  onWhyChanged,
  onExportCsv,
}: CallEffortReportProps) {
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidenceRef = useRef<HTMLDetailsElement>(null);
  if (!data) return null;
  const selectedRow = data.attemptPerformance.find(row => row.bucket === selectedBucket);
  const activeBucket = selectedRow?.bucket ?? null;

  const summary = data.summary;
  const audit = (title: string, value: string, extra: Partial<InspectorContent> = {}): InspectorContent => ({
    type: 'metric', title, value, scope,
    definition: { meaning: title, grain: 'Distinct lead', dateBasis: 'Lead capture cohort', nullMeaning: 'Missing counters remain Unrecorded; they are separate from explicitly recorded zero calls.', calculation: data.methodology || 'Exclusive call-count buckets describe the maximum non-negative recorded HLC total_calls per lead.' },
    ...extra,
  });

  return (
    <div className="cx-effort-report">
      {/* 1. Summary of Observed Population and Effort */}
      {summary && (
        <TelemetryRail label="Contact governance summary">
          <UnifiedMetricCard
            label="Dialled leads"
            icon={lifecyclePresentation.dialled.Icon}
            auditContent={audit('Dialled leads', formatTableNumber(summary.dialledLeads))}
            value={formatTableNumber(summary.dialledLeads)}
            note="Returned dialled population"
          />

          <UnifiedMetricCard
            label="Multi-call share"
            icon={Repeat2}
            auditContent={audit('Multi-call share', formatPercent(summary.multiAttemptSharePct), { numeratorCount: summary.multiAttemptLeads, numeratorLabel: 'Leads with two or more recorded calls', denominatorCount: summary.dialledLeads, denominatorLabel: 'Dialled leads', detailLimitation: 'A combined two-or-more-call record drill is not supplied by the existing drill route.' })}
            value={formatPercent(summary.multiAttemptSharePct)}
            note={`${formatTableNumber(summary.multiAttemptLeads)} leads · 2+ calls`}
            denominatorLabel="Dialled leads"
            onInspect={onInspectBucket ? () => onInspectBucket('2-4 calls', summary.multiAttemptLeads) : undefined}
            inspectLabel="Inspect evidence"
            onAbout={onInspectBucket ? () => onInspectBucket('2-4 calls', summary.multiAttemptLeads) : undefined}
          />

          <UnifiedMetricCard
            label="5+ calls, no RPC"
            icon={AlertTriangle}
            auditContent={audit('5+ calls, no RPC', formatTableNumber(summary.fivePlusNoRpcLeads), { recordDrill: { drill: 'high-attempt-no-rpc' } })}
            value={formatTableNumber(summary.fivePlusNoRpcLeads)}
            note="High effort without contact"
            denominatorLabel="Dialled outreach"
            onInspect={onInspectBucket ? () => onInspectBucket('5+ calls', summary.fivePlusNoRpcLeads) : undefined}
            inspectLabel="Inspect evidence"
            onAbout={onInspectBucket ? () => onInspectBucket('5+ calls', summary.fivePlusNoRpcLeads) : undefined}
          />
          <UnifiedMetricCard
            label="Call count unrecorded"
            icon={Database}
            auditContent={audit('Call count unrecorded', formatTableNumber(summary.unrecordedCallLeads))}
            value={formatTableNumber(summary.unrecordedCallLeads)}
            note="Separate from recorded zero calls"
            onInspect={onInspectBucket ? () => onInspectBucket('Unrecorded', summary.unrecordedCallLeads) : undefined}
            inspectLabel="Inspect unrecorded"
          />
        </TelemetryRail>
      )}

      {/* 2. Visual Outcome Charts */}
      <div className="cx-contact-analysis">
        <CallEffortDistribution rows={data.attemptPerformance} selectedBucket={activeBucket} onSelectBucket={setSelectedBucket} selection={selectedRow && <div className="cx-contact-selection" role="status" aria-live="polite">
          <div><span>Selected bucket</span><strong>{selectedRow.bucket}</strong></div>
          <dl><div><dt>Leads</dt><dd>{formatTableNumber(selectedRow.leads)}</dd></div><div><dt>RPC</dt><dd>{formatPercent(selectedRow.contactRate)}</dd></div><div><dt>Sale</dt><dd>{formatPercent(selectedRow.saleRate, 2)}</dd></div></dl>
          <div className="cx-contact-selection-actions"><button type="button" className="cx-button-secondary cx-contact-view-row" onClick={() => { setEvidenceOpen(true); requestAnimationFrame(() => evidenceRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })); }}>View table row</button>
            {onInspectBucket && <button type="button" className="cx-button-secondary" onClick={() => onInspectBucket(selectedRow.bucket, selectedRow.leads)}>Inspect selected bucket</button>}
            <button type="button" className="cx-button-text" onClick={() => setSelectedBucket(null)}>Clear selection</button></div>
        </div>} />
      </div>
      {summary && <details className="cx-contact-evidence-disclosure"><summary>Review call-count coverage</summary><ContactCoverage summary={summary} onInspectBucket={onInspectBucket} /></details>}
      <details className="cx-contact-evidence-disclosure">
        <summary>Compare volume and downstream yield</summary>
        <div className="cx-effort-yield-scroll" role="region" aria-label="Call-count yield chart. Scroll horizontally on narrow screens." tabIndex={0}>
          <VolumeRateComboChart
            title="Observed yield by call-count bucket"
            subtitle="Returned outcomes by recorded call count."
            data={data.attemptPerformance}
            xKey="bucket"
            volumeKey="leads"
            volumeLabel="Leads"
            onSelect={bucket => setSelectedBucket(bucket)}
            rateSeries={[
              { key: 'contactRate', label: 'RPC rate', color: lifecyclePresentation.rpc.color },
              { key: 'saleRate', label: 'Sale rate', color: lifecyclePresentation.sales.color },
              { key: 'activationRate', label: 'Activation rate', color: lifecyclePresentation.activated.color },
            ]}
          />
        </div>
      </details>

      {/* Exact evidence remains immediately available. */}
      <details ref={evidenceRef} className="cx-contact-evidence-disclosure" open={evidenceOpen} onToggle={event => setEvidenceOpen(event.currentTarget.open)}>
        <summary>View exact call-effort evidence</summary>
        {summary && <div className="p-4 flex items-center gap-2 text-xs text-text-sec">
          <span>One-call share: <strong>{formatPercent(summary.singleAttemptSharePct)}</strong> · {formatTableNumber(summary.oneCallLeads)} one-call leads / {formatTableNumber(summary.dialledLeads)} dialled leads</span>
          <AuditEvidenceButton content={audit('One-call share', formatPercent(summary.singleAttemptSharePct), { numeratorCount: summary.oneCallLeads, numeratorLabel: 'Leads with one recorded call', denominatorCount: summary.dialledLeads, denominatorLabel: 'Dialled leads', recordDrill: { drill: 'call-effort', drillValue: '1 call' } })} />
        </div>}
        <div className="p-4 border-b border-border-subtle bg-surface-sec flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-text-mute uppercase tracking-wider">
              Recorded Effort Performance
            </h3>
            <p className="text-xs text-text-sec mt-0.5">
              Exact bucket definitions with RPC, sale and activation yield.
            </p>
          </div>

          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-xs font-medium text-text-main hover:bg-surface-subtle transition-colors cursor-pointer"
            >
              <Download size={13} />
              <span>Export call effort</span>
            </button>
          )}
        </div>

        <div className="cx-viz-table-scroll overflow-x-auto" role="region" aria-label="Call effort evidence table" tabIndex={0}>
          <table className="cx-viz-table w-full text-left text-xs border-collapse"><caption className="sr-only">Recorded effort performance. Rates are associations within exclusive call-count buckets.</caption>
            <thead>
              <tr className="border-b border-border-subtle bg-surface-subtle/40 text-text-mute font-semibold">
                <th scope="col" className="px-4 py-2.5">Call-Count Bucket</th>
                <th scope="col" className="px-4 py-2.5 text-right">Leads</th>
                <th scope="col" className="px-4 py-2.5 text-right">Share %</th>
                <th scope="col" className="px-4 py-2.5 text-right">RPC (Contacted)</th>
                <th scope="col" className="px-4 py-2.5 text-right">RPC / Dialled</th>
                <th scope="col" className="px-4 py-2.5 text-right">Sales</th>
                <th scope="col" className="px-4 py-2.5 text-right">Sale / Lead</th>
                <th scope="col" className="px-4 py-2.5 text-right">Activations</th>
                <th scope="col" className="px-4 py-2.5 text-right">Independent activation / sale</th>
                <th scope="col" className="px-4 py-2.5 text-right">Explicit no RPC</th>
                <th scope="col" className="px-4 py-2.5 text-right">RPC unrecorded</th>
                <th scope="col" className="px-4 py-2.5 text-right">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-main">
              {data.attemptPerformance.map((row) => (
                <tr key={row.bucket} data-bucket={row.bucket} data-selected={activeBucket === row.bucket} data-muted={activeBucket !== null && activeBucket !== row.bucket} className="cx-contact-evidence-row">
                  <td className="px-4 py-3 font-semibold text-text-main">
                    <button type="button" className="cx-contact-bucket-select" aria-pressed={activeBucket === row.bucket} onClick={() => setSelectedBucket(row.bucket)} aria-label={`Select ${row.bucket} in call-effort visual`}>{row.bucket}{activeBucket === row.bucket && <small>Selected</small>}</button>
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular font-medium">
                    {formatTableNumber(row.leads)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                    {formatPercent(row.sharePct)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                    {formatTableNumber(row.contacted)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular font-medium text-text-main">
                    {formatPercent(row.contactRate)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular font-bold text-text-main">
                    {formatTableNumber(row.sales)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular font-semibold" style={{ color: lifecyclePresentation.sales.color }}>
                    {formatPercent(row.saleRate, 2)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                    {formatTableNumber(row.activations)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular">{formatPercent(row.activationRate)}</td>
                  <td className="px-4 py-3 text-right cx-tabular">{formatTableNumber(row.noRpc)}</td>
                  <td className="px-4 py-3 text-right cx-tabular">{formatTableNumber(row.rpcUnrecorded)}</td>
                  <td className="px-4 py-3 text-right">
                    {onInspectBucket && (
                      <button
                        type="button"
                        onClick={() => onInspectBucket(row.bucket, row.leads)}
                        className="px-2.5 py-1 text-[11px] font-medium text-brand-primary hover:bg-brand-soft rounded transition-colors cursor-pointer"
                      >
                        Inspect evidence
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="cx-contact-evidence-disclosure">
        <summary>Call-effort methodology</summary>
        <div className="cx-contact-methodology">
          <p>{data.methodology || 'Exclusive call-count buckets describe the maximum non-negative recorded HLC total_calls per lead.'}</p>
          {data.effortEvidence?.reason && <p>{data.effortEvidence.reason}</p>}
          {data.noAnswerAnalysis?.reason && <p>{data.noAnswerAnalysis.reason}</p>}
          <p>RPC and sale rates describe associations within each bucket, not the outcome of that particular attempt or a recommended stopping threshold.</p>
          <p>All returned buckets remain visible. Missing feedback is separate from recorded zero; unavailable rates have no bar. Selection highlights the same bucket locally and does not change reporting scope.</p>
        </div>
      </details>
    </div>
  );
}
