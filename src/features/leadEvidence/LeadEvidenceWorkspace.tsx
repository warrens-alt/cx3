import React, { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useClient } from '../../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../../lib/FilterContext';
import { getAnalyticalSessionKey, subscribeToAnalyticalSession } from '../../lib/analyticalSession';
import { useOperationalData } from '../../lib/useOperationalData';
import { fetchRawLeads, fetchLeadTimeline, type RawLeadsData, type LeadTimelineData } from '../../lib/offernetClient';
import type { LedgerLead, LedgerReplicaReport } from '../../../contracts/leadLedgerReplica';
import type { InvestigationLead } from '../investigation/InvestigationRecordList';
import LeadDossier from '../investigation/LeadDossier';
import { useEvidenceTray } from '../investigation/EvidenceTray';
import InvestigationContextBar from '../investigation/InvestigationContextBar';
import { investigationLabel, INVESTIGATION_KEYS } from '../investigation/investigationModel';
import LeadEvidenceModeTabs, { type LeadEvidenceMode } from './LeadEvidenceModeTabs';
import LeadPopulationBrowser from './LeadPopulationBrowser';
import LeadSourceBrowser from './LeadSourceBrowser';
import type { LeadEvidenceSelection, SourceFocus } from './leadEvidenceSelection';
import './leadEvidence.css';

