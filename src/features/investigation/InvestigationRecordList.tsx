import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Copy, Eye } from 'lucide-react';
import { ledgerCalls, ledgerOutcome, ledgerValidation } from '../../lib/leadLedgerValues';
import { formatAuditValue } from '../../shared/evidence/auditVisualModel';
import { buildLedgerTimeline, formatLedgerDuration } from '../leadLedger/timeline';
import type { RawLeadsData } from '../../lib/offernetClient';

export type InvestigationLead = RawLeadsData['rows'][number];
export type InvestigationRecordPreset = 'investigation' | 'journey' | 'contact' | 'outcomes' | 'full';
export const INVESTIGATION_RECORD_PRESETS: ReadonlyArray<{ value: InvestigationRecordPreset; label: string }> = [
  { value: 'investigation', label: 'Investigation' },
  { value: 'journey', label: 'Journey' },
  { value: 'contact', label: 'Contact' },
  { value: 'outcomes', label: 'Outcomes' },
  { value: 'full', label: 'Full analytical' },
];
export const evidenceText = (value: unknown) => value == null || value === '' ? 'Unavailable' : String(value);
export const outcomeText = (value: unknown) => ledgerOutcome(value) === 'TRUE' ? 'Recorded' : ledgerOutcome(value) === 'FALSE' ? 'Not recorded' : 'Unavailable';
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

function recordedRevenue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? `R ${formatAuditValue(value)}` : 'Unavailable';
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return 'Unavailable';
  return `R ${value}`;
}

const suppliedField = (...values: unknown[]) => evidenceText(values.find(value => value != null && value !== ''));

type Column = { key: string; label: string; value: (row: InvestigationLead) => React.ReactNode };
const columnMap: Record<string, Column> = {
  lead: { key: 'lead', label: 'Lead / current state', value: row => <><strong className="cx-record-id">{row.lead_id}</strong><small>{buildLedgerTimeline(row).currentStage?.title || 'Stage unavailable'}</small></> },
  reason: { key: 'reason', label: 'Why included', value: () => null },
  vendor: { key: 'vendor', label: 'Vendor', value: row => evidenceText(row.vendor) },
  source: { key: 'source', label: 'Source', value: row => suppliedField(row.source, row.offershop_source) },
  delay: { key: 'delay', label: 'Delivery → first dial', value: row => leadDelay(row) },
  calls: { key: 'calls', label: 'Calls', value: row => ledgerCalls(row.total_calls) },
  disposition: { key: 'disposition', label: 'Last disposition', value: row => evidenceText(row.last_dialer_status) },
  fetched: { key: 'fetched', label: 'Fetched', value: row => evidenceText(row.fetched) },
  delivered: { key: 'delivered', label: 'Delivered', value: row => evidenceText(row.delivered_time) },
  dial: { key: 'dial', label: 'First dial', value: row => evidenceText(row.first_call_time) },
  rpc: { key: 'rpc', label: 'RPC', value: row => outcomeText(row.contacted) },
  sale: { key: 'sale', label: 'Sale', value: row => outcomeText(row.sale) },
  activation: { key: 'activation', label: 'Activation', value: row => outcomeText(row.activated) },
  revenue: { key: 'revenue', label: 'Source-recorded revenue', value: row => recordedRevenue(row.revenue) },
  consumer: { key: 'consumer', label: 'Consumer ID', value: row => evidenceText(row.consumer_id) },
  grade: { key: 'grade', label: 'Grade', value: row => suppliedField(row.grade, row.offershop_grade) },
  vetting: { key: 'vetting', label: 'Vetting', value: row => suppliedField(row.vetting, row.offershop_color_vetting) },
  validId: { key: 'validId', label: 'ID valid', value: row => ledgerValidation(row.valid_idno) },
  validPhone: { key: 'validPhone', label: 'Phone valid', value: row => ledgerValidation(row.phone_valid) },
  dialled: { key: 'dialled', label: 'Dialled', value: row => outcomeText(row.dialled) },
};
const presets: Record<InvestigationRecordPreset, string[]> = {
  investigation: ['lead', 'reason', 'vendor', 'source', 'delay'],
  journey: ['lead', 'fetched', 'delivered', 'dial', 'rpc', 'sale', 'activation'],
  contact: ['lead', 'dial', 'calls', 'rpc', 'disposition', 'vendor'],
  outcomes: ['lead', 'rpc', 'sale', 'activation', 'revenue'],
  full: ['lead', 'consumer', 'fetched', 'source', 'vendor', 'grade', 'vetting', 'validId', 'validPhone', 'dialled', 'rpc', 'calls', 'disposition', 'sale', 'activation', 'revenue'],
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
  const columns = useMemo(() => presets[view].map(key => key === 'delay' && view === 'investigation' ? { ...columnMap.delay, label: 'Age / delay' } : key === 'lead' && view === 'full' ? { ...columnMap.lead, label: 'Lead ID', value: (row: InvestigationLead) => <strong className="cx-record-id">{evidenceText(row.lead_id)}</strong> } : columnMap[key]), [view]);
  const value = (column: Column, row: InvestigationLead) => {
    if (column.key === 'reason') return <span title={row.investigationReason?.detail}>{inclusionReason(row, investigation)}</span>;
    if (column.key === 'delay' && view === 'investigation') {
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
    <div className="cx-record-view"><label htmlFor={viewId}>Record view</label><select id={viewId} value={view} onChange={event => { const next = event.target.value as InvestigationRecordPreset; if (preset === undefined) setLocalPreset(next); onPresetChange?.(next); }}>{INVESTIGATION_RECORD_PRESETS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span>Additional evidence remains in each lead dossier.</span></div>
    <span id={copyStatusId} role="status" aria-live="polite" className="cx-record-copy-status">{currentCopyStatus ? currentCopyStatus.state === 'copied' ? 'Lead ID copied.' : 'Could not copy the lead ID. Select the displayed ID to copy it manually.' : ''}</span>
    <div className="cx-investigation-table-wrap" data-preset={view} role="region" tabIndex={0} aria-label={`${viewLabel} records`}><table className="cx-investigation-records" data-preset={view} aria-label={`${viewLabel} records`}><thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}<th scope="col">{view === 'full' ? 'Action' : 'Evidence'}</th></tr></thead><tbody>{rows.map(row => <tr key={String(row.lead_id)} data-selected={selectedLeadId === String(row.lead_id)}>{columns.map((column, index) => index === 0 ? <th key={column.key} scope="row"><div className="cx-record-identity">{value(column, row)}{copyButton(row)}</div></th> : <td key={column.key}>{value(column, row)}</td>)}<td>{selectButton(row)}</td></tr>)}</tbody></table></div>
    {view !== 'full' && <ul className="cx-investigation-record-cards" aria-label={`${viewLabel} record list`}>{rows.map(row => <li key={String(row.lead_id)} data-selected={selectedLeadId === String(row.lead_id)}><div className="cx-record-card-heading"><div className="cx-record-identity">{columnMap.lead.value(row)}{copyButton(row)}</div>{selectButton(row)}</div><dl>{columns.filter(column => column.key !== 'lead').map(column => <div key={column.key}><dt>{column.label}</dt><dd>{value(column, row)}</dd></div>)}</dl></li>)}</ul>}
  </>;
}
