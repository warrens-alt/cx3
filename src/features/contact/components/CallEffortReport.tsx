import React from 'react';
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
  if (!data) return null;

  const summary = data.summary;
  const audit = (title: string, value: string, extra: Partial<InspectorContent> = {}): InspectorContent => ({
    type: 'metric', title, value, scope,
    definition: { meaning: title, grain: 'Distinct lead', dateBasis: 'Lead capture cohort', nullMeaning: 'Missing counters remain Unrecorded; they are separate from explicitly recorded zero calls.', calculation: data.methodology || 'Exclusive call-count buckets describe the maximum non-negative recorded HLC total_calls per lead.' },
    ...extra,
  });

  return (
    <div className="cx-effort-report space-y-6">
      {/* 1. Summary of Observed Population and Effort */}
      {summary && (
        <section aria-label="Contact governance summary" className="cx-visual-metric-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
        </section>
      )}

      {/* 2. Visual Outcome Charts */}
      <div className="cx-contact-hero">
        <CallEffortDistribution rows={data.attemptPerformance} onInspectBucket={onInspectBucket} />
      </div>
      {summary && <ContactCoverage summary={summary} onInspectBucket={onInspectBucket} />}
      <details className="cx-contact-evidence-disclosure">
        <summary>Compare volume and downstream yield</summary>
        <div className="cx-effort-yield-scroll" role="region" aria-label="Call-count yield chart. Scroll horizontally on narrow screens." tabIndex={0}>
          <VolumeRateComboChart
            title="Observed yield by call-count bucket"
            subtitle="RPC, sale and activation rates describe associations, not recommended stop thresholds or the outcome of a particular attempt."
            data={data.attemptPerformance}
            xKey="bucket"
            volumeKey="leads"
            volumeLabel="Leads"
            onSelect={onInspectBucket ? (bucket, row) => onInspectBucket(bucket, row.leads) : undefined}
            rateSeries={[
              { key: 'contactRate', label: 'RPC rate', color: lifecyclePresentation.rpc.color },
              { key: 'saleRate', label: 'Sale rate', color: lifecyclePresentation.sales.color },
              { key: 'activationRate', label: 'Activation rate', color: lifecyclePresentation.activated.color },
            ]}
          />
        </div>
      </details>

      {/* Exact evidence remains immediately available. */}
      <details className="cx-contact-evidence-disclosure">
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
                <th scope="col" className="px-4 py-2.5 text-right">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-main">
              {data.attemptPerformance.map((row) => (
                <tr key={row.bucket} className="hover:bg-surface-subtle/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-text-main">
                    {row.bucket}
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
                  <td className="px-4 py-3 text-right cx-tabular font-semibold text-brand-primary">
                    {formatPercent(row.saleRate, 2)}
                  </td>
                  <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                    {formatTableNumber(row.activations)}
                  </td>
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
    </div>
  );
}
