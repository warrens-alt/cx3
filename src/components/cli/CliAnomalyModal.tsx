import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { CliPerformanceResponse } from '../../../contracts/cliPerformance';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

interface CliAnomalyModalProps {
  isOpen: boolean;
  onClose: () => void;
  anomalies?: CliPerformanceResponse['anomalies'];
}

export const CliAnomalyModal: React.FC<CliAnomalyModalProps> = ({
  isOpen,
  onClose,
  anomalies,
}) => {
  const dialogRef = useDialogAccessibility<HTMLDivElement>(Boolean(isOpen && anomalies && anomalies.length > 0), onClose);

  if (!isOpen || !anomalies || anomalies.length === 0) return null;

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
        aria-label="Data Quality & Validation Anomalies"
        className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 space-y-4 animate-scaleUp"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-600" />
            <span>Data Quality &amp; Validation Anomalies</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-rose-500 rounded-sm"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-600">
          The mathematical validation engine flagged the following integrity issues during schema and count derivation:
        </p>

        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs space-y-2">
          {anomalies.map((anom, i) => (
            <div key={i} className="pt-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 font-mono">{anom.cli}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    anom.severity === 'CRITICAL'
                      ? 'bg-rose-100 text-rose-800'
                      : anom.severity === 'WARNING'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {anom.severity}
                </span>
              </div>
              <p className="text-slate-600 mt-1">{anom.message}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="cx-button-primary text-xs py-1.5 px-4"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