/** Composition only: analytical rows and original source records retain separate models/caches. */
export default function LeadEvidenceWorkspace() {
  const [params, setParams] = useSearchParams();
  const { selectedClient } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters } = useFilters();
  const session = useSyncExternalStore(subscribeToAnalyticalSession, getAnalyticalSessionKey, getAnalyticalSessionKey);
  const mode: LeadEvidenceMode = params.get('view') === 'source' ? 'source' : 'population';
  const sourceMode = params.get('sourceMode') === 'rich' ? 'rich' : 'configured';
  const caseScope = Object.fromEntries([...INVESTIGATION_KEYS].map(key => [key, params.get(key)]).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const boundary = JSON.stringify([session, isAdmin, selectedClient, startDate, endDate, filters, caseScope, params.get('search'), params.get('sourceSearch'), sourceMode]);
  const [storedSelection, setSelection] = useState<LeadEvidenceSelection | null>(null);
  const selection = isAdmin && storedSelection?.boundary === boundary ? storedSelection : null;
  const [storedSourceFocus, setSourceFocus] = useState<{ boundary: string; focus: SourceFocus } | null>(null);
  const sourceFocus = storedSourceFocus?.boundary === boundary ? storedSourceFocus.focus : undefined;
  const [populationFocus, setPopulationFocus] = useState<{ boundary: string; leadId: string } | null>(null);
  const [matchRequest, setMatchRequest] = useState<{ boundary: string; leadId: string } | null>(null);
  const modeId = useId();
  const requestedModeFocus = useRef<LeadEvidenceMode | null>(null);
  const dossierId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const { pin } = useEvidenceTray();
  const activeCase = INVESTIGATION_KEYS.some(key => params.has(key));

  useEffect(() => { setSelection(null); setSourceFocus(null); setPopulationFocus(null); setMatchRequest(null); }, [boundary]);
  useEffect(() => {
    if (params.has('view') && !['population', 'source'].includes(params.get('view') || '')) setParams(previous => { const next = new URLSearchParams(previous); next.set('view', 'population'); return next; }, { replace: true });
    if (params.has('preset') && !['investigation', 'journey', 'contact', 'outcomes', 'full'].includes(params.get('preset') || '')) setParams(previous => { const next = new URLSearchParams(previous); next.delete('preset'); return next; }, { replace: true });
  }, [params, setParams]);
  const changeMode = useCallback((next: LeadEvidenceMode) => {
    requestedModeFocus.current = next;
    if (next === 'source' && selection?.row && selection.leadId) {
      const leadId = selection.leadId;
      setSourceFocus(previous => previous?.boundary === boundary && previous.focus.leadId === leadId ? previous : { boundary, focus: { leadId, fields: [] } });
    }
    if (next === 'population') setMatchRequest(null);
    if (next === 'population' && selection?.origin === 'source' && !selection.row) setSelection(null);
    setParams(previous => { const value = new URLSearchParams(previous); value.set('view', next); return value; });
  }, [setParams, selection, boundary]);
  useEffect(() => {
    if (requestedModeFocus.current !== mode) return;
    requestedModeFocus.current = null;
    const frame = requestAnimationFrame(() => document.getElementById(`${modeId}-${mode}-tab`)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [mode, modeId]);
  const focusDossier = () => requestAnimationFrame(() => {
    const element = document.getElementById(dossierId);
    element?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 1000px)').matches) element?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  const closeDossier = useCallback(() => {
    const leadId = selection?.leadId;
    setSelection(null); setMatchRequest(null); setPopulationFocus(null);
    requestAnimationFrame(() => {
      const visible = (element: HTMLElement | null) => Boolean(element?.isConnected && element.getClientRects().length);
      const matching = [...document.querySelectorAll<HTMLButtonElement>('button[data-lead-id]')].find(button => button.dataset.leadId === leadId && visible(button));
      (matching || (visible(triggerRef.current) ? triggerRef.current : null) || document.getElementById(`${modeId}-${mode}-tab`))?.focus();
    });
  }, [selection?.leadId, modeId, mode]);
  const selectAnalytical = (row: InvestigationLead, result: RawLeadsData, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setMatchRequest(null);
    setSelection({ boundary, leadId: String(row.lead_id), row, result, origin: 'population' });
    focusDossier();
  };
  const selectSource = (lead: LedgerLead, report: LedgerReplicaReport, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setMatchRequest(null);
    setSelection(previous => ({ boundary, leadId: lead.leadId || null, sourceKey: lead.key, sourceLead: lead, sourceReport: report, origin: 'source', ...(previous?.boundary === boundary && previous.leadId && previous.leadId === lead.leadId ? { row: previous.row, result: previous.result } : {}) }));
    focusDossier();
  };
  const sourceResolved = useCallback((report: LedgerReplicaReport | null) => {
    setSelection(previous => {
      if (!previous || previous.boundary !== boundary) return previous;
      const lead = report?.leads.find(item => previous.sourceKey ? item.key === previous.sourceKey : Boolean(previous.leadId && item.leadId === previous.leadId));
      if (report && !lead && previous.origin === 'source') return null;
      if (previous.sourceReport === report && previous.sourceLead === lead) return previous;
      return { ...previous, sourceLead: lead, sourceReport: report || undefined };
    });
  }, [boundary]);
  const populationResolved = useCallback((result: RawLeadsData) => {
    setSelection(previous => {
      if (!previous?.row || previous.boundary !== boundary) return previous;
      const row = result.rows.find(item => String(item.lead_id) === previous.leadId);
      if (!row) return null;
      return previous.row === row && previous.result === result ? previous : { ...previous, row, result };
    });
  }, [boundary]);
  const openSource = (leadId: string, fields: string[]) => {
    if (!isAdmin || selection?.leadId !== leadId) return;
    setSourceFocus({ boundary, focus: { leadId, fields } });
    changeMode('source');
  };
  const requestLead = matchRequest?.boundary === boundary && mode === 'source' && selection?.leadId === matchRequest.leadId ? matchRequest.leadId : null;
  const exactFilters = requestLead && !filters.lead_id ? { ...filters, lead_id: { operator: 'equals' as const, value: requestLead } } : filters;
  const analyticalMatch = useOperationalData<RawLeadsData>('lead-evidence-exact-match', {
    clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined,
    ...extractOffernetFilters(exactFilters), ...caseScope, search: params.get('search') || requestLead || undefined, limit: 25, offset: 0,
  }, fetchRawLeads, isAdmin && Boolean(requestLead));
  useEffect(() => {
    if (!requestLead || !analyticalMatch.data || analyticalMatch.data.clientId !== selectedClient || analyticalMatch.error || analyticalMatch.loading) return;
    const row = analyticalMatch.data.rows.find(item => String(item.lead_id) === requestLead);
    if (!row) return;
    setSelection(previous => previous?.boundary === boundary && previous.leadId === requestLead && previous.row !== row ? { ...previous, row, result: analyticalMatch.data! } : previous);
  }, [requestLead, analyticalMatch.data, analyticalMatch.loading, analyticalMatch.error, selectedClient, boundary]);
  const openAnalytical = () => {
    if (!selection?.row || !selection.result || String(selection.row.lead_id) !== selection.leadId) return;
    setPopulationFocus({ boundary, leadId: selection.leadId! });
    setMatchRequest(null);
    changeMode('population');
  };
  const timeline = useOperationalData<LeadTimelineData>('lead-timeline', {
    clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined,
    ...extractOffernetFilters(filters), ...caseScope, search: params.get('search') || undefined, leadId: selection?.row ? selection.leadId : null,
  }, ({ leadId, ...scope }, refresh, signal) => fetchLeadTimeline(leadId, scope, refresh, signal), isAdmin && mode === 'population' && Boolean(selection?.row));
  const navigation = <><LeadEvidenceModeTabs id={modeId} mode={mode} onChange={changeMode} />{mode === 'source' && activeCase && <><InvestigationContextBar dateBasis="Fetched source cohort" countingGrain="Separate lead/vendor source records" /><p className="cx-lead-evidence-boundary">The investigation qualifies analytical leads. Reporting dates and global filters apply to original source records; analytical predicates and segments remain context and do not independently qualify every source transaction.</p></>}</>;
  const dossier = selection && <LeadDossier key={`${boundary}:${selection.leadId || selection.sourceKey}:${mode}`} id={dossierId} row={selection.row} result={selection.result} scopeKey={boundary} investigation={activeCase ? investigationLabel(params) : null} timeline={timeline.data} loading={timeline.loading} error={timeline.error} onClose={closeDossier}
    sourceLead={selection.sourceLead} sourceReport={selection.sourceReport} sourceResolved={mode === 'source' || Boolean(selection.sourceReport)} initialTab={mode === 'source' ? 'Source' : 'Summary'} sourceFocusFields={sourceFocus?.fields}
    onOpenSource={openSource} onRequestAnalytical={selection.leadId ? () => setMatchRequest({ boundary, leadId: selection.leadId! }) : undefined} onOpenAnalytical={selection.row && selection.result ? openAnalytical : undefined}
    analyticalLoading={analyticalMatch.loading} analyticalError={analyticalMatch.error || (requestLead && analyticalMatch.data && !selection.row ? 'No exact analytical lead match was returned in the current reporting/investigation scope.' : null)}
    segmentVendor={params.get('segmentVendor') || undefined} onPin={selection.row ? item => pin({ ...item, kind: item.type }, { validationStatus: selection.result?.validationStatus || 'NOT_VERIFIED' }) : undefined} />;
  return <div id={`${modeId}-${mode}-panel`} role="tabpanel" aria-labelledby={`${modeId}-${mode}-tab`} className="cx-lead-evidence-page">{mode === 'population'
    ? <LeadPopulationBrowser navigation={navigation} selection={selection} onSelect={selectAnalytical} onClose={closeDossier} dossier={dossier} dossierId={dossierId} scopeKey={boundary} onPopulationResolved={populationResolved} focusLeadId={populationFocus?.boundary === boundary ? populationFocus.leadId : undefined} onClearFocus={() => { setPopulationFocus(null); setSelection(null); }} />
    : <LeadSourceBrowser sourceMode={sourceMode} setSourceMode={value => setParams(previous => { const next = new URLSearchParams(previous); next.set('sourceMode', value); return next; })} sourceFocus={sourceFocus} workspaceNavigation={navigation} selection={selection} dossier={dossier} dossierId={dossierId} onSelect={selectSource} onSourceResolved={sourceResolved} onClearFocus={() => { setSourceFocus(null); setSelection(null); setMatchRequest(null); }} boundary={boundary} />}</div>;
}
