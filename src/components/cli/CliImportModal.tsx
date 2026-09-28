import React, { useEffect, useState } from 'react';
import { Upload, X, CheckCircle2, FileSpreadsheet, FileText, Database, History } from 'lucide-react';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import { useClient } from '../../lib/ClientContext';

interface CliImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  uploading: boolean;
  uploadError: string | null;
  uploadSuccess: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onLoadSample: () => Promise<void>;
}
interface ArchiveStatus {
  configured: boolean; active: boolean; rowCount: number; reportCount: number; dates: string[];
  earliestReportDate?: string | null; latestReportDate?: string | null; updatedAt?: string | null;
  maxUploadBytes: number; historyTruncated?: boolean;
  imports: { id: string; filename: string; importedAt: string; insertedCount: number; duplicateCount: number; startDate: string; endDate: string }[];
}
interface ArchiveState { tenant: string; loading: boolean; data: ArchiveStatus | null; error: string | null }

export const CliImportModal: React.FC<CliImportModalProps> = ({
  isOpen, onClose, isAdmin, uploading, uploadError, uploadSuccess, fileInputRef, onFileUpload, onLoadSample,
}) => {
  const { selectedClient, clientConfig } = useClient();
  const dialogRef = useDialogAccessibility<HTMLDivElement>(Boolean(isOpen && isAdmin), onClose);
  const [archive, setArchive] = useState<ArchiveState | null>(null);
  const [approvedTenant, setApprovedTenant] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  useEffect(() => { setApprovedTenant(null); setFileError(null); }, [isOpen, selectedClient]);
  useEffect(() => {
    if (!isOpen || !isAdmin || uploading) return;
    const controller = new AbortController();
    setArchive({ tenant: selectedClient, loading: true, data: null, error: null });
    const params = new URLSearchParams({ clientId: selectedClient });
    void (async () => {
      try {
        const response = await fetch(`/api/analytics/cli-performance/import/history?${params}`, {
          signal: controller.signal, cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Could not read import history.');
        if (typeof payload.data?.configured !== 'boolean' || !Array.isArray(payload.data.imports)) throw new Error('The archive returned an unexpected response.');
        if (!controller.signal.aborted) setArchive({ tenant: selectedClient, loading: false, data: payload.data, error: null });
      } catch (error) {
        if (!controller.signal.aborted) setArchive({ tenant: selectedClient, loading: false, data: null,
          error: error instanceof Error ? error.message : 'Could not read import history.' });
      }
    })();
    return () => controller.abort();
  }, [isOpen, isAdmin, selectedClient, uploading]);
  if (!isOpen || !isAdmin) return null;
  const scoped = archive?.tenant === selectedClient ? archive : null;
  const status = scoped?.data;
  const ready = status?.configured === true && !scoped?.loading && !scoped?.error;
  const confirmed = approvedTenant === selectedClient;
  const canUpload = ready && confirmed && !uploading;
  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (!canUpload) { event.target.value = ''; return; }
    const file = event.target.files?.[0];
    if (file && file.size > (status?.maxUploadBytes || 48 * 1024)) {
      setFileError('CSV files must be 48 KiB or smaller. Split a larger historical export into smaller files.');
      event.target.value = ''; return;
    }
    await onFileUpload(event);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Import VICIdial CLI Report"
        className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-scaleUp">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><Upload size={18} className="text-[#315BCB]" /><span>Import VICIdial CLI Report</span></h3>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-slate-400 hover:text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-[#315BCB] rounded-sm"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Add a daily CLI export to the private archive for <strong>{clientConfig?.name || selectedClient}</strong>.
          Earlier dates are retained. Identical rows are skipped; conflicting replacements are rejected.
          These are imported reports, not a live dialler connection.
        </p>
        <section aria-label="Private archive status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
          <strong className="flex items-center gap-2 text-slate-800"><Database size={15} />Private report archive</strong>
          {!scoped || scoped.loading ? <p role="status">Checking storage and reporting history…</p> : scoped.error ?
            <p role="alert" className="text-rose-800">{scoped.error}</p> : !status?.configured ?
              <p>Storage is not configured. Set <code>CX_CLI_IMPORT_BUCKET</code> on the server using approved private storage before uploading. No dialler access is needed.</p> : <>
                <p>{status.rowCount.toLocaleString()} saved rows · {status.reportCount.toLocaleString()} accepted uploads · {status.dates.length} reporting dates</p>
                <p>Latest report date: <strong>{status.latestReportDate || 'No reports yet'}</strong>. This is the date inside the report, not a live-data freshness guarantee.</p>
                {!status.active && status.rowCount > 0 ? <p>Imported reporting is paused. Upload an existing or new report to resume; saved history remains intact.</p> : null}
              </>}
        </section>
        {(uploadError || fileError) ? <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded text-xs">{fileError || uploadError}</div> : null}
        {uploadSuccess ? <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded text-xs flex items-center gap-2"><CheckCircle2 size={16} /><span>{uploadSuccess} Duplicate uploads add no rows.</span></div> : null}
        <label className="flex gap-2 items-start text-xs text-slate-700">
          <input type="checkbox" checked={confirmed} disabled={!ready || uploading}
            onChange={event => setApprovedTenant(event.target.checked ? selectedClient : null)} className="mt-0.5" />
          <span>I am authorised to store and analyse this report in CX3, and its data belongs to <strong>{clientConfig?.name || selectedClient}</strong>. I will not upload a combined report containing other clients.</span>
        </label>
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center space-y-2">
          <FileSpreadsheet size={32} className="mx-auto text-slate-400" />
          <label className={`cx-button-primary text-xs py-1.5 px-3 inline-block ${canUpload ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
            <span>{uploading ? 'Saving report…' : 'Browse CSV File'}</span>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" disabled={!canUpload} />
          </label>
          <p className="text-[11px] text-slate-500">
            Required: <code className="text-slate-700">report_date, cli_number, campaign_code, total_calls, contact_count, sale_count</code>.<br />
            Optional aggregate metrics include ASR, answered calls, duration thresholds, vendor and average lead age. Missing values remain unavailable. Customer-level columns are rejected. Maximum CSV size: 48 KiB.
          </p>
        </div>
        {status?.imports.length ? <section aria-label="Recent CLI imports" className="text-xs space-y-2">
          <h4 className="flex items-center gap-2 font-semibold text-slate-800"><History size={15} />Recent imports{status.historyTruncated ? ' (latest 20)' : ''}</h4>
          <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {status.imports.map(receipt => <div key={receipt.id} className="p-2.5 space-y-1">
              <p className="font-medium text-slate-800 break-words">{receipt.filename}</p>
              <p className="text-slate-600">{receipt.startDate} → {receipt.endDate} · {receipt.insertedCount} new rows · {receipt.duplicateCount} duplicates skipped</p>
              <p className="text-slate-500">Saved {new Date(receipt.importedAt).toLocaleString()}</p>
            </div>)}
          </div>
        </section> : null}
        {(import.meta as any).env?.DEV === true && status?.configured === false ? <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
          <div><strong className="text-xs text-slate-900">Synthetic development dataset</strong><p className="text-[11px] text-slate-500">Never written to the private archive or treated as production evidence.</p></div>
          <button type="button" onClick={onLoadSample} disabled={uploading} className="cx-button-secondary text-xs py-1.5 px-3 whitespace-nowrap flex items-center gap-1.5"><FileText size={13} /><span>Load sample</span></button>
        </div> : null}
        <div className="flex justify-end pt-2"><button type="button" onClick={onClose} className="cx-button-secondary text-xs py-1.5 px-4">Close</button></div>
      </div>
    </div>
  );
};
