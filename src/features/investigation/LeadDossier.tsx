import React, { useId, useRef, useState } from 'react';
import { X, Pin } from 'lucide-react';
import { useClient } from '../../lib/ClientContext';
import { useFilters } from '../../lib/FilterContext';
import { useAuth } from '../../lib/AuthContext';
import { useOperationalData } from '../../lib/useOperationalData';
import { fetchOffernetJson, type LeadTimelineData, type RawLeadsData } from '../../lib/offernetClient';
import { analyseLedgerLead, type LedgerReplicaReport } from '../../../contracts/leadLedgerReplica';
import LeadJourney from '../leadLedger/LeadJourney';
import LeadSourceEvidence from '../leadLedger/LeadSourceEvidence';
import { buildLedgerTimeline, type LedgerTimelineEvent } from '../leadLedger/timeline';
import { returnedEvidenceFields } from '../leadLedger/EvidenceExportPreflight';
import { evidenceText, outcomeText, inclusionReason, leadDelay, type InvestigationLead } from './InvestigationRecordList';
import { ledgerCalls } from '../../lib/leadLedgerValues';
import { formatCurrency } from '../../lib/formatters';
import '../leadLedger/ledger.css';

export type DossierPin = { type: 'lead' | 'timeline-event'; label: string; value: string; definition: string; identifier: string; observedAt?: string; provenance: string[] };
const qualificationText = (value: unknown) => value === true ? 'Qualified' : value === false ? 'Excluded from qualified progression' : 'Unavailable';
const chronologyText = (row: InvestigationLead) => {
  const flags = [
    ['delivery_before_capture', 'Delivery before capture'], ['first_dial_before_capture', 'First dial before capture'],
    ['first_dial_before_delivery', 'First dial before delivery'], ['sale_before_capture', 'Sale before capture'],
    ['activation_before_sale', 'Activation before sale'],
  ] as const;
  const anomalies = flags.filter(([key]) => row[key] === true).map(([, label]) => label);
  return anomalies.length ? `Invalid: ${anomalies.join('; ')}` : flags.every(([key]) => row[key] === false) ? 'No recorded ordering anomaly; qualification also requires predecessor evidence' : 'Unavailable';
};
type Tab = 'Summary' | 'Journey' | 'Calls' | 'Outcomes' | 'Evidence' | 'Source';
const tabs: Tab[] = ['Summary', 'Journey', 'Calls', 'Outcomes', 'Evidence', 'Source'];
const fields = (entries: Array<[string, unknown]>) => <dl className="cx-dossier-fields">{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{evidenceText(value)}</dd></div>)}</dl>;

/** Auth is checked again here before mounting a raw-source request. Exact lead matching
 * protects the inspector from the replica endpoint's substring-search semantics. */
function DossierSource({ leadId, focusFields, scopeKey, segmentVendor }: { leadId: string; focusFields: string[]; scopeKey: string; segmentVendor?: string }) {
  const { isAdmin } = useAuth();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const sourceFilters = filters.lead_id ? filters : { ...filters, lead_id: { operator: 'equals', value: leadId } };
  const request = { clientId: selectedClient, startDate, endDate, filters: JSON.stringify(sourceFilters), sourceMode: 'configured', search: leadId, limit: 25, offset: 0 };
  const { data, loading, error } = useOperationalData<LedgerReplicaReport>('dossier-source', { ...request, investigationScope: scopeKey }, (params, forceRefresh, signal) => {
    const { investigationScope: _scope, ...sourceParams } = params;
    return fetchOffernetJson<LedgerReplicaReport>(`/api/analytics/lead-ledger/replica?${new URLSearchParams(sourceParams)}`, forceRefresh, signal);
  }, isAdmin && Boolean(leadId && startDate && endDate));
  if (!isAdmin) return <p>Source evidence is restricted to authorised administrators.</p>;
  if (loading) return <p role="status">Loading source evidence for this lead…</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!data || data.metadata.clientId !== selectedClient) return <p>Source evidence unavailable.</p>;
  const matched = data.leads.find(lead => lead.leadId === leadId);
  // Match operational_raw's null vendor label before the segment's blank-value normalisation.
  const segmentRecords = matched?.records.filter(record => !segmentVendor || (String(record.raw['HLC Vendor'] ?? 'Unknown').trim() || 'Unrecorded') === segmentVendor);
  const lead = matched && segmentVendor ? analyseLedgerLead(matched.key, (segmentRecords || []).map(record => record.raw), Date.parse(data.metadata.generatedAt)) : matched;
  if (!lead?.records.length) return <p>No exact source lead match was returned in this scope.{data.metadata.hasMore ? ' The source search returned a partial page; no other lead is substituted.' : ''}</p>;
  return <><p className="cx-dossier-note">Original source evidence · {data.metadata.validationStatus || 'Validation not supplied'}. Records stay separate. The investigation qualifies the lead; source records do not independently establish that every transaction meets its predicate.</p><details><summary>Source scope and provenance</summary>{fields(returnedEvidenceFields(data).map(field => [field.label, field.value]))}<p>{data.metadata.coverage?.source || 'Source unavailable'}</p><p>{data.metadata.timestampInterpretation}</p>{data.metadata.coverage?.missing.length > 0 && <p>Unavailable source fields: {data.metadata.coverage.missing.join(', ')}. Coverage remains partial.</p>}{segmentVendor && <p>Source records narrowed to vendor: {segmentVendor}.</p>}</details><LeadSourceEvidence lead={lead} focusFields={focusFields} /></>;
}

