import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Copy, Eye } from 'lucide-react';
import { buildLedgerTimeline, formatLedgerDuration } from '../leadLedger/timeline';
import type { RawLeadsData } from '../../lib/offernetClient';
import LeadEvidenceSummary from './LeadEvidenceSummary';
import AnalyticalColumnManager from './AnalyticalColumnManager';
import AnalyticalParameterValue from './AnalyticalParameterValue';
import { analyticalParameter, discoverAnalyticalParameters, evidenceText, recordedRevenue, type AnalyticalParameter } from './analyticalParameters';
export { evidenceText, outcomeText, recordedRevenue } from './analyticalParameters';

export type InvestigationLead = RawLeadsData['rows'][number];
export type InvestigationRecordPreset = 'investigation' | 'journey' | 'contact' | 'outcomes' | 'full';
export const INVESTIGATION_RECORD_PRESETS: ReadonlyArray<{ value: InvestigationRecordPreset; label: string }> = [
  { value: 'investigation', label: 'Investigation' },
  { value: 'journey', label: 'Journey' },
  { value: 'contact', label: 'Contact' },
  { value: 'outcomes', label: 'Outcomes' },
  { value: 'full', label: 'Full analytical' },
];
export function inclusionReason(row: InvestigationLead, investigation?: string | null) {
  return typeof row.investigationReason?.label === 'string' && row.investigationReason.label
    ? row.investigationReason.label : investigation ? 'Inclusion explanation unavailable' : 'Matches reporting scope and applied filters';
}
export function leadDelay(row: InvestigationLead) {
  const journey = buildLedgerTimeline(row);
  const delivery = journey.milestones.find(event => event.kind === 'delivery');
  const dial = journey.milestones.find(event => event.kind === 'call');
  if (!delivery?.timestamp || !dial?.timestamp) return 'Time unavailable';
  const duration = Date.parse(dial.timestamp) - Date.parse(delivery.timestamp);
  return duration < 0 ? 'Timing anomaly' : formatLedgerDuration(duration);
}

const suppliedField = (...values: unknown[]) => evidenceText(values.find(value => value != null && value !== ''));

type Column = AnalyticalParameter & { value: (row: InvestigationLead) => React.ReactNode };
const curatedValues: Record<string, { label?: string; value: (row: InvestigationLead) => React.ReactNode }> = {
  lead_id: { label: 'Lead / current state', value: row => <div className="cx-record-evidence-identity"><strong className="cx-record-id">{row.lead_id}</strong><small>{buildLedgerTimeline(row).currentStage?.title || 'Stage unavailable'}</small><LeadEvidenceSummary row={row} compact /></div> },
  investigationReason: { value: () => null },
  source: { value: row => suppliedField(row.source, row.offershop_source) },
  '@delay': { label: 'Delivery → first dial', value: row => leadDelay(row) },
  grade: { value: row => suppliedField(row.grade, row.offershop_grade) },
  vetting: { value: row => suppliedField(row.vetting, row.offershop_color_vetting) },
  revenue: { value: row => recordedRevenue(row.revenue) },
};
const presets: Record<Exclude<InvestigationRecordPreset, 'full'>, string[]> = {
  investigation: ['lead_id', 'investigationReason', 'vendor', 'source', '@delay'],
  journey: ['lead_id', 'fetched', 'delivered_time', 'first_call_time', 'contacted', 'sale', 'activated'],
  contact: ['lead_id', 'first_call_time', 'total_calls', 'contacted', 'last_dialer_status', 'vendor'],
  outcomes: ['lead_id', 'contacted', 'sale', 'activated', 'revenue'],
};

