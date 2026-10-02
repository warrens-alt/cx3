import React, { useEffect, useId, useRef, useState } from 'react';
import { X, Pin, Maximize2, Minimize2 } from 'lucide-react';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import { useClient } from '../../lib/ClientContext';
import { useFilters } from '../../lib/FilterContext';
import { useAuth } from '../../lib/AuthContext';
import { useOperationalData } from '../../lib/useOperationalData';
import { fetchOffernetJson, type LeadTimelineData, type RawLeadsData } from '../../lib/offernetClient';
import { analyseLedgerLead, type LedgerLead, type LedgerReplicaReport } from '../../../contracts/leadLedgerReplica';
import LeadJourney from '../leadLedger/LeadJourney';
import LeadSourceEvidence from '../leadLedger/LeadSourceEvidence';
import { buildLedgerTimeline, type LedgerTimelineEvent } from '../leadLedger/timeline';
import { returnedEvidenceFields } from '../leadLedger/EvidenceExportPreflight';
import { evidenceText, outcomeText, inclusionReason, recordedRevenue, type InvestigationLead } from './InvestigationRecordList';
import { ledgerCalls } from '../../lib/leadLedgerValues';
import { useInvestigationModel } from './InvestigationContextBar';
import { pinnedAuditScope } from './pinnedAuditEvidence';
import EvidenceTrace, { AuditDimensions } from '../../shared/evidence/EvidenceTrace';
import { buildDossierAuditEvidence, buildSourceRelationship } from './dossierAuditEvidence';
import LeadEvidenceSummary from './LeadEvidenceSummary';
import '../leadEvidence/leadEvidence.css';

export type DossierPin = { type: 'lead' | 'timeline-event'; label: string; value: string; definition: string; identifier: string; observedAt?: string; provenance: string[] };
export type DossierTab = 'Summary' | 'Journey' | 'Calls' | 'Outcomes' | 'Audit' | 'Source';
const tabs: DossierTab[] = ['Summary', 'Journey', 'Calls', 'Outcomes', 'Audit', 'Source'];
const fields = (entries: Array<[string, unknown]>) => <dl className="cx-dossier-fields">{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{evidenceText(value)}</dd></div>)}</dl>;

function SuppliedSource({ lead, report, focusFields, analyticalLeadId }: { lead: LedgerLead; report?: LedgerReplicaReport; focusFields: string[]; analyticalLeadId?: string }) {
  return <><EvidenceTrace label="Source and analytical relationship" nodes={buildSourceRelationship(lead, report, analyticalLeadId)} /><p className="cx-dossier-note">Original source evidence · {report?.metadata.validationStatus || 'Validation not supplied'}. Records stay separate. The investigation qualifies the analytical lead; source records do not independently establish that every transaction meets its predicate.</p>{report && <details><summary>Source scope and provenance</summary>{fields(returnedEvidenceFields(report).map(field => [field.label, field.value]))}<p>{report.metadata.coverage?.source || 'Source unavailable'}</p><p>{report.metadata.timestampInterpretation}</p>{report.metadata.coverage?.missing.length > 0 && <p>Unavailable source fields: {report.metadata.coverage.missing.join(', ')}. Coverage remains partial.</p>}</details>}<LeadSourceEvidence lead={lead} focusFields={focusFields} /></>;
}

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
  return <>{segmentVendor && <p>Source records narrowed to vendor: {segmentVendor}.</p>}<SuppliedSource lead={lead} report={data} focusFields={focusFields} analyticalLeadId={leadId} /></>;
}

