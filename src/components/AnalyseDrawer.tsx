import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, ArrowRight, Layers, BarChart2, Table, RefreshCw, AlertCircle } from 'lucide-react';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { useClient } from '../lib/ClientContext';
import { useFilters } from '../lib/FilterContext';
import DataAuditDrawer from './DataAuditDrawer';

interface AnalyseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  metric: string;
  metricLabel: string;
}

export default function AnalyseDrawer({ isOpen, onClose, metric, metricLabel }: AnalyseDrawerProps) {
  const { clientConfig } = useClient();
  const { filters } = useFilters();
  const [activeDimension, setActiveDimension] = useState<'source' | 'vendor' | 'routing_depth' | 'medium'>('source');
  const [drillAuditOpen, setDrillAuditOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const { data: driverData, loading, error } = useAnalyticsData<any>(
    '/drivers',
    {
      metric: metric === 'revenue' ? 'revenue' : metric === 'leads' ? 'leads' : 'activations',
      dimension: activeDimension
    }
  );

  if (!isOpen) return null;

  const rows = driverData?.data || [];
  const currency = clientConfig?.currency || 'R';

  const formatValue = (val: number) => {
    if (metric.toLowerCase().includes('revenue')) {
      return `${currency}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
    return val.toLocaleString();
  };

  const handleDrillSegment = (segment: string) => {
    setSelectedSegment(segment);
    setDrillAuditOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-3xl bg-surface border-l border-border shadow-2xl h-full flex flex-col animate-slide-left">
        {/* Header */}
        <div className="p-6 border-b border-border bg-surface-sec flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-teal px-2 py-0.5 rounded bg-teal/10">
                Contextual Analysis & Driver Decomposition
              </span>
            </div>
            <h2 className="text-xl font-bold text-text-main mt-1">Why Did {metricLabel} Change?</h2>
            <p className="text-xs text-text-sec mt-0.5">
              Deterministic driver decomposition across active dimensions comparing selected period against prior baseline.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-mute hover:text-text-main rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dimension Selector Tabs */}
        <div className="px-6 pt-4 border-b border-border flex items-center gap-2 bg-surface">
          <span className="text-xs font-medium text-text-sec mr-2">Decompose By:</span>
          {(['source', 'vendor', 'routing_depth', 'medium'] as const).map(dim => (
            <button
              key={dim}
              onClick={() => setActiveDimension(dim)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                activeDimension === dim
                  ? 'border-teal text-teal bg-teal/5'
                  : 'border-transparent text-text-sec hover:text-text-main'
              }`}
            >
              {dim === 'source' ? 'Lead Source' : dim === 'vendor' ? 'Vendor Attribution' : dim === 'routing_depth' ? 'Routing Depth' : 'Traffic Medium'}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-text-sec space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-teal" />
              <p className="text-sm">Decomposing variance across {activeDimension} in BigQuery...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Could not compute driver decomposition for this dimension.</span>
            </div>
          ) : (
            <>
              {/* Summary Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-text-sec">Analyzed Period Scope</div>
                  <div className="text-sm font-semibold text-text-main mt-0.5">
                    {driverData?.daysCompared || 30}-day window comparison
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-text-sec">Top Measurable Driver</div>
                  <div className="text-sm font-semibold text-teal mt-0.5">
                    {rows[0]?.segment || 'N/A'} ({rows[0]?.pctChange >= 0 ? '+' : ''}{rows[0]?.pctChange || 0}%)
                  </div>
                </div>
              </div>

              {/* Drivers Breakdown Table */}
              <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                <div className="px-4 py-3 bg-surface-sec border-b border-border flex justify-between items-center">
                  <span className="text-xs font-semibold text-text-main uppercase tracking-wider">
                    Ranked Measurable Contributors ({rows.length})
                  </span>
                  <span className="text-xs text-text-sec">Click row to audit underlying leads</span>
                </div>
                <table className="enterprise-table w-full text-xs">
                  <thead>
                    <tr>
                      <th>Segment</th>
                      <th className="text-right">Current Period</th>
                      <th className="text-right">Prior Period</th>
                      <th className="text-right">Absolute Change</th>
                      <th className="text-right">% Impact</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r: any, idx: number) => {
                      const isUp = r.change > 0;
                      const isDown = r.change < 0;
                      return (
                        <tr 
                          key={idx} 
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => handleDrillSegment(r.segment)}
                        >
                          <td className="font-semibold text-text-main py-2.5 px-3">
                            <span className="inline-block" title={r.segment}>
                              {r.segment}
                            </span>
                          </td>
                          <td className="text-right py-2.5 px-3 font-mono font-medium">{formatValue(r.current)}</td>
                          <td className="text-right py-2.5 px-3 font-mono text-text-sec">{formatValue(r.previous)}</td>
                          <td className={`text-right py-2.5 px-3 font-mono font-semibold ${isUp ? 'text-semantic-pos' : isDown ? 'text-semantic-neg' : 'text-text-sec'}`}>
                            {isUp ? '+' : ''}{formatValue(r.change)}
                          </td>
                          <td className="text-right py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold ${isUp ? 'bg-emerald-100 text-emerald-800' : isDown ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>
                              {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : isDown ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                              {r.pctChange > 0 ? '+' : ''}{r.pctChange}%
                            </span>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDrillSegment(r.segment);
                              }}
                              className="text-xs text-teal hover:underline font-medium inline-flex items-center gap-1"
                            >
                              Audit <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-sec flex justify-between items-center">
          <span className="text-xs text-text-sec">Source: BigQuery vw_leads semantic layer</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
          >
            Close Analysis
          </button>
        </div>
      </div>

      {/* Drill-down Data Audit Drawer */}
      {drillAuditOpen && (
        <DataAuditDrawer
          isOpen={drillAuditOpen}
          onClose={() => setDrillAuditOpen(false)}
          title={`Underlying Records: ${activeDimension} = ${selectedSegment}`}
          contextFilters={{ [activeDimension]: { operator: 'equals', value: selectedSegment } }}
        />
      )}
    </div>
  );
}
