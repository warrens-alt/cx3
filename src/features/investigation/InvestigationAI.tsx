import React, { useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { extractOffernetFilters } from '../../lib/FilterContext';
import { fetchAiInsights, type AiInsightsData } from '../../lib/offernetClient';
import { useOperationalData } from '../../lib/useOperationalData';
import { useInvestigationModel } from './InvestigationContextBar';
import { investigationPath, investigationRequest, investigationScopeText, matchesInvestigationResponse } from './investigationModel';

const QUESTIONS = ['Summarise what distinguishes this population.', 'Which vendors are most concentrated?', 'What evidence is missing?', 'What can and cannot be concluded?', 'Which records should I inspect first?'];
export default function InvestigationAI() {
  const { isAdmin } = useAuth();
  const questionId = useId();
  const model = useInvestigationModel();
  const [params] = useSearchParams();
  const query = { clientId: model.clientId, startDate: model.startDate || undefined, endDate: model.endDate || undefined, ...extractOffernetFilters(model.filters), ...investigationRequest(params), search: params.get('search') || undefined, metric: model.metric || undefined };
  const scopeKey = JSON.stringify(query);
  const [question, setQuestion] = useState('');
  const [request, setRequest] = useState<{ scopeKey: string; question: string } | null>(null);
  const enabled = request?.scopeKey === scopeKey;
  const { data, loading, error } = useOperationalData<AiInsightsData>('investigation-ai', { ...query, question: enabled ? request.question : undefined }, fetchAiInsights, enabled);
  const result = enabled && matchesInvestigationResponse(data, query) ? data : null;
  const ask = (value: string) => { if (value.trim()) { setQuestion(value); setRequest({ scopeKey, question: value.trim() }); } };
  return <details className="cx-investigation-ai"><summary>Ask ConversionX</summary><p>Explore this investigation using its supplied deterministic evidence. Interpretations do not establish causes or change validation.</p><p><strong>Scope:</strong> {investigationScopeText(model)}{params.has('search') ? ' · Current record search applied' : ''}</p>
    <div className="cx-investigation-ai-questions">{QUESTIONS.map(value => <button type="button" className="cx-button-secondary" key={value} disabled={loading} onClick={() => ask(value)}>{value}</button>)}</div>
    <form onSubmit={event => { event.preventDefault(); ask(question); }}><label className="sr-only" htmlFor={questionId}>Question about this investigation</label><input id={questionId} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask about the exact selected population…" maxLength={1000}/><button type="submit" className="cx-button-primary" disabled={loading || !question.trim()}>Ask</button></form>
    {loading && <p role="status">Preparing synthesis for this scope…</p>}{error && <p role="alert">{error}</p>}{enabled && data && !result && <p role="alert">The response did not confirm this investigation scope. No broader synthesis is shown.</p>}
    {result && <div className="cx-investigation-ai-result"><dl className="cx-investigation-scope"><div><dt>Source</dt><dd>{result.source}</dd></div><div><dt>Model</dt><dd>{result.model || 'No model supplied'}</dd></div><div><dt>Validation</dt><dd>{result.validationStatus || 'NOT_VERIFIED'}</dd></div><div><dt>Population</dt><dd>{result.populationCount ?? 'Unavailable'}</dd></div></dl><h3>Interpretation of supplied evidence</h3><p>{result.executiveSummary}</p>{result.strategicFocus && <p>{result.strategicFocus}</p>}{result.insights.map((insight, index) => <article className="cx-investigation-ai-insight" key={index}><h4>{insight.category}</h4><p>{insight.finding}</p><p><strong>Evidence reference:</strong> <code>{insight.metricReference || 'No reference supplied for this statement.'}</code></p>{insight.directive && <p><strong>Suggested next inspection:</strong> {insight.directive}</p>}</article>)}<details open><summary>Supplied metric references</summary><ul>{(result.metricReferences || []).map(reference => <li key={reference}>{reference}</li>)}</ul>{!result.metricReferences?.length && <p>No metric references supplied.</p>}</details><details open><summary>Limitations and unknowns</summary><ul>{(result.limitations || [result.reason || 'Evidence completeness is not independently verified.']).map(limitation => <li key={limitation}>{limitation}</li>)}</ul></details><div className="cx-investigation-actions">{isAdmin && <Link className="cx-button-secondary" to={investigationPath('/lead-explorer', params)}>Inspect scoped records</Link>}<Link className="cx-button-secondary" to={investigationPath('/data-integrity', params)}>Inspect source coverage</Link></div></div>}
  </details>;
}
