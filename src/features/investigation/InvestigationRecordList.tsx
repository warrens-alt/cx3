import React, { useId, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { ledgerCalls, ledgerOutcome } from '../../lib/leadLedgerValues';
import { buildLedgerTimeline, formatLedgerDuration } from '../leadLedger/timeline';
import type { RawLeadsData } from '../../lib/offernetClient';

export type InvestigationLead = RawLeadsData['rows'][number];
export type RecordView = 'Investigation' | 'Journey' | 'Contact' | 'Outcome' | 'Source';
const views: RecordView[] = ['Investigation', 'Journey', 'Contact', 'Outcome', 'Source'];
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

type Column = { key: string; label: string; value: (row: InvestigationLead) => React.ReactNode };
const columnMap: Record<string, Column> = {
  lead: { key: 'lead', label: 'Lead / current state', value: row => <><strong className="cx-record-id">{row.lead_id}</strong><small>{buildLedgerTimeline(row).currentStage?.title || 'Stage unavailable'}</small></> },
  reason: { key: 'reason', label: 'Why included', value: () => null },
  origin: { key: 'origin', label: 'Vendor / source', value: row => <><span>{evidenceText(row.vendor)}</span><small>{evidenceText(row.source)}</small></> },
  delay: { key: 'delay', label: 'Delivery → first dial', value: row => leadDelay(row) },
  calls: { key: 'calls', label: 'Calls / last disposition', value: row => <><span>{ledgerCalls(row.total_calls)} calls</span><small>{evidenceText(row.last_dialer_status)}</small></> },
  outcomes: { key: 'outcomes', label: 'Recorded outcomes', value: row => <span className="cx-record-outcomes"><span>RPC: {outcomeText(row.contacted)}</span><span>Sale: {outcomeText(row.sale)}</span><span>Activated: {outcomeText(row.activated)}</span></span> },
  fetched: { key: 'fetched', label: 'Fetched', value: row => evidenceText(row.fetched) },
  delivered: { key: 'delivered', label: 'Delivered', value: row => evidenceText(row.delivered_time) },
  dial: { key: 'dial', label: 'First dial', value: row => evidenceText(row.first_call_time) },
  rpc: { key: 'rpc', label: 'RPC', value: row => outcomeText(row.contacted) },
  revenue: { key: 'revenue', label: 'Source-recorded revenue', value: row => row.revenue == null ? 'Unavailable' : formatCurrency(row.revenue) },
  grade: { key: 'grade', label: 'Grade / medium', value: row => <><span>{evidenceText(row.grade)}</span><small>{evidenceText(row.medium)}</small></> },
  transaction: { key: 'transaction', label: 'Transaction / consumer', value: row => <><span>{evidenceText(row.transaction_id)}</span><small>{evidenceText(row.consumer_id)}</small></> },
};
const presets: Record<RecordView, string[]> = {
  Investigation: ['lead', 'reason', 'origin', 'delay', 'calls', 'outcomes'],
  Journey: ['lead', 'fetched', 'delivered', 'dial', 'delay'],
  Contact: ['lead', 'origin', 'calls', 'dial', 'rpc'],
  Outcome: ['lead', 'origin', 'outcomes', 'revenue'],
  Source: ['lead', 'origin', 'grade', 'transaction'],
};

export default function InvestigationRecordList({ rows, selectedLeadId, investigation, dossierId, observedAt, onSelect }: {
  rows: InvestigationLead[];
  selectedLeadId: string | null;
  investigation?: string | null;
  dossierId: string;
  observedAt?: string;
  onSelect: (row: InvestigationLead, trigger: HTMLButtonElement) => void;
}) {
  const [view, setView] = useState<RecordView>('Investigation');
  const viewId = useId();
  const columns = useMemo(() => presets[view].map(key => key === 'delay' && view === 'Investigation' ? { ...columnMap.delay, label: 'Age / delay' } : columnMap[key]), [view]);
  const value = (column: Column, row: InvestigationLead) => {
    if (column.key === 'reason') return <span title={row.investigationReason?.detail}>{inclusionReason(row, investigation)}</span>;
    if (column.key === 'delay' && view === 'Investigation') {
      const journey = buildLedgerTimeline(row);
      const delivery = journey.milestones.find(event => event.kind === 'delivery');
      const dial = journey.milestones.find(event => event.kind === 'call');
      if (dial?.timestamp) return <span>To first dial: {leadDelay(row)}</span>;
      const elapsed = delivery?.timestamp && observedAt ? Date.parse(observedAt) - Date.parse(delivery.timestamp) : NaN;
      if (Number.isFinite(elapsed) && elapsed >= 0) return <span title={`Age at response generation: ${observedAt}`}>Delivery age: {formatLedgerDuration(elapsed)}</span>;
    }
    return column.value(row);
  };
  const selectButton = (row: InvestigationLead) => <button type="button" className="cx-record-open" data-lead-id={String(row.lead_id)} aria-pressed={selectedLeadId === String(row.lead_id)} aria-controls={dossierId} onClick={event => onSelect(row, event.currentTarget)} aria-label={`Open dossier for lead ${row.lead_id}`}><Eye size={14} aria-hidden="true" /><span>Inspect</span></button>;
  return <>
    <div className="cx-record-view"><label htmlFor={viewId}>Record view</label><select id={viewId} value={view} onChange={event => setView(event.target.value as RecordView)}>{views.map(name => <option key={name}>{name}</option>)}</select><span>Additional evidence remains in each lead dossier.</span></div>
    <div className="cx-investigation-table-wrap"><table className="cx-investigation-records" aria-label={`${view} records`}><thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}<th scope="col">Evidence</th></tr></thead><tbody>{rows.map(row => <tr key={String(row.lead_id)} data-selected={selectedLeadId === String(row.lead_id)}>{columns.map((column, index) => index === 0 ? <th key={column.key} scope="row">{value(column, row)}</th> : <td key={column.key}>{value(column, row)}</td>)}<td>{selectButton(row)}</td></tr>)}</tbody></table></div>
    <ul className="cx-investigation-record-cards" aria-label={`${view} record list`}>{rows.map(row => <li key={String(row.lead_id)} data-selected={selectedLeadId === String(row.lead_id)}><div className="cx-record-card-heading">{columnMap.lead.value(row)}{selectButton(row)}</div><dl>{columns.filter(column => column.key !== 'lead').map(column => <div key={column.key}><dt>{column.label}</dt><dd>{value(column, row)}</dd></div>)}</dl></li>)}</ul>
  </>;
}
