import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClient } from '../../lib/ClientContext';
import { getAnalyticalSessionGeneration, getAnalyticalSessionKey, subscribeToAnalyticalSession } from '../../lib/analyticalSession';
import { createSavedInvestigation, deleteSavedInvestigation, listSavedInvestigations, savedInvestigationDraftFromDefinition, updateSavedInvestigation } from '../../lib/savedInvestigations';
import type { SavedInvestigationDefinition, SavedInvestigationDraft, SavedInvestigationList } from '../../../contracts/savedAnalysis';
import { useInvestigationModel } from './InvestigationContextBar';
import type { InvestigationModel } from './investigationModel';
import { buildSavedInvestigationDraft, savedInvestigationPath, savedInvestigationSummary } from './savedInvestigationModel';
import '../../styles/savedInvestigations.css';

const sessionSnapshot = () => `${getAnalyticalSessionGeneration()}:${getAnalyticalSessionKey()}`;
const subscribeSession = (notify: () => void) => subscribeToAnalyticalSession(() => notify());
const message = (error: unknown) => error instanceof Error ? error.message : 'Saved investigations are unavailable. Please retry.';
const newestFirst = (definitions: SavedInvestigationDefinition[]) => [...definitions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name));

function SavedInvestigationPanel({ model, params }: { model: InvestigationModel; params: URLSearchParams }) {
  const navigate = useNavigate();
  const [result, setResult] = useState<SavedInvestigationList | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [pending, setPending] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const mutation = useRef<AbortController | null>(null);
  const scopeKey = params.toString();
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;

  useEffect(() => {
    const controller = new AbortController();
    const generation = getAnalyticalSessionGeneration();
    const current = () => !controller.signal.aborted && generation === getAnalyticalSessionGeneration();
    setLoading(true); setLoadError(''); setResult(null);
    void listSavedInvestigations(model.clientId, controller.signal).then(data => {
      if (current()) setResult({ ...data, definitions: newestFirst(data.definitions) });
    }).catch(error => { if (current()) setLoadError(message(error)); })
      .finally(() => { if (current()) setLoading(false); });
    return () => controller.abort();
  }, [model.clientId, retry]);

  useEffect(() => {
    mutation.current?.abort();
    setPending(''); setName(''); setEditing(null); setActionError(''); setNotice('');
    return () => mutation.current?.abort();
  }, [scopeKey]);

  let draft: SavedInvestigationDraft | null = null;
  let scopeError = '';
  try { draft = buildSavedInvestigationDraft(model, params, 'Current investigation'); }
  catch (error) { scopeError = message(error); }

  async function perform(action: string, run: (signal: AbortSignal) => Promise<SavedInvestigationDefinition | void>, complete: (value: SavedInvestigationDefinition | void) => void) {
    if (mutation.current && !mutation.current.signal.aborted) return;
    const controller = new AbortController();
    const generation = getAnalyticalSessionGeneration();
    mutation.current = controller;
    setPending(action); setActionError(''); setNotice('');
    const current = () => !controller.signal.aborted && generation === getAnalyticalSessionGeneration() && scopeKey === currentScope.current;
    try {
      const value = await run(controller.signal);
      if (current()) complete(value);
    } catch (error) {
      if (current()) setActionError(message(error));
    } finally {
      if (mutation.current === controller) mutation.current = null;
      if (current()) setPending('');
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    let submission: SavedInvestigationDraft;
    try { submission = buildSavedInvestigationDraft(model, params, name); }
    catch (error) { setActionError(message(error)); return; }
    void perform('save', signal => createSavedInvestigation(submission, signal), value => {
      if (!value) return;
      setResult(previous => previous ? { ...previous, definitions: newestFirst([...previous.definitions, value]) } : previous);
      setName(''); setNotice(`Saved “${value.name}”. Opening it will reload current observations.`);
    });
  }

  function rename(event: React.FormEvent, definition: SavedInvestigationDefinition) {
    event.preventDefault();
    if (!editing || editing.id !== definition.id) return;
    const submission = { ...savedInvestigationDraftFromDefinition(definition), name: editing.name };
    void perform(definition.id, signal => updateSavedInvestigation(definition, submission, signal), value => {
      if (!value) return;
      setResult(previous => previous ? { ...previous, definitions: newestFirst(previous.definitions.map(item => item.id === value.id ? value : item)) } : previous);
      setEditing(null); setNotice(`Renamed to “${value.name}”.`);
    });
  }

  function remove(definition: SavedInvestigationDefinition) {
    void perform(definition.id, signal => deleteSavedInvestigation(definition, signal), () => {
      setResult(previous => previous ? { ...previous, definitions: previous.definitions.filter(item => item.id !== definition.id) } : previous);
      setEditing(null); setNotice(`Deleted saved definition “${definition.name}”.`);
    });
  }

  const atLimit = Boolean(result && result.definitions.length >= result.limit);
  return <div className="cx-saved-investigations-body">
    <p>Private to your account in {model.clientLabel}. Saved definitions reload current observations; they do not freeze a result or save record data, searches, evidence pins, or notes.</p>
    {loading ? <p role="status">Loading saved investigations…</p> : loadError ? <div role="alert"><p>{loadError}</p><button type="button" className="cx-button-secondary" onClick={() => setRetry(value => value + 1)}>Retry saved investigations</button></div>
      : result?.configured === false ? <p role="status">Saved investigations are not configured for this deployment. Your current investigation remains available in this session.</p>
        : result ? <>
          <form className="cx-saved-investigation-form" onSubmit={save} aria-label="Save current investigation">
            <h3>Save current investigation</h3>
            {draft ? <p className="cx-saved-investigation-scope">{savedInvestigationSummary(draft)}</p> : <p role="status" className="cx-saved-investigation-limitation">This scope cannot be saved: {scopeError}</p>}
            <div className="cx-saved-investigation-form-row"><label>Investigation name<input value={name} onChange={event => setName(event.target.value)} maxLength={100} required disabled={!draft || Boolean(pending) || atLimit} autoComplete="off" placeholder="Name this investigation" /></label><button type="submit" className="cx-button-primary" disabled={!draft || Boolean(pending) || atLimit}>{pending === 'save' ? 'Saving…' : 'Save investigation'}</button></div>
            {atLimit && <p role="status">You have reached the limit of {result.limit} saved investigations in this workspace. Delete a saved definition to make room.</p>}
          </form>
          <div className="cx-saved-investigation-list-heading"><h3>Your saved investigations</h3><div className="cx-saved-investigation-actions"><span>{result.definitions.length} of {result.limit}</span><button type="button" className="cx-button-secondary" disabled={Boolean(pending)} onClick={() => { setEditing(null); setActionError(''); setNotice(''); setRetry(value => value + 1); }}>Refresh saved list</button></div></div>
          {result.definitions.length ? <ul className="cx-saved-investigation-list">{result.definitions.map(definition => <li key={definition.id}>
            <div className="cx-saved-investigation-description"><strong>{definition.name}</strong><p>{savedInvestigationSummary(definition)}</p><small>Updated {definition.updatedAt.slice(0, 10)} · Current observations</small></div>
            {editing?.id === definition.id ? <form className="cx-saved-investigation-rename" aria-label={`Rename ${definition.name}`} onSubmit={event => rename(event, definition)}><label>New investigation name<input autoFocus value={editing.name} onChange={event => setEditing({ id: definition.id, name: event.target.value })} maxLength={100} required disabled={Boolean(pending)} autoComplete="off" /></label><div className="cx-saved-investigation-actions"><button type="submit" className="cx-button-primary" disabled={Boolean(pending)}>{pending === definition.id ? 'Saving…' : 'Save name'}</button><button type="button" className="cx-button-secondary" disabled={Boolean(pending)} onClick={() => setEditing(null)}>Cancel</button></div></form>
              : <div className="cx-saved-investigation-actions"><button type="button" className="cx-button-secondary" disabled={Boolean(pending)} aria-label={`Open ${definition.name}`} onClick={() => { try { navigate(savedInvestigationPath(definition)); } catch (error) { setActionError(message(error)); } }}>Open</button><button type="button" className="cx-button-secondary" disabled={Boolean(pending)} aria-label={`Rename ${definition.name}`} onClick={() => { setEditing({ id: definition.id, name: definition.name }); setActionError(''); setNotice(''); }}>Rename</button><button type="button" className="cx-button-danger" disabled={Boolean(pending)} aria-label={`Delete ${definition.name}`} onClick={() => remove(definition)}>{pending === definition.id ? 'Deleting…' : 'Delete'}</button></div>}
          </li>)}</ul> : <p>No saved investigations in this workspace yet.</p>}
        </> : null}
    {actionError && <p role="alert">{actionError}</p>}
    {notice && <p role="status" className="cx-saved-investigation-notice">{notice}</p>}
  </div>;
}

function SavedInvestigationsDisclosure() {
  const { ready, selectedClient } = useClient();
  const model = useInvestigationModel();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  return <details className="cx-saved-investigations" open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary>Saved investigations</summary>
    {open && (ready && selectedClient ? <SavedInvestigationPanel model={model} params={params} /> : <p role="status">Select an authorised workspace to use saved investigations.</p>)}
  </details>;
}

export default function SavedInvestigations() {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot, sessionSnapshot);
  const { selectedClient, ready } = useClient();
  return <SavedInvestigationsDisclosure key={`${session}:${selectedClient}:${ready}`} />;
}
