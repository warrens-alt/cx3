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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--cx-overlay-backdrop)] p-4"
      onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Data Quality & Validation Anomalies"
        className="cx-cli-dialog bg-surface rounded-lg shadow-[var(--cx-shadow-elevated)] max-w-xl w-full max-h-[calc(100dvh-32px)] overflow-y-auto p-6 space-y-4 animate-scaleUp"
      >
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <h3 className="text-base font-bold text-text-main flex items-center gap-2">
            <AlertTriangle size={18} className="text-semantic-neg" />
            <span>Data Quality &amp; Validation Anomalies</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-text-mute hover:text-text-sec focus:outline-hidden focus:ring-2 focus:ring-action rounded-sm"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-text-sec">
          The mathematical validation engine flagged the following integrity issues during schema and count derivation:
        </p>

        <div className="max-h-72 overflow-y-auto divide-y divide-border-subtle text-xs space-y-2">
          {anomalies.map((anom, i) => (
            <div key={i} className="pt-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-main font-mono">{anom.cli}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    anom.severity === 'CRITICAL'
                      ? 'bg-semantic-neg-bg text-semantic-neg'
                      : anom.severity === 'WARNING'
                      ? 'bg-semantic-warn-bg text-semantic-warn'
                      : 'bg-selected-bg text-action'
                  }`}
                >
                  {anom.severity}
                </span>
              </div>
              <p className="text-text-sec mt-1">{anom.message}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-3 border-t border-border-subtle">
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
