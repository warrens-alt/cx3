import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Modal from '../../components/Modal';
import './exportPreflight.css';

export type EvidenceField = { label: string; value: string };

// Presentation only: read returned evidence, never substitute the current controls
// for absent result metadata or prepare/modify the exported data.
export function returnedEvidenceFields(result: Record<string, any>): EvidenceField[] {
  const metadata = result.metadata || {};
  const value = (key: string) => result[key] !== undefined ? result[key] : metadata[key];
  const fields: EvidenceField[] = [];
  const add = (label: string, entry: unknown) => {
    if (entry !== undefined && entry !== null && entry !== '') fields.push({ label, value: String(entry) });
  };
  add('Workspace / client', value('clientId'));
  const start = value('startDate'), end = value('endDate');
  if (start !== undefined && end !== undefined) {
    add('Period', `${start === null ? 'No lower date bound' : start} → ${end === null ? 'No upper date bound' : end}`);
  }
  const filters = result.filters !== undefined ? result.filters : metadata.appliedFilters !== undefined ? metadata.appliedFilters : metadata.filters;
  if (filters && typeof filters === 'object' && !Array.isArray(filters)) {
    const entries = Object.entries(filters);
    add('Filters', entries.length ? entries.map(([key, condition]) => `${key}: ${typeof condition === 'object' ? JSON.stringify(condition) : String(condition)}`).join('\n') : 'No active filters');
  }
  add('Search', value('search'));
  add('Investigation', value('drill'));
  add('Investigation value', value('drillValue'));
  add('Date basis', value('dateBasis'));
  add('Validation status', value('validationStatus'));
  add('Counting grain', value('countingGrain'));
  add('Generated at', value('generatedAt'));
  return fields;
}

export default function EvidenceExportPreflight({ open, onClose, onConfirm, fields, children }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fields: EvidenceField[];
  children: React.ReactNode;
}) {
  if (!open) return null;
  return createPortal(<Modal open onClose={onClose} label="Export current evidence" className="cx-evidence-export-dialog">
    <header><div><h2>Export current evidence</h2><p>Review the returned scope and existing export format.</p></div><button type="button" className="cx-icon-button" aria-label="Close export review" onClick={onClose}><X size={18} /></button></header>
    <div className="cx-evidence-export-content">
      <section aria-label="Export contents">{children}</section>
      {fields.length > 0 && <dl>{fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>}
      <p>Only metadata supplied with this result is shown. Generated time does not establish source freshness. Existing export validation still applies.</p>
    </div>
    <footer><button type="button" className="cx-button-secondary" onClick={onClose}>Cancel</button><button type="button" className="cx-button-primary" onClick={() => { onClose(); onConfirm(); }}>Download CSV</button></footer>
  </Modal>, document.body);
}