export default function LeadDossier({ row, result, investigation, scopeKey, timeline, loading, error, id, onClose, onPin, segmentVendor }: {
  row: InvestigationLead;
  result: RawLeadsData;
  investigation?: string | null;
  scopeKey: string;
  timeline: LeadTimelineData | null;
  loading: boolean;
  error: string | null;
  id: string;
  onClose: () => void;
  onPin?: (pin: DossierPin) => void;
  segmentVendor?: string;
}) {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('Summary');
  const [focusFields, setFocusFields] = useState<string[]>([]);
  const root = useRef<HTMLElement>(null);
  const tabsId = useId();
  const visibleTabs = isAdmin ? tabs : tabs.filter(value => value !== 'Source');
  const activeTab = !isAdmin && tab === 'Source' ? 'Evidence' : tab;
  const journey = buildLedgerTimeline(row);
  const validation = result.validationStatus || result.metadata?.validationStatus || 'NOT_VERIFIED';
  const reason = inclusionReason(row, investigation);
  const source = (requested: string[]) => { if (!isAdmin) return; setFocusFields(requested); setTab('Source'); };
  const currentTimeline = timeline?.leadId === String(row.lead_id) ? timeline : null;
  const pinEvent = (event: LedgerTimelineEvent) => onPin?.({ type: 'timeline-event', label: `${row.lead_id} · ${event.title}`, value: event.timestamp || 'Timestamp unavailable', definition: event.description, identifier: String(row.lead_id), observedAt: event.timestamp || undefined, provenance: event.evidenceFields.map(field => `${field.label}: ${evidenceText(field.value)}`) });
  return <aside ref={root} id={id} className="cx-lead-dossier" tabIndex={-1} aria-label={`Lead dossier for ${row.lead_id}`}>
    <header className="cx-dossier-heading"><div><span className="cx-command-section-kicker">Lead dossier</span><h2>{row.lead_id}</h2><p>{validation} · same investigation scope</p></div><button type="button" onClick={onClose} aria-label="Close lead dossier"><X size={17} /></button></header>
    <div className="cx-dossier-inclusion"><strong>Why included</strong><p>{reason}</p>{row.investigationReason?.detail && <small>{row.investigationReason.detail}</small>}{onPin && <button type="button" className="cx-button-secondary" onClick={() => onPin({ type: 'lead', label: String(row.lead_id), value: reason, definition: row.investigationReason?.detail || 'Returned investigation record', identifier: String(row.lead_id), observedAt: result.generatedAt, provenance: returnedEvidenceFields(result).map(field => `${field.label}: ${field.value}`) })}><Pin size={13} />Pin lead evidence</button>}</div>
    <div role="tablist" aria-label="Lead dossier sections" className="cx-dossier-tabs" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = visibleTabs.indexOf(activeTab);
      const next = event.key === 'Home' ? visibleTabs[0] : event.key === 'End' ? visibleTabs[visibleTabs.length - 1] : visibleTabs[(index + (event.key === 'ArrowRight' ? 1 : visibleTabs.length - 1)) % visibleTabs.length];
      setTab(next); document.getElementById(`${tabsId}-${next}-tab`)?.focus();
    }}>{visibleTabs.map(value => <button key={value} type="button" id={`${tabsId}-${value}-tab`} role="tab" aria-selected={activeTab === value} aria-controls={`${tabsId}-${value}-panel`} tabIndex={activeTab === value ? 0 : -1} onClick={() => setTab(value)}>{value}</button>)}</div>
    <section className="cx-dossier-body" role="tabpanel" id={`${tabsId}-${activeTab}-panel`} aria-labelledby={`${tabsId}-${activeTab}-tab`} tabIndex={0}>
      {activeTab === 'Summary' && <>{fields([
        ['Lead ID', row.lead_id], ['Vendor', row.vendor], ['Source', row.source], ['Grade', row.grade], ['Furthest recorded stage', journey.currentStage?.title],
        ['Fetched timestamp', row.fetched], ['Recorded delivery timestamp', row.delivered_time], ['Recorded first dial timestamp', row.first_call_time], ['Delivery qualification', qualificationText(row.qualified_delivery)], ['First dial qualification', qualificationText(row.dialled)], ['Recorded sale timestamp', row.sale_time], ['Recorded activation timestamp', row.activation_time], ['Sale → activation qualification', qualificationText(row.qualified_activation)], ['Chronology', chronologyText(row)], ['Delivery → first dial', leadDelay(row)], ['Total recorded calls', ledgerCalls(row.total_calls)], ['RPC', outcomeText(row.contacted)], ['Sale', outcomeText(row.sale)], ['Activated', outcomeText(row.activated)], ['Source-recorded revenue', row.revenue == null ? 'Unavailable' : formatCurrency(row.revenue)], ['Validation status', validation],
      ])}<p className="cx-dossier-note">Recorded events remain visible when chronology is invalid. Qualified delivery requires delivery at or after capture; qualified first dial also requires dial at or after delivery. Missing predecessors cannot establish qualification. Sales and activations do not certify billing or collection.</p>{isAdmin && <button type="button" className="cx-button-secondary" onClick={() => source([])}>View source evidence</button>}</>}
      {activeTab === 'Journey' && <><LeadJourney row={row} validationStatus={validation} onViewSource={isAdmin ? source : undefined} sourceEvents={currentTimeline?.events} onPinEvent={onPin ? pinEvent : undefined} />{loading && <p role="status">Loading scoped source milestones…</p>}{error && <p role="alert">Source milestone request failed: {error}</p>}{currentTimeline?.callEvidence && <p className="cx-dossier-note">{currentTimeline.callEvidence.status}: {currentTimeline.callEvidence.reason}</p>}</>}
      {activeTab === 'Calls' && <><h3>Recorded call aggregates</h3>{fields([['Total calls', ledgerCalls(row.total_calls)], ['First dial', row.first_call_time], ['Last disposition', row.last_dialer_status], ['RPC', outcomeText(row.contacted)]])}<p>Individual attempt timestamps, dispositions per attempt and RPC attempt number are unavailable. The aggregate count is not an attempt history.</p>{currentTimeline?.callEvidence && <p>{currentTimeline.callEvidence.reason}</p>}{isAdmin && <button type="button" className="cx-button-secondary" onClick={() => source(['HLC Total Calls', 'HLC First Call Date', 'HLC Last Dialer Status', 'HLC RPC'])}>View call source fields</button>}</>}
      {activeTab === 'Outcomes' && <><h3>Recorded outcome evidence</h3>{fields([['RPC · contacted', outcomeText(row.contacted)], ['Sale · sale', outcomeText(row.sale)], ['Activation · activated', outcomeText(row.activated)], ['Last disposition · last_dialer_status', row.last_dialer_status], ['Source-recorded revenue · revenue', row.revenue == null ? 'Unavailable' : formatCurrency(row.revenue)]])}<p>Missing evidence remains unavailable. A recorded downstream outcome does not create an upstream event, collected cash or a confirmed event time.</p>{isAdmin && <button type="button" className="cx-button-secondary" onClick={() => source(['HLC RPC', 'HLC Sale', 'HLC Activated', 'HLC Revenue Generated', 'HLC Last Dialer Status'])}>View outcome source fields</button>}</>}
      {activeTab === 'Evidence' && <><h3>Evidence definition and scope</h3>{fields(returnedEvidenceFields(result).map(field => [field.label, field.value]))}{fields([['Metric', result.metricId || result.metadata?.metricId], ['Definition version', result.definitionVersion || result.metadata?.definitionVersion], ['Source tables', result.metadata?.sourceTables ? JSON.stringify(result.metadata.sourceTables) : result.metadata?.source], ['Validation', validation]])}<p>{row.investigationReason?.detail || 'No additional inclusion definition was returned for this record.'}</p><h3>Limitations</h3><ul>{journey.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>{journey.anomalies.length > 0 && <div role="note"><h3>Timestamp anomalies</h3>{journey.anomalies.map((anomaly, index) => <p key={index}>{anomaly.field}: {anomaly.message}</p>)}</div>}<details><summary>All returned analytical evidence fields</summary>{fields(Object.entries(row).map(([key, value]) => [key, value !== null && typeof value === 'object' ? JSON.stringify(value) : value]))}</details></>}
      {activeTab === 'Source' && isAdmin && <DossierSource key={scopeKey + row.lead_id} leadId={String(row.lead_id)} focusFields={focusFields} scopeKey={scopeKey} segmentVendor={segmentVendor} />}
    </section>
  </aside>;
}