export default function InvestigationRecordList({ rows, selectedLeadId, investigation, dossierId, observedAt, preset, onPresetChange, onSelect }: {
  rows: InvestigationLead[];
  selectedLeadId: string | null;
  investigation?: string | null;
  dossierId: string;
  observedAt?: string;
  preset?: InvestigationRecordPreset;
  onPresetChange?: (preset: InvestigationRecordPreset) => void;
  onSelect: (row: InvestigationLead, trigger: HTMLButtonElement) => void;
}) {
  const [localPreset, setLocalPreset] = useState<InvestigationRecordPreset>('investigation');
  const view = preset ?? localPreset;
  const viewLabel = INVESTIGATION_RECORD_PRESETS.find(option => option.value === view)!.label;
  const viewId = useId();
  const [customColumns, setCustomColumns] = useState<{ view: InvestigationRecordPreset; keys: string[] } | null>(null);
  const schema = useMemo(() => discoverAnalyticalParameters(rows), [rows]);
  const defaultKeys = useMemo(() => view === 'full' ? schema.map(field => field.key) : presets[view], [view, schema]);
  const availableFields = useMemo(() => {
    const fields = [...schema];
    for (const key of defaultKeys) if (!fields.some(field => field.key === key)) fields.push(key === '@delay' ? { ...analyticalParameter(key), label: 'Age / delay', group: 'timing' } : analyticalParameter(key));
    return fields;
  }, [schema, defaultKeys]);
  const selectedKeys = customColumns?.view === view ? customColumns.keys.filter(key => availableFields.some(field => field.key === key)) : defaultKeys;
  const wideTable = view === 'full' || selectedKeys.length > 10;
  const copyStatusId = useId();
  const copyRequest = useRef(0);
  const copyRows = useRef(rows);
  const [copyStatus, setCopyStatus] = useState<{ rows: InvestigationLead[]; leadId: string; state: 'copied' | 'failed' } | null>(null);
  const currentCopyStatus = copyStatus?.rows === rows ? copyStatus : null;
  useEffect(() => {
    if (copyRows.current !== rows) {
      copyRequest.current += 1;
      copyRows.current = rows;
      setCopyStatus(null);
    }
    return () => { copyRequest.current += 1; };
  }, [rows]);
  const columns: Column[] = selectedKeys.map(key => {
    const field = availableFields.find(item => item.key === key)!;
    if (view !== 'full' && Object.hasOwn(curatedValues, key)) return { ...field, ...curatedValues[key], label: key === '@delay' && view === 'investigation' ? 'Age / delay' : curatedValues[key].label || field.label };
    return { ...field, value: row => key === 'lead_id' ? <strong className="cx-record-id">{evidenceText(row.lead_id)}</strong> : <AnalyticalParameterValue row={row} field={field} /> };
  });
  const value = (column: Column, row: InvestigationLead) => {
    if (column.key === 'investigationReason' && view !== 'full') return <span title={row.investigationReason?.detail}>{inclusionReason(row, investigation)}</span>;
    if (column.key === '@delay' && view === 'investigation') {
      const journey = buildLedgerTimeline(row);
      const delivery = journey.milestones.find(event => event.kind === 'delivery');
      const dial = journey.milestones.find(event => event.kind === 'call');
      if (dial?.timestamp) return <span>To first dial: {leadDelay(row)}</span>;
      const elapsed = delivery?.timestamp && observedAt ? Date.parse(observedAt) - Date.parse(delivery.timestamp) : NaN;
      if (Number.isFinite(elapsed) && elapsed >= 0) return <span title={`Age at response generation: ${observedAt}`}>Delivery age: {formatLedgerDuration(elapsed)}</span>;
    }
    return column.value(row);
  };
  const selectButton = (row: InvestigationLead) => <button type="button" className="cx-record-open" data-lead-id={String(row.lead_id)} aria-pressed={selectedLeadId === String(row.lead_id)} aria-controls={dossierId} disabled={row.lead_id == null || row.lead_id === ''} onClick={event => onSelect(row, event.currentTarget)} aria-label={`Open dossier for lead ${row.lead_id}`}><Eye size={14} aria-hidden="true" /><span>Inspect</span></button>;
  const copyLeadId = async (row: InvestigationLead) => {
    const leadId = String(row.lead_id);
    const request = ++copyRequest.current;
    setCopyStatus(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(leadId);
      if (copyRequest.current === request) setCopyStatus({ rows, leadId, state: 'copied' });
    } catch {
      if (copyRequest.current === request) setCopyStatus({ rows, leadId, state: 'failed' });
    }
  };
  const copyButton = (row: InvestigationLead) => {
    const copied = currentCopyStatus?.leadId === String(row.lead_id) && currentCopyStatus.state === 'copied';
    return <button type="button" className="cx-record-copy" disabled={row.lead_id == null || row.lead_id === ''} onClick={() => void copyLeadId(row)} aria-label={`Copy lead ID ${row.lead_id}`} aria-describedby={currentCopyStatus?.leadId === String(row.lead_id) ? copyStatusId : undefined} title={copied ? 'Lead ID copied' : 'Copy lead ID'}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}</button>;
  };
  return <>
    <div className="cx-record-view"><label htmlFor={viewId}>Record view</label><select id={viewId} value={view} onChange={event => { const next = event.target.value as InvestigationRecordPreset; setCustomColumns(null); if (preset === undefined) setLocalPreset(next); onPresetChange?.(next); }}>{INVESTIGATION_RECORD_PRESETS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span>{schema.length} returned parameters{customColumns?.view === view ? ' · Custom columns' : view === 'full' ? ' · All shown' : ' · All parameters in the dossier'}</span><AnalyticalColumnManager fields={availableFields} selected={selectedKeys} presetLabel={viewLabel} onChange={keys => setCustomColumns({ view, keys })} onRestore={() => setCustomColumns(null)} /></div>
    <span id={copyStatusId} role="status" aria-live="polite" className="cx-record-copy-status">{currentCopyStatus ? currentCopyStatus.state === 'copied' ? 'Lead ID copied.' : 'Could not copy the lead ID. Select the displayed ID to copy it manually.' : ''}</span>
    <div className="cx-investigation-table-wrap" data-preset={view} data-complete={wideTable} role="region" tabIndex={0} aria-label={`${viewLabel} records`}><table className="cx-investigation-records" data-preset={view} data-dynamic-schema={wideTable || customColumns?.view === view} aria-label={`${viewLabel} records`}><thead><tr>{columns.map(column => <th key={column.key} scope="col" data-parameter-key={column.key} data-numeric={column.numeric || undefined}>{column.label}</th>)}<th scope="col">{view === 'full' ? 'Action' : 'Evidence'}</th></tr></thead><tbody>{rows.map(row => <tr key={String(row.lead_id)} data-selected={selectedLeadId === String(row.lead_id)}>{columns.map(column => column.key === 'lead_id' ? <th key={column.key} scope="row"><div className="cx-record-identity">{value(column, row)}{copyButton(row)}</div></th> : <td key={column.key} data-parameter-key={column.key} data-numeric={column.numeric || undefined}>{value(column, row)}</td>)}<td>{selectButton(row)}</td></tr>)}</tbody></table></div>
    {!wideTable && <ul className="cx-investigation-record-cards" aria-label={`${viewLabel} record list`}>{rows.map(row => <li key={String(row.lead_id)} data-selected={selectedLeadId === String(row.lead_id)}><div className="cx-record-card-heading"><div className="cx-record-identity">{curatedValues.lead_id.value(row)}{copyButton(row)}</div>{selectButton(row)}</div><dl>{columns.filter(column => column.key !== 'lead_id').map(column => <div key={column.key}><dt>{column.label}</dt><dd>{value(column, row)}</dd></div>)}</dl></li>)}</ul>}
  </>;
}
