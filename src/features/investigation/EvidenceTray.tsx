import React, { createContext, useContext, useEffect, useState } from 'react';
import { ChevronDown, Pin, ShieldQuestion } from 'lucide-react';
import { useClient } from '../../lib/ClientContext';
import { useAuth } from '../../lib/AuthContext';
import { getAnalyticalSessionKey, subscribeToAnalyticalSession } from '../../lib/analyticalSession';
import { downloadAnalysisCsv } from '../../lib/analysisExport';
import { useInvestigationModel } from './InvestigationContextBar';
import { investigationScopeText, type InvestigationModel } from './investigationModel';

export interface EvidencePin {
  kind: 'metric' | 'exception' | 'driver' | 'segment' | 'lead' | 'timeline-event';
  label: string; value: string; definition: string; provenance: string | string[]; identifier: string; observedAt?: string;
}
interface PinnedEvidence extends EvidencePin { id: string; scope: InvestigationModel; pinnedAt: string }
interface EvidenceNotes { conclusion: string; unknowns: string }
const emptyNotes: EvidenceNotes = { conclusion: '', unknowns: '' };
const Context = createContext<{ notes: EvidenceNotes; setNotes: (notes: EvidenceNotes) => void; items: PinnedEvidence[]; pin: (item: EvidencePin, scope: InvestigationModel) => void; remove: (id: string) => void; clear: () => void }>({ notes: emptyNotes, setNotes: () => {}, items: [], pin: () => {}, remove: () => {}, clear: () => {} });
export function InvestigationEvidenceProvider({ children }: { children: React.ReactNode }) {
  const { selectedClient } = useClient();
  const { isAdmin } = useAuth();
  const [session, setSession] = useState(getAnalyticalSessionKey);
  const boundary = `${session}:${selectedClient}:${isAdmin}`;
  const [state, setState] = useState<{ boundary: string; items: PinnedEvidence[] }>({ boundary, items: [] });
  const [notesState, setNotesState] = useState<{ boundary: string; notes: EvidenceNotes }>({ boundary, notes: emptyNotes });
  useEffect(() => subscribeToAnalyticalSession(next => { setSession(next); setState({ boundary: '', items: [] }); setNotesState({ boundary: '', notes: emptyNotes }); }), []);
  useEffect(() => { setState({ boundary, items: [] }); setNotesState({ boundary, notes: emptyNotes }); }, [boundary]);
  const items = state.boundary === boundary ? state.items : [];
  return <Context.Provider value={{ items, notes: notesState.boundary === boundary ? notesState.notes : emptyNotes, setNotes: notes => setNotesState({ boundary, notes }), pin: (item, scope) => {
    if (scope.clientId !== selectedClient || (!isAdmin && ['lead', 'timeline-event'].includes(item.kind))) return;
    const id = JSON.stringify([item.kind, item.identifier, scope]);
    setState(previous => ({ boundary, items: [...(previous.boundary === boundary ? previous.items.filter(entry => entry.id !== id) : []), { ...item, id, scope: structuredClone(scope), pinnedAt: new Date().toISOString() }] }));
  }, remove: id => setState(previous => ({ boundary, items: previous.boundary === boundary ? previous.items.filter(item => item.id !== id) : [] })), clear: () => { setState({ boundary, items: [] }); setNotesState({ boundary, notes: emptyNotes }); } }}>{children}</Context.Provider>;
}
export function useEvidenceTray() {
  const context = useContext(Context);
  const model = useInvestigationModel();
  return { ...context, pin: (item: EvidencePin, overrides: Partial<InvestigationModel> = {}) => context.pin(item, { ...model, ...overrides }) };
}
export default function EvidenceTray({ rail = false, confidence }: { rail?: boolean; confidence?: React.ReactNode } = {}) {
  const { items, remove, clear, notes, setNotes } = useEvidenceTray();
  const { selectedClient } = useClient();
  const { conclusion, unknowns } = notes;
  const [open, setOpen] = useState(() => rail && typeof window !== 'undefined' && window.matchMedia('(min-width: 1180px)').matches);
  const exportEvidence = () => downloadAnalysisCsv('investigation_evidence', [
    ['Kind', 'Label', 'Value', 'Scope', 'Definition', 'Provenance', 'Identifier', 'Observed / generated at', 'Pinned at', 'Item validation', 'Analyst conclusion', 'Open questions'],
    ...items.map(item => [item.kind, item.label, item.value, investigationScopeText(item.scope), item.definition, Array.isArray(item.provenance) ? item.provenance.join('; ') : item.provenance, item.identifier, item.observedAt || 'Not supplied', item.pinnedAt, item.scope.validationStatus, conclusion, unknowns]),
  ], { clientId: selectedClient, validationStatus: 'NOT_VERIFIED', definitions: 'Locally pinned observations; each row retains its original scope. Analyst conclusions are notes, not validation. Counts across scopes must not be added.' });
  return <details id="investigation-evidence-tray" tabIndex={-1} className={`cx-investigation-tray${rail ? ' cx-investigation-evidence-rail' : ''}`} open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary><Pin size={16} aria-hidden="true"/><span>Evidence <small>· {items.length} pinned {items.length === 1 ? 'observation' : 'observations'}</small></span><ChevronDown className="cx-investigation-tray-chevron" size={15} aria-hidden="true"/></summary><div className="cx-investigation-tray-body">
    <dl className="cx-investigation-case-status" aria-label="Case file status"><div><dt><ShieldQuestion size={14} aria-hidden="true"/>Validation</dt><dd>Not verified</dd></div><div><dt>Conclusion</dt><dd>{conclusion.trim() ? 'Draft note' : 'Incomplete'}</dd></div><div><dt>Open questions</dt><dd>{unknowns.trim() ? 'Notes recorded' : 'Not recorded'}</dd></div></dl>
    <details className="cx-investigation-pin-boundary"><summary>Session evidence scope</summary><p>Local to this session and workspace. Pins retain their observed scope; they are not saved analyses or published evidence releases.</p></details>
    {items.length ? <><ul>{items.map(item => <li key={item.id}><div><strong>{item.label} — {item.value}</strong><p>{item.definition}</p><small>{investigationScopeText(item.scope)} · {item.scope.validationStatus}</small><details><summary>Provenance and timing</summary><p>{Array.isArray(item.provenance) ? item.provenance.join(' · ') : item.provenance}</p><p>Observed/generated: {item.observedAt || 'Not supplied'} · Pinned: {item.pinnedAt}</p></details></div><button type="button" className="cx-button-secondary" aria-label={`Unpin ${item.label}`} onClick={() => remove(item.id)}>Unpin</button></li>)}</ul>
      </> : <p>Pin a metric, exception, driver, segment, lead or journey event to build an evidence trail.</p>}
      {confidence}
      <div id="investigation-conclusion" tabIndex={-1} className="cx-investigation-notes"><label>Analyst conclusion · not validation<textarea value={conclusion} onChange={event => setNotes({ ...notes, conclusion: event.target.value })} placeholder="What does the pinned evidence support?" /></label><label>What remains unknown?<textarea value={unknowns} onChange={event => setNotes({ ...notes, unknowns: event.target.value })} placeholder="Missing evidence, limitations and follow-up questions" /></label></div>{items.length > 0 ? <div className="cx-investigation-actions"><button type="button" className="cx-button-secondary" onClick={exportEvidence}>Export pinned evidence</button><button type="button" className="cx-button-secondary" onClick={clear}>Clear tray</button></div> : <p>No pinned observations support a conclusion yet. Notes remain unverified.</p>}
      </div>
  </details>;
}
