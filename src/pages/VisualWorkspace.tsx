import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import React, { useState, useMemo } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import VisualPlot from '../components/visuals/VisualPlot';
import { useDevice } from '../hooks/useDevice';
import type { VisualKind, Measure, VisualPoint } from '../lib/visuals/model';

const MEASURES: Measure[] = [
  { id: 'leads', label: 'Captured Leads', unit: 'records' },
  { id: 'deliveries', label: 'Delivered Episodes', unit: 'records' },
  { id: 'calls', label: 'Call Attempts', unit: 'records' },
  { id: 'sales', label: 'Recorded Sales', unit: 'records' },
  { id: 'activations', label: 'Activated Policies', unit: 'records' },
];

export default function VisualWorkspace() {
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

  // This catalogue has no connected analytical dataset. Never manufacture chart values.
  const points: VisualPoint[] = [];

  return (
    <AnalyticsPageLayout className="cx-visual-catalogue-page" title="Visual workspace" header={<PageHeader
        title="Visual workspace"
        subtitle="Chart presentation catalogue. No analytical dataset is connected to this page."
        badges={[
          { label: `Chart: ${kind}`, variant: 'neutral' },
          { label: 'Analytics unavailable', variant: 'neutral' },
        ]}
      />}>

      <section className="enterprise-card p-3 sm:p-4 space-y-2" aria-label="Visual catalogue evidence" data-state="unavailable">
        <h2 className="text-sm font-semibold">Analytics unavailable</h2>
        <p className="text-sm">No measurements are available in this catalogue. The controls select chart presentation only; they do not query a workspace or reporting period.</p>
        <p className="text-sm">Use the existing analytical pages for returned observations and their source evidence. Missing values remain unavailable.</p>
      </section>

      <div className="enterprise-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <SlidersHorizontal className="w-4 h-4 text-text-mute shrink-0" />
          <span className="text-xs font-semibold text-text-sec">Measure:</span>
          <select
            aria-label="Catalogue measure"
            value={selectedMeasure}
            onChange={(e) => setSelectedMeasure(e.target.value)}
            className="text-xs bg-surface border border-control-border rounded px-2.5 py-1.5 font-medium text-text-main min-h-[34px] flex-1 sm:flex-initial"
          >
            {MEASURES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-surface-sec p-1 rounded-lg overflow-x-auto scrollbar-none">
          {(['column', 'bar', 'line', 'area', 'donut'] as VisualKind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded capitalize transition shrink-0 min-h-[30px] ${
                kind === k ? 'bg-surface  text-action font-semibold' : 'text-text-sec hover:text-text-main'
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
        <div className="enterprise-card p-3 sm:p-4 bg-selected-bg border-action/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-text-main">
          <div>
            <strong>Selected Point:</strong> {inspectedPoint.label} — <span>{measure.label}: </span>
            <span className="font-mono font-bold">{inspectedPoint.exact}</span>
          </div>
          <button
            onClick={() => setInspectedPoint(null)}
            className="cx-button-secondary self-start sm:self-auto"
          >
            Clear Selection
          </button>
        </div>
      )}
    </AnalyticsPageLayout>
  );
}