export interface LeadDossierProps {
  row?: InvestigationLead;
  result?: RawLeadsData;
  investigation?: string | null;
  scopeKey: string;
  timeline?: LeadTimelineData | null;
  loading?: boolean;
  error?: string | null;
  id: string;
  onClose: () => void;
  onPin?: (pin: DossierPin) => void;
  segmentVendor?: string;
  sourceLead?: LedgerLead;
  sourceReport?: LedgerReplicaReport;
  /** Source-mode ownership: even an absent exact match must not trigger a second query. */
  sourceResolved?: boolean;
  initialTab?: 'Summary' | 'Source';
  sourceFocusFields?: string[];
  onOpenSource?: (leadId: string, fields: string[]) => void;
  onRequestAnalytical?: () => void;
  onOpenAnalytical?: () => void;
  analyticalLoading?: boolean;
  analyticalError?: string | null;
}

export default function LeadDossier({ row, result, investigation, scopeKey, timeline, loading = false, error, id, onClose, onPin, segmentVendor, sourceLead, sourceReport, sourceResolved = false, initialTab = 'Summary', sourceFocusFields, onOpenSource, onRequestAnalytical, onOpenAnalytical, analyticalLoading = false, analyticalError }: LeadDossierProps) {
  const { isAdmin } = useAuth();
  const { selectedClient } = useClient();
  const [tab, setTab] = useState<DossierTab>(initialTab);
  const [focusFields, setFocusFields] = useState<string[]>(sourceFocusFields || []);
  const previousInitialTab = useRef(initialTab);
  useEffect(() => { if (previousInitialTab.current !== initialTab) { previousInitialTab.current = initialTab; setTab(initialTab); } }, [initialTab]);
  useEffect(() => { if (sourceFocusFields) setFocusFields(sourceFocusFields); }, [sourceFocusFields]);
  const [focused, setFocused] = useState(false);
  const root = useDialogAccessibility<HTMLElement>(focused, () => setFocused(false));
  const tabsId = useId();
  const visibleTabs = isAdmin ? tabs : tabs.filter(value => value !== 'Source');
  const activeTab = !isAdmin && tab === 'Source' ? 'Audit' : tab;
  const analytical = row && row.lead_id != null && String(row.lead_id).trim() && result?.clientId === selectedClient && result.rows.some(returned => String(returned.lead_id) === String(row.lead_id)) ? { row, result } : null;
  const sourceIdentity = sourceLead?.leadId == null ? '' : String(sourceLead.leadId);
  const leadId = analytical ? String(analytical.row.lead_id) : sourceIdentity;
  const suppliedSource = sourceResolved || sourceLead !== undefined || sourceReport !== undefined;
  const currentSourceReport = sourceReport?.metadata.clientId === selectedClient ? sourceReport : undefined;
  const currentSourceLead = sourceLead && sourceIdentity === leadId && (!sourceReport || currentSourceReport) ? sourceLead : undefined;
  const journey = analytical ? buildLedgerTimeline(analytical.row) : null;
  const validation = analytical?.result.validationStatus || analytical?.result.metadata?.validationStatus || currentSourceReport?.metadata.validationStatus || 'NOT_VERIFIED';
  const auditModel = useInvestigationModel({ validationStatus: validation });
  const audit = buildDossierAuditEvidence(analytical?.row, analytical?.result, currentSourceLead, currentSourceReport);
  const reason = analytical ? inclusionReason(analytical.row, investigation) : 'Original source identity in the current source population. Analytical inclusion has not been established.';
  const identityFields: Array<[string, unknown]> = analytical ? [
    ['Representative vendor', analytical.row.vendor], ['Source', analytical.row.source], ['Fetched timestamp', analytical.row.fetched],
    ['Furthest recorded stage', journey?.currentStage?.title], ['Grade', analytical.row.grade],
  ] : [
    ['First-record vendor', currentSourceLead?.records[0]?.raw['HLC Vendor']], ['First-record Offershop Source', currentSourceLead?.records[0]?.raw['Offershop Source']],
    ['First-record Fetched', currentSourceLead?.records[0]?.raw['Fetched']], ['First-record Offershop Grade', currentSourceLead?.records[0]?.raw['Offershop Grade']],
  ];
  const source = (requested: string[]) => { if (!isAdmin) return; setFocusFields(requested); setTab('Source'); };
  const currentTimeline = analytical && timeline?.leadId === leadId ? timeline : null;
  const pinEvent = (event: LedgerTimelineEvent) => onPin?.({ type: 'timeline-event', label: `${leadId} · ${event.title}`, value: event.timestamp || 'Timestamp unavailable', definition: event.description, identifier: `${leadId}:${event.id}`, observedAt: event.timestamp || undefined, provenance: event.evidenceFields.map(field => `${field.label}: ${evidenceText(field.value)}`) });
  const analyticalUnavailable = <><p>Normalized analytical evidence is unavailable for this source identity. Original source fields remain in Source; they are not substituted for analytical milestones, qualification, calls or outcomes.</p>{onRequestAnalytical && <button type="button" className="cx-button-secondary" disabled={analyticalLoading} onClick={onRequestAnalytical}>{analyticalLoading ? 'Loading analytical evidence…' : 'Load analytical evidence'}</button>}{analyticalLoading && <p role="status">Looking for an exact analytical lead match in the current population…</p>}{analyticalError && <p role="alert">{analyticalError}</p>}</>;
  return <aside ref={root} id={id} className={`cx-lead-dossier${focused ? ' is-focused' : ''}`} role={focused ? 'dialog' : undefined} aria-modal={focused || undefined} tabIndex={-1} aria-label={isAdmin ? `Lead dossier for ${leadId || 'unresolved source lead'}` : 'Lead dossier'} onKeyDown={event => { if (event.key === 'Escape' && !focused && !document.querySelector('[role="dialog"][aria-modal="true"]')) { event.stopPropagation(); onClose(); } }}>
    <header className="cx-dossier-heading"><div><span className="cx-command-section-kicker">Lead dossier</span><h2>{isAdmin ? leadId || (sourceLead ? 'Unresolved source lead' : 'Lead identity unavailable') : 'Restricted evidence'}</h2>{isAdmin && <><p>{validation} · {analytical ? 'normalized lead evidence' : 'original source evidence'}</p><dl className="cx-dossier-identity">{identityFields.filter(([, value]) => value != null && value !== '').map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{evidenceText(value)}</dd></div>)}</dl></>}</div><div className="cx-dossier-window-actions"><button type="button" onClick={() => setFocused(value => !value)} aria-label={focused ? 'Exit lead dossier focus' : 'Focus lead dossier'} aria-pressed={focused}>{focused ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button><button type="button" onClick={onClose} aria-label="Close lead dossier"><X size={17} /></button></div></header>
    {!isAdmin ? <p role="status">Lead evidence is restricted to authorised administrators.</p> : <>
    <div className="cx-dossier-inclusion"><strong>{analytical ? 'Why included' : 'Source population'}</strong><p>{reason}</p>{analytical?.row.investigationReason?.detail && <small>{analytical.row.investigationReason.detail}</small>}{onPin && analytical && <button type="button" className="cx-button-secondary" onClick={() => onPin({ type: 'lead', label: leadId, value: reason, definition: analytical.row.investigationReason?.detail || 'Returned investigation record', identifier: leadId, observedAt: analytical.result.generatedAt, provenance: returnedEvidenceFields(analytical.result).map(field => `${field.label}: ${field.value}`) })}><Pin size={13} />Pin lead evidence</button>}</div>
    <p className="cx-dossier-note">{analytical ? 'One normalized lead row' : 'No normalized lead row loaded'}{currentSourceLead ? ` · ${currentSourceLead.records.length} original source records` : ' · original source records not loaded'}. These evidence grains remain separate; matching identifiers do not establish reconciliation.</p>
    <div role="tablist" aria-label="Lead dossier sections" className="cx-dossier-tabs" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = visibleTabs.indexOf(activeTab);
      const next = event.key === 'Home' ? visibleTabs[0] : event.key === 'End' ? visibleTabs[visibleTabs.length - 1] : visibleTabs[(index + (event.key === 'ArrowRight' ? 1 : visibleTabs.length - 1)) % visibleTabs.length];
      setTab(next); document.getElementById(`${tabsId}-${next}-tab`)?.focus();
    }}>{visibleTabs.map(value => <button key={value} type="button" id={`${tabsId}-${value}-tab`} role="tab" aria-selected={activeTab === value} aria-controls={`${tabsId}-${value}-panel`} tabIndex={activeTab === value ? 0 : -1} onClick={() => setTab(value)}>{value}</button>)}</div>
    <section className="cx-dossier-body" data-section={activeTab.toLowerCase()} role="tabpanel" id={`${tabsId}-${activeTab}-panel`} aria-labelledby={`${tabsId}-${activeTab}-tab`} tabIndex={0}>
      {activeTab === 'Summary' && <>{analytical ? <><LeadEvidenceSummary row={analytical.row} />{fields([['Last recorded disposition', analytical.row.last_dialer_status]])}<details><summary>Identity and returned context</summary>{fields([
        ['Lead ID', leadId],
        ...(analytical.row.consumer_id != null && analytical.row.consumer_id !== '' ? [['Consumer ID', analytical.row.consumer_id] as [string, unknown]] : []),
        ['Representative vendor', analytical.row.vendor], ['Source', analytical.row.source], ['Grade', analytical.row.grade],
        ...(analytical.row.vetting != null && analytical.row.vetting !== '' ? [['Vetting', analytical.row.vetting] as [string, unknown]] : []),
        ...(analytical.row.fetched != null && analytical.row.fetched !== '' ? [['Fetched timestamp', analytical.row.fetched] as [string, unknown]] : []),
        ['Furthest recorded stage', journey?.currentStage?.title], ['Validation status', validation],
      ])}</details></> : <>{fields([['Source lead ID', leadId], ['Original source records', currentSourceLead?.records.length], ['First-record Offershop Source', currentSourceLead?.records[0]?.raw['Offershop Source']], ['First-record Offershop Grade', currentSourceLead?.records[0]?.raw['Offershop Grade']], ['Normalized current stage', 'Unavailable'], ['Validation status', validation]])}{analyticalUnavailable}</>}<p className="cx-dossier-note">Summary describes the selected evidence. Journey contains recorded milestones; Calls and Outcomes retain their own details. Qualification and limitations remain in Audit.</p><button type="button" className="cx-button-secondary" onClick={() => source([])}>View source evidence</button>{analytical && suppliedSource && onOpenAnalytical && <button type="button" className="cx-button-secondary" onClick={onOpenAnalytical}>Open analytical lead</button>}</>}
      {activeTab === 'Journey' && (analytical ? <><LeadJourney row={analytical.row} validationStatus={validation} auditScope={pinnedAuditScope(auditModel)} onViewSource={source} sourceEvents={currentTimeline?.events} onPinEvent={onPin ? pinEvent : undefined} />{loading && <p role="status">Loading scoped source milestones…</p>}{error && <p role="alert">Source milestone request failed: {error}</p>}{currentTimeline?.callEvidence && <p className="cx-dossier-note">{currentTimeline.callEvidence.status}: {currentTimeline.callEvidence.reason}</p>}</> : analyticalUnavailable)}
      {activeTab === 'Calls' && (analytical ? <><h3>Recorded call aggregates</h3>{fields([['Total calls', ledgerCalls(analytical.row.total_calls)], ['First dial', analytical.row.first_call_time], ['Last disposition', analytical.row.last_dialer_status], ['RPC', outcomeText(analytical.row.contacted)]])}<p>Individual attempt timestamps, dispositions per attempt and RPC attempt number are unavailable. The aggregate count is not an attempt history.</p>{currentTimeline?.callEvidence && <p>{currentTimeline.callEvidence.reason}</p>}<button type="button" className="cx-button-secondary" onClick={() => source(['HLC Total Calls', 'HLC First Call Date', 'HLC Last Dialer Status', 'HLC RPC'])}>View call source fields</button></> : analyticalUnavailable)}
      {activeTab === 'Outcomes' && (analytical ? <><h3>Recorded outcome evidence</h3>{fields([['RPC · contacted', outcomeText(analytical.row.contacted)], ['Sale · sale', outcomeText(analytical.row.sale)], ['Activation · activated', outcomeText(analytical.row.activated)], ['Last disposition · last_dialer_status', analytical.row.last_dialer_status], ['Source-recorded revenue · revenue', recordedRevenue(analytical.row.revenue)]])}<p>Missing evidence remains unavailable. A recorded downstream outcome does not create an upstream event, collected cash or a confirmed event time.</p><button type="button" className="cx-button-secondary" onClick={() => source(['HLC RPC', 'HLC Sale', 'HLC Activated', 'HLC Revenue Generated', 'HLC Last Dialer Status'])}>View outcome source fields</button></> : analyticalUnavailable)}
      {activeTab === 'Audit' && <><AuditDimensions dimensions={audit.dimensions} label="Selected evidence state" /><EvidenceTrace nodes={audit.trace} label="Selected evidence lineage" /><h3>Supplied qualification flags</h3>{fields(audit.qualifications.map(item => [`${item.label} · ${item.field}`, item.value]))}<p>Qualification is shown only when supplied in the analytical row. Original source records stay separate; the investigation qualifies the lead, not every attached transaction.</p>{audit.chronology.length > 0 && <section aria-label="Recorded chronology anomalies"><h3>Chronology anomalies</h3>{audit.chronology.map((anomaly, index) => <p key={index}>{anomaly}</p>)}</section>}<details><summary>Evidence definition, scope and limitations</summary>{analytical && <>{fields(returnedEvidenceFields(analytical.result).map(field => [field.label, field.value]))}{fields([['Metric', analytical.result.metricId || analytical.result.metadata?.metricId], ['Definition version', analytical.result.definitionVersion || analytical.result.metadata?.definitionVersion], ['Source tables', analytical.result.metadata?.sourceTables ? JSON.stringify(analytical.result.metadata.sourceTables) : analytical.result.metadata?.source], ['Validation', validation]])}<p>{analytical.row.investigationReason?.detail || 'No additional inclusion definition was returned for this record.'}</p><ul>{journey?.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul></>}{currentSourceReport && <>{fields(returnedEvidenceFields(currentSourceReport).map(field => [`Source · ${field.label}`, field.value]))}<p>{currentSourceReport.metadata.timestampInterpretation}</p></>}<p>Missing evidence remains unavailable. An original source identity match does not verify normalized chronology or business completion.</p></details>{analytical && <details><summary>All returned analytical evidence fields</summary>{fields(Object.entries(analytical.row).map(([key, value]) => [key, value !== null && typeof value === 'object' ? JSON.stringify(value) : value]))}</details>}</>}
      {activeTab === 'Source' && <>{onOpenSource && leadId && <button type="button" className="cx-button-secondary" onClick={() => onOpenSource(leadId, focusFields)}>Open in Source Evidence</button>}{analytical && onOpenAnalytical && <button type="button" className="cx-button-secondary" onClick={onOpenAnalytical}>Open analytical lead</button>}{!analytical && onRequestAnalytical && analyticalUnavailable}{suppliedSource ? currentSourceLead?.records.length ? <SuppliedSource lead={currentSourceLead} report={currentSourceReport} focusFields={focusFields} analyticalLeadId={analytical ? leadId : undefined} /> : <p>{currentSourceReport ? 'No exact source lead match was returned in the current source scope.' : 'Source evidence has not been returned for this selection.'}{currentSourceReport?.metadata.hasMore ? ' The source population is a partial page; no other lead is substituted.' : ''}</p> : analytical ? <DossierSource key={scopeKey + leadId} leadId={leadId} focusFields={focusFields} scopeKey={scopeKey} segmentVendor={segmentVendor} /> : <p>Source evidence unavailable for this selection.</p>}</>}
    </section>
    </>}
  </aside>;
}
