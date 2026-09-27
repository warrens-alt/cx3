import React from 'react';
import { Upload, X, CheckCircle2, FileSpreadsheet, Sparkles } from 'lucide-react';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

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

export const CliImportModal: React.FC<CliImportModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  uploading,
  uploadError,
  uploadSuccess,
  fileInputRef,
  onFileUpload,
  onLoadSample,
}) => {
  const dialogRef = useDialogAccessibility<HTMLDivElement>(Boolean(isOpen && isAdmin), onClose);

  if (!isOpen || !isAdmin) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Import VICIdial CLI Report"
        className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4 animate-scaleUp"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Upload size={18} className="text-[#315BCB]" />
            <span>Import VICIdial CLI Report</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-[#315BCB] rounded-sm"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Upload a VICIdial CLI performance export (.csv). Imported data is tenant-scoped and remains explicitly tagged as an imported report.
        </p>

        {uploadError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded text-xs">
            {uploadError}
          </div>
        )}

        {uploadSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded text-xs flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {/* Option A: Upload File */}
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center hover:border-[#315BCB] transition-colors space-y-2">
          <FileSpreadsheet size={32} className="mx-auto text-slate-400" />
          <div>
            <label className="cx-button-primary text-xs py-1.5 px-3 cursor-pointer inline-block">
              <span>Browse CSV File</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
          <p className="text-[11px] text-slate-500">
            Required columns: <code className="text-slate-700 font-semibold">report_date, cli_number, campaign_code, total_calls, contact_count, sale_count</code>.<br />
            Optional: <code className="text-slate-700">vendor, distinct_leads, asr_count, answered_count, duration_ge_1m_count, duration_ge_5m_count, duration_ge_15m_count, avg_duration_sec, avg_lead_age_days</code>. Missing optional metrics remain unavailable; CX3 never estimates them.
          </p>
        </div>

        {(import.meta as any).env?.DEV === true && (
          <>
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 uppercase">Development only</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <strong className="text-xs font-semibold text-slate-900 block">Synthetic benchmark dataset</strong>
                <p className="text-[11px] text-slate-500 mt-0.5">Available only in development. Never used as live production evidence.</p>
              </div>
              <button
                type="button"
                onClick={onLoadSample}
                disabled={uploading}
                className="cx-button-secondary text-xs py-1.5 px-3 whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <Sparkles size={13} className="text-[#315BCB]" />
                <span>Load sample</span>
              </button>
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="cx-button-secondary text-xs py-1.5 px-4"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
