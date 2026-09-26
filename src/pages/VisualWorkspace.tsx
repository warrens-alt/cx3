import React, { useState, useMemo } from 'react';
import { BarChart3, LineChart, PieChart, Activity, SlidersHorizontal } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import VisualPlot from '../components/visuals/VisualPlot';
import { useFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { useDevice } from '../hooks/useDevice';
import type { VisualKind, Measure, VisualPoint } from '../lib/visuals/model';

const MEASURES: Measure[] = [
  { id: 'leads', label: 'Captured Leads', unit: 'records' },
  { id: 'deliveries', label: 'Delivered Episodes', unit: 'records' },
  { id: 'calls', label: 'Call Attempts', unit: 'records' },
  { id: 'sales', label: 'Verified Sales', unit: 'records' },
  { id: 'activations', label: 'Activated Policies', unit: 'records' },
];

export default function VisualWorkspace() {
  const { startDate, endDate } = useFilters();
  const { clientId } = useClient();
  const device = useDevice();
  const [kind, setKind] = useState<VisualKind>('column');
  const [selectedMeasure, setSelectedMeasure] = useState<string>('leads');
  const [inspectedPoint, setInspectedPoint] = useState<VisualPoint | null>(null);

  const measure = useMemo(() => MEASURES.find(m => m.id === selectedMeasure) || MEASURES[0], [selectedMeasure]);

  // Dynamic plot height based on screen size & orientation
  const plotHeight = useMemo(() => {
    if (device.isMobile) {
      return device.orientation === 'landscape' ? 220 : 280;
    }
    if (device.isTablet) return 320;
    return 380;
  }, [device.isMobile, device.isTablet, device.orientation]);

  // Demo synthetic points representing active tenant range
  const points: VisualPoint[] = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day, i) => ({
      key: `d-${i}`,
      label: day,
      value: Math.floor(120 + Math.sin(i) * 60 + i * 20),
      exact: String(Math.floor(120 + Math.sin(i) * 60 + i * 20)),
      categoryKey: day,
    }));
  }, [measure]);

  return (
    <div className="cx-page space-y-4 sm:space-y-6 p-3 sm:p-6">
      <PageHeader
        title="Visual Analytics Workspace"
        subtitle="Dynamic chart exploration across multidimensional business dimensions and telemetry."
        badges={[
          { label: `Chart: ${kind}`, variant: 'neutral' },
          { label: `Range: ${startDate} to ${endDate}`, variant: 'neutral' },
        ]}
      />

      <div className="enterprise-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <SlidersHorizontal className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-700">Measure:</span>
          <select
            value={selectedMeasure}
            onChange={(e) => setSelectedMeasure(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 font-medium text-slate-800 min-h-[34px] flex-1 sm:flex-initial"
          >
            {MEASURES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto scrollbar-none">
          {(['column', 'bar', 'line', 'area', 'donut'] as VisualKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded capitalize transition shrink-0 min-h-[30px] ${
                kind === k ? 'bg-white shadow-xs text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="enterprise-card p-3 sm:p-6 overflow-hidden">
        <VisualPlot
          points={points}
          kind={kind}
          metric={measure}
          height={plotHeight}
          onInspect={(p) => setInspectedPoint(p)}
        />
      </div>

      {inspectedPoint && (
        <div className="enterprise-card p-3 sm:p-4 bg-blue-50 border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-900">
          <div>
            <strong>Selected Point:</strong> {inspectedPoint.label} — <span>{measure.label}: </span>
            <span className="font-mono font-bold">{inspectedPoint.exact}</span>
          </div>
          <button
            onClick={() => setInspectedPoint(null)}
            className="px-2.5 py-1 bg-white border border-blue-200 rounded text-blue-700 hover:bg-blue-100 self-start sm:self-auto min-h-[30px]"
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
}
