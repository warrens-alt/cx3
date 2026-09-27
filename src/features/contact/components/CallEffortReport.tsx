import React from 'react';
import { Download, ExternalLink, Info, PhoneCall } from 'lucide-react';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import { GroupedOutcomeChart, VolumeRateComboChart } from '../../../components/charts/OperationalVisuals';
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
  onExportCsv?: () => void;
}

export default function CallEffortReport({
  data,
  onInspectBucket,
  onExportCsv,
}: CallEffortReportProps) {
  if (!data) return null;

  const summary = data.summary;

  return (
    <div className="space-y-6">
      {/* 1. Summary of Observed Population and Effort */}
      {summary && (
        <section aria-label="Contact governance summary" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
            <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
              Zero-call leads
            </span>
            <span className="text-2xl font-extrabold text-text-main cx-tabular mt-1 block">
              {formatTableNumber(summary.zeroCallLeads)}
            </span>
            <span className="text-[11px] text-text-sec mt-1 block">
              Explicitly recorded zero calls
            </span>
          </div>

          <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
            <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
              One-call share
            </span>
            <span className="text-2xl font-extrabold text-text-main cx-tabular mt-1 block">
              {formatPercent(summary.singleAttemptSharePct)}
            </span>
            <span className="text-[11px] text-text-sec mt-1 block">
              {formatTableNumber(summary.oneCallLeads)} leads · share of dialled
            </span>
          </div>

          <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
            <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
              Multi-call share
            </span>
            <span className="text-2xl font-extrabold text-text-main cx-tabular mt-1 block">
              {formatPercent(summary.multiAttemptSharePct)}
            </span>
            <span className="text-[11px] text-text-sec mt-1 block">
              {formatTableNumber(summary.multiAttemptLeads)} leads · 2+ calls
            </span>
          </div>

          <div className="p-4 bg-surface rounded-xl border border-border-subtle shadow-2xs">
            <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider block">
              5+ calls, no RPC
            </span>
            <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 cx-tabular mt-1 block">
              {formatTableNumber(summary.fivePlusNoRpcLeads)}
            </span>
            <span className="text-[11px] text-text-sec mt-1 block">
              High effort without contact
            </span>
          </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GroupedOutcomeChart
          title="Outcomes by total recorded calls"
          subtitle="Lead, RPC, sale and activation counts by exclusive recorded call-count bucket."
          data={data.attemptPerformance}
          xKey="bucket"
          series={[
            { key: 'leads', label: 'Leads' },
            { key: 'contacted', label: 'RPC' },
            { key: 'sales', label: 'Sales' },
            { key: 'activations', label: 'Activations' },
          ]}
        />
        <VolumeRateComboChart
          title="Observed yield by call-count bucket"
          subtitle="Lead volume is shown as bars; RPC, sale and activation rates remain descriptive associations, not a recommended stop-threshold model."
          data={data.attemptPerformance}
          xKey="bucket"
          volumeKey="leads"
          volumeLabel="Leads"
          rateSeries={[
            { key: 'contactRate', label: 'RPC rate' },
            { key: 'saleRate', label: 'Sale rate' },
            { key: 'activationRate', label: 'Activation rate' },
          ]}
        />
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-subtle/40 text-text-mute font-semibold">
                <th className="px-4 py-2.5">Call-Count Bucket</th>
                <th className="px-4 py-2.5 text-right">Leads</th>
                <th className="px-4 py-2.5 text-right">Share %</th>
                <th className="px-4 py-2.5 text-right">RPC (Contacted)</th>
                <th className="px-4 py-2.5 text-right">RPC / Dialled</th>
                <th className="px-4 py-2.5 text-right">Sales</th>
                <th className="px-4 py-2.5 text-right">Sale / Lead</th>
                <th className="px-4 py-2.5 text-right">Activations</th>
                <th className="px-4 py-2.5 text-right">Action</th>
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
