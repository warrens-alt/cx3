import React from 'react';
import ContactCoverage from './ContactCoverage';
import CallEffortDistribution from './CallEffortDistribution';
import { Download, ExternalLink, Info, PhoneCall } from 'lucide-react';
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
  onInspectBucket?: (bucket: string, leads: number) => void;
  onWhyChanged?: (metricId: string) => void;
  onExportCsv?: () => void;
}

export default function CallEffortReport({
  data,
  onInspectBucket,
  onWhyChanged,
  onExportCsv,
}: CallEffortReportProps) {
  if (!data) return null;

  const summary = data.summary;

  return (
    <div className="cx-effort-report space-y-6">
      {summary && <ContactCoverage summary={summary} onInspectBucket={onInspectBucket} />}
      {/* 1. Summary of Observed Population and Effort */}
      {summary && (
        <section aria-label="Contact governance summary" className="cx-visual-metric-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <UnifiedMetricCard
            label="Zero-call leads"
            value={formatTableNumber(summary.zeroCallLeads)}
            note="Explicitly recorded zero calls"
            onWhyChanged={() => onWhyChanged?.('dialRate')}
            onInspect={onInspectBucket ? () => onInspectBucket('0 calls', summary.zeroCallLeads) : undefined}
            inspectLabel="Inspect bucket"
            onAbout={onInspectBucket ? () => onInspectBucket('0 calls', summary.zeroCallLeads) : undefined}
          />

          <UnifiedMetricCard
            label="One-call share"
            value={formatPercent(summary.singleAttemptSharePct)}
            note={`${formatTableNumber(summary.oneCallLeads)} leads · share of dialled`}
            denominatorLabel="Dialled leads"
            onWhyChanged={() => onWhyChanged?.('dialRate')}
            onInspect={onInspectBucket ? () => onInspectBucket('1 call', summary.oneCallLeads) : undefined}
            inspectLabel="Inspect bucket"
            onAbout={onInspectBucket ? () => onInspectBucket('1 call', summary.oneCallLeads) : undefined}
          />

          <UnifiedMetricCard
            label="Multi-call share"
            value={formatPercent(summary.multiAttemptSharePct)}
            note={`${formatTableNumber(summary.multiAttemptLeads)} leads · 2+ calls`}
            denominatorLabel="Dialled leads"
            onWhyChanged={() => onWhyChanged?.('contactRate')}
            onInspect={onInspectBucket ? () => onInspectBucket('2-4 calls', summary.multiAttemptLeads) : undefined}
            inspectLabel="Inspect bucket"
            onAbout={onInspectBucket ? () => onInspectBucket('2-4 calls', summary.multiAttemptLeads) : undefined}
          />

          <UnifiedMetricCard
            label="5+ calls, no RPC"
            value={formatTableNumber(summary.fivePlusNoRpcLeads)}
            note="High effort without contact"
            denominatorLabel="Dialled outreach"
            onWhyChanged={() => onWhyChanged?.('contactRate')}
            onInspect={onInspectBucket ? () => onInspectBucket('5+ calls', summary.fivePlusNoRpcLeads) : undefined}
            inspectLabel="Inspect bucket"
            onAbout={onInspectBucket ? () => onInspectBucket('5+ calls', summary.fivePlusNoRpcLeads) : undefined}
          />
        </section>
      )}

      {/* Unrecorded & Descriptive Note */}
      {summary && summary.unrecordedCallLeads > 0 && (
        <div className="p-3 bg-surface-sec border border-border-subtle rounded-lg text-xs text-text-sec flex items-center gap-2">
          <Info size={14} className="text-brand-primary shrink-0" />
          <span>
            <strong>{formatTableNumber(summary.unrecordedCallLeads)} leads</strong> have unrecorded call counts and are shown separately from verified zero-call leads.
          </span>
        </div>
      )}

      <p className="text-xs text-text-sec italic">
        Observed yield by call-count bucket: descriptive, not a recommended stop-threshold model. Call effort reflects cumulative counters and does not infer sequential dialing attempts.
      </p>

      {/* 2. Visual Outcome Charts */}
      <div className="cx-effort-chart-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CallEffortDistribution rows={data.attemptPerformance} onInspectBucket={onInspectBucket} />
        <div className="cx-effort-yield-scroll" role="region" aria-label="Call-count yield chart. Scroll horizontally on narrow screens." tabIndex={0}>
        <VolumeRateComboChart
          title="Observed yield by call-count bucket"
          subtitle="Lead volume is shown as bars; RPC, sale and activation rates remain descriptive associations, not a recommended stop-threshold model."
          data={data.attemptPerformance}
          xKey="bucket"
          volumeKey="leads"
          volumeLabel="Leads"
          onSelect={onInspectBucket ? (bucket, row) => onInspectBucket(bucket, row.leads) : undefined}
          rateSeries={[
            { key: 'contactRate', label: 'RPC rate', color: 'var(--cx-data-rpc)' },
            { key: 'saleRate', label: 'Sale rate', color: 'var(--cx-data-sales)' },
            { key: 'activationRate', label: 'Activation rate', color: 'var(--cx-data-activation)' },
          ]}
        />
        </div>
      </div>

      {/* 3. Supporting Effort Distribution Table */}
      <div className="bg-surface rounded-xl border border-border-subtle overflow-hidden">
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
                <th scope="col" className="px-4 py-2.5 text-right">Action</th>
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
                    {formatPercent(row.saleRate)}
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
                        Inspect
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
