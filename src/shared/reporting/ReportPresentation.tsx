import React, { createContext, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';
import AnalysisGuide, { type AnalysisContext } from '../../components/AnalysisGuide';
import Modal from '../../components/Modal';

// Presentation slots keep the router's evidence query and each page's export
// callback in their existing owners while placing their controls in the header.
const ReportPresentationContext = createContext<{
  statusTarget: HTMLDivElement | null;
  exportTarget: HTMLDivElement | null;
  setStatusTarget: (element: HTMLDivElement | null) => void;
  setExportTarget: (element: HTMLDivElement | null) => void;
}>({ statusTarget: null, exportTarget: null, setStatusTarget: () => {}, setExportTarget: () => {} });

export function ReportPresentationProvider({ children }: { children: React.ReactNode }) {
  const [statusTarget, setStatusTarget] = useState<HTMLDivElement | null>(null);
  const [exportTarget, setExportTarget] = useState<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ statusTarget, exportTarget, setStatusTarget, setExportTarget }), [statusTarget, exportTarget]);
  return <ReportPresentationContext.Provider value={value}>{children}</ReportPresentationContext.Provider>;
}

export function StatusPresentation({ children }: { children: React.ReactNode }) {
  const { statusTarget } = useContext(ReportPresentationContext);
  return statusTarget ? createPortal(children, statusTarget) : <div className="cx-report-status-fallback">{children}</div>;
}

/** Receive the existing status control without taking ownership of its source query. */
export function ReportStatusSlot() {
  const { setStatusTarget } = useContext(ReportPresentationContext);
  return <div ref={setStatusTarget} className="cx-report-status-slot" />;
}

export function ExportPresentation({ children }: { children: React.ReactNode }) {
  const { exportTarget } = useContext(ReportPresentationContext);
  return exportTarget ? createPortal(children, exportTarget) : <div className="cx-report-export-fallback">{children}</div>;
}

export function DataStatusDialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const scoped = useScopedNavigationTarget();
  return open ? createPortal(<Modal open onClose={onClose} label="Data status" className="cx-data-status-dialog">
    <header className="cx-analysis-dialog-heading"><div><h2>Data status</h2><p>Source evidence, coverage and validation</p></div><button type="button" className="cx-icon-button" onClick={onClose} aria-label="Close data status"><X size={18} /></button></header>
    <div className="cx-analysis-dialog-content">{children}<p>Operational analytics are separate from immutable published reporting releases.</p><Link to={scoped('/reports')} onClick={onClose}>View evidence releases</Link></div>
  </Modal>, document.body) : null;
}

export function ReportActions({ children, statusEvidence, aboutContent, analysisContext }: { children?: React.ReactNode; statusEvidence?: React.ReactNode; aboutContent?: React.ReactNode; analysisContext?: AnalysisContext }) {
  const { setExportTarget } = useContext(ReportPresentationContext);
  const [open, setOpen] = useState(false);
  const scoped = useScopedNavigationTarget();
  return <div className="cx-report-actions">
    <details className="cx-report-more" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary>More actions</summary><div>{children}<AnalysisGuide additionalContent={aboutContent} analysisContext={analysisContext} /><div ref={setExportTarget} className="cx-report-export-slot" /></div></details>
    {statusEvidence ? <>
      <button type="button" className="cx-button-secondary cx-data-status-trigger" data-tone="unknown" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Info size={14} aria-hidden="true" />Data status · Not verified</button>
      <DataStatusDialog open={open} onClose={() => setOpen(false)}>{statusEvidence}<Link className="cx-button-secondary" to={scoped('/data-integrity')} onClick={() => setOpen(false)}>Inspect data evidence</Link></DataStatusDialog>
    </> : <ReportStatusSlot />}
  </div>;
}
