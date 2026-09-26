import React from 'react';
import { X, Database, Calculator, Calendar, BookOpen, Layers, Target, Compass } from 'lucide-react';
import { getTaxonomyItem, MetricTaxonomyItem } from '../lib/taxonomy';

interface MetricLineageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  lineage: {
    itemNo?: number;
    formattedItemNo?: string;
    reportValue?: string;
    costMetric?: string;
    metric?: string;
    costMetricFormula?: string;
    waterfallMetricFormula?: string;
    revenueMetric?: string;
    costOfRevenueMetric?: string;
    costOfRevenueMetricFormula?: string;
    channel?: string;
    definition?: string;
    numerator?: string;
    denominator?: string;
    source?: string;
    refreshStrategy?: string;
    canonicalName?: string;
    [key: string]: any;
  };
  metadata?: any;
}

export default function MetricLineageDrawer({ isOpen, onClose, title, lineage, metadata }: MetricLineageDrawerProps) {
  if (!isOpen) return null;

  // Attempt to resolve official taxonomy item
  const taxItem: MetricTaxonomyItem | undefined =
    (lineage.itemNo ? getTaxonomyItem(lineage.itemNo) : undefined) ||
    (lineage.reportValue ? getTaxonomyItem(lineage.reportValue) : undefined) ||
    (lineage.canonicalName ? getTaxonomyItem(lineage.canonicalName) : undefined) ||
    (lineage.costMetric ? getTaxonomyItem(lineage.costMetric) : undefined) ||
    getTaxonomyItem(title);

  const itemNo = lineage.itemNo || taxItem?.itemNo;
  const formattedItemNo = lineage.formattedItemNo || taxItem?.formattedItemNo || (itemNo ? `Item 0${itemNo}.0` : undefined);
  const reportValue = lineage.reportValue || taxItem?.reportValue || title;
  const costMetric = lineage.costMetric || taxItem?.costMetric;
  const metricName = lineage.metric || taxItem?.metric;
  const costMetricFormula = lineage.costMetricFormula || taxItem?.costMetricFormula;
  const waterfallFormula = lineage.waterfallMetricFormula || taxItem?.waterfallMetricFormula;
  const goal = taxItem?.goal;
  const objective = taxItem?.objective;
  const channel = lineage.channel || taxItem?.channel;
  const revenueMetric = lineage.revenueMetric || taxItem?.revenueMetric;
  const costOfRevenue = lineage.costOfRevenueMetric || taxItem?.costOfRevenueMetric;

  return (
    <>
      <div className="fixed inset-0 bg-[#10283B]/20 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full md:w-[440px] bg-surface border-l border-border-strong shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
        <div className="p-6 border-b border-border-subtle flex justify-between items-center bg-surface-sec">
          <div>
            <div className="flex items-center gap-2">
              {formattedItemNo && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-brand-primary/10 text-brand-primary font-semibold">
                  {formattedItemNo}
                </span>
              )}
              {costMetric && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 font-semibold border border-amber-200">
                  {costMetric}
                </span>
              )}
            </div>
            <h2 className="text-section-title mt-1.5">{reportValue}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-border-subtle rounded-full text-text-sec hover:text-text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          
          {/* Official Taxonomy Specification Card */}
          {(costMetric || metricName || costMetricFormula || waterfallFormula) && (
            <div className="enterprise-card p-4 space-y-3 border-border-subtle bg-surface-sec/60">
              <h3 className="text-xs font-bold text-text-sec uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-brand-primary" /> Official Metric Taxonomy
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {metricName && (
                  <div className="col-span-2 bg-surface p-2.5 rounded border border-border-subtle">
                    <span className="text-text-mute block text-[10px] uppercase font-semibold">Standard Metric Name</span>
                    <span className="font-semibold text-text-main text-sm">{metricName}</span>
                  </div>
                )}
                {costMetric && (
                  <div className="bg-surface p-2.5 rounded border border-border-subtle">
                    <span className="text-text-mute block text-[10px] uppercase font-semibold">Cost Metric Code</span>
                    <span className="font-mono font-bold text-brand-primary">{costMetric}</span>
                  </div>
                )}
                {channel && (
                  <div className="bg-surface p-2.5 rounded border border-border-subtle">
                    <span className="text-text-mute block text-[10px] uppercase font-semibold">Channel Scope</span>
                    <span className="font-medium text-text-main truncate block">{channel}</span>
                  </div>
                )}
              </div>

              {costMetricFormula && (
                <div className="bg-surface p-2.5 rounded border border-border-subtle text-xs">
                  <span className="text-text-mute block text-[10px] uppercase font-semibold mb-1">Cost Metric Formula</span>
                  <code className="font-mono text-[11px] text-brand-navy block break-words">{costMetricFormula}</code>
                </div>
              )}

              {waterfallFormula && (
                <div className="bg-surface p-2.5 rounded border border-border-subtle text-xs">
                  <span className="text-text-mute block text-[10px] uppercase font-semibold mb-1">Waterfall Conversion Formula</span>
                  <code className="font-mono text-[11px] text-emerald-700 block break-words">{waterfallFormula}</code>
                </div>
              )}

              {(revenueMetric || costOfRevenue) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {revenueMetric && (
                    <div className="bg-surface p-2 rounded border border-border-subtle">
                      <span className="text-text-mute block text-[10px] uppercase font-semibold">Revenue Metric</span>
                      <span className="font-medium text-text-main">{revenueMetric}</span>
                    </div>
                  )}
                  {costOfRevenue && (
                    <div className="bg-surface p-2 rounded border border-border-subtle">
                      <span className="text-text-mute block text-[10px] uppercase font-semibold">Cost of Revenue</span>
                      <span className="font-medium text-text-main">{costOfRevenue}</span>
                    </div>
                  )}
                </div>
              )}

              {(goal || objective) && (
                <div className="pt-1 flex items-center gap-2 text-[11px] text-text-mute border-t border-border-subtle">
                  {goal && <span><strong className="text-text-sec">Goal:</strong> {goal}</span>}
                  {goal && objective && <span>&bull;</span>}
                  {objective && <span><strong className="text-text-sec">Stage:</strong> {objective}</span>}
                </div>
              )}
            </div>
          )}

          {lineage.definition && (
            <div>
              <h3 className="text-card-title mb-2">Definition</h3>
              <p className="text-sm text-text-main leading-relaxed">{lineage.definition}</p>
            </div>
          )}

          <div>
            <h3 className="text-card-title mb-3 flex items-center gap-1.5"><Calculator className="w-4 h-4" /> SQL Engine Calculation</h3>
            <div className="bg-surface-sec border border-border-subtle rounded-lg p-4 space-y-3 font-mono text-xs text-text-sec">
              {lineage.numerator && (
                <div>
                  <div className="text-text-mute mb-1 uppercase text-xs font-semibold">Numerator</div>
                  <div className="text-semantic-pos break-all">{lineage.numerator}</div>
                </div>
              )}
              {lineage.denominator && (
                <>
                  <div className="h-px bg-border-subtle w-full" />
                  <div>
                    <div className="text-text-mute mb-1 uppercase text-xs font-semibold">Denominator</div>
                    <div className="text-semantic-warn break-all">{lineage.denominator}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-card-title mb-3 flex items-center gap-1.5"><Database className="w-4 h-4" /> Data Lineage & Source</h3>
            <div className="enterprise-card p-4 space-y-2 text-sm">
              <div className="flex justify-between items-center gap-4">
                <span className="text-text-sec shrink-0">Primary View/Table</span>
                <span className="font-medium text-text-main font-mono text-xs">{lineage.source || 'vw_lead_lifecycle'}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-text-sec shrink-0">Refresh Strategy</span>
                <span className="font-medium text-text-main">{lineage.refreshStrategy || 'Materialized Query Cache'}</span>
              </div>
            </div>
          </div>

          {metadata && (
            <div>
              <h3 className="text-card-title mb-3 flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Query Execution Trace</h3>
              <div className="enterprise-card p-4 space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-text-sec">Last Refreshed</span>
                  <span className="font-medium text-text-main">{new Date().toLocaleTimeString()}</span>
                </div>
                {metadata.durationMs && (
                  <div className="flex justify-between">
                    <span className="text-text-sec">Execution Time</span>
                    <span className="font-medium text-text-main">{metadata.durationMs}ms</span>
                  </div>
                )}
                {metadata.source?.type && (
                  <div className="flex justify-between">
                    <span className="text-text-sec">Provider</span>
                    <span className="font-medium text-text-main capitalize">{metadata.source.type}</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
