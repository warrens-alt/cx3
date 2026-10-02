import React from 'react';
import { X } from 'lucide-react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import DriverAnalysis from '../features/investigation/DriverAnalysis';

/** Compatibility drawer uses the same descriptive analysis as the investigation workspace. */
export default function RootCauseDrawer({ open, metric, metricLabel, onClose }: {
  open: boolean; metric: string | null; metricLabel?: string; onClose: () => void;
}) {
  const dialogRef = useDialogAccessibility<HTMLElement>(open, onClose);
  if (!open) return null;
  const title = metricLabel || metric || 'Selected metric';
  return <div className="cx-rootcause-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
    <aside ref={dialogRef} tabIndex={-1} className="cx-rootcause-drawer" role="dialog" aria-modal="true" aria-label={`Driver analysis: ${title}`}>
      <header><div><span>Investigation</span><h2>Driver analysis</h2></div><button type="button" onClick={onClose} aria-label="Close driver analysis"><X size={18} /></button></header>
      <DriverAnalysis metric={metric} metricLabel={metricLabel} onInspect={onClose} />
    </aside>
  </div>;
}
