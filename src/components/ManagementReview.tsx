import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Copy, RefreshCw, X } from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useOperationalData } from '../lib/useOperationalData';
import { fetchOverview, type OverviewData } from '../lib/offernetClient';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import { navigationPage } from '../lib/navigation';
import { completedReviewWeek, previousCalendarWindow, REVIEW_QUESTIONS, reviewMetrics, reviewMetricText, validReviewWindow } from '../lib/reviewModel';

export default function ManagementReview({ onClose, onNavigate }: { onClose: () => void; onNavigate: () => void }) {
  const { selectedClient, clientConfig } = useClient();
  const { startDate, endDate, filters, setDateRange } = useFilters();
  const scoped = useScopedNavigationTarget();
  const [questionId, setQuestionId] = useState<string>('change');
  const [notice, setNotice] = useState('');
  const bounded = validReviewWindow(startDate, endDate);
  const scope = { clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined, ...extractOffernetFilters(filters) };
  // Same key/fetcher as Overview: opening this view does not require a parallel dashboard API.
  const { data, loading, error, loadData, receivedAt } = useOperationalData<OverviewData>('ExecutiveOverview', scope, fetchOverview, bounded);
  const metrics = reviewMetrics(data);
  const question = REVIEW_QUESTIONS.find(item => item.id === questionId) || REVIEW_QUESTIONS[0];
  const expected = previousCalendarWindow(startDate, endDate);
  const comparison = data?.comparisonWindow;
  const caption = comparison ? `${comparison.startDate} to ${comparison.endDate} (API comparison)` : expected ? `${expected.startDate} to ${expected.endDate} (expected; awaiting evidence)` : 'Select both reporting dates';
  const setWeek = () => {
    try {
      const range = completedReviewWeek(new Date(), clientConfig?.timezone || 'Africa/Johannesburg');
      setDateRange(range.startDate, range.endDate);
      setNotice('Last complete week applied to the current reporting scope. Existing filters are unchanged.');
    } catch { setNotice('The workspace timezone could not be resolved. Select reporting dates using the page filters.'); }
  };
  const copy = async () => {
    if (!data) return;
    const text = [
      `OfferNet review — ${data.clientName || selectedClient}`,
      `Capture cohort: ${startDate} to ${endDate}`,
      `Comparison: ${caption}`,
      `Filters: ${JSON.stringify(filters)}`,
      `Validation: ${data.validationStatus}; source cutoff not supplied by overview`,
      ...metrics.map(metric => `${metric.label}: ${reviewMetricText(metric.value, metric.unit)}; change: ${metric.delta === null ? 'unavailable' : `${metric.delta > 0 ? '+' : ''}${metric.delta.toFixed(2)}${metric.deltaUnit}`}; ${metric.calculation}`),
      'Equal calendar periods do not equalise follow-up age. Missing outcomes are not failed outcomes.',
      'Recorded values are not billing approval or profit. Planning budget is not actual spend.',
    ].join('\n');
    try { await navigator.clipboard.writeText(text); setNotice('Review summary copied with scope, definitions and limitations.'); }
    catch { setNotice('Clipboard access was denied. The review remains available on screen.'); }
  };
  return <>
    <header className="cx-review-header"><div><h2>Management review</h2><p>What changed, what needs checking, and where to investigate.</p></div><button type="button" className="cx-icon-button" aria-label="Close management review" onClick={onClose}><X size={19}/></button></header>
    <div className="cx-review-body">
      <div className="cx-review-scope"><strong>{clientConfig?.name || selectedClient}</strong><span>{bounded ? `${startDate} to ${endDate}` : 'An explicit date range is required'}</span><button type="button" className="cx-button-secondary" onClick={setWeek}>Last complete week</button><button type="button" className="cx-button-secondary" disabled={!bounded || loading} onClick={() => { void loadData(true); }}><RefreshCw size={14}/>Refresh</button></div>
      <p className="cx-review-note">Comparison: {caption}. Equal-length dates do not equalise lead maturity or feed completeness.</p>
      {Object.keys(filters).length > 0 && <details className="cx-read-guide"><summary>Applied filters ({Object.keys(filters).length})</summary><pre>{JSON.stringify(filters, null, 2)}</pre></details>}
      {!bounded && <p role="note" className="cx-review-warning">No all-time review query has been sent. Choose a complete week or apply both dates on the page.</p>}
      {loading && <p role="status">Loading the selected review…</p>}
      {error && <p role="alert" className="cx-review-warning">{error}</p>}
      {data && <>
        <div className="cx-review-table-wrap"><table className="cx-review-table"><caption>Recorded performance for the selected capture cohort</caption><thead><tr><th>Measure</th><th>Current</th><th>Change</th><th>Calculation</th></tr></thead><tbody>{metrics.map(metric => <tr key={metric.id}><th scope="row">{metric.label}</th><td>{reviewMetricText(metric.value, metric.unit)}</td><td>{metric.delta === null ? 'Unavailable' : `${metric.delta > 0 ? '+' : ''}${metric.delta.toFixed(2)}${metric.deltaUnit}`}</td><td>{metric.calculation}</td></tr>)}</tbody></table></div>
        <p className="cx-review-note">One selected lead per operational measure after tenant/vendor scoping. Call-event, marketing and contract populations must not be added to these counts. Source data cutoff: not supplied by Overview.{receivedAt ? ` Last received by this browser: ${new Date(receivedAt).toLocaleString()}.` : ''}</p>
        <div className="cx-review-facts"><div><span>Awaiting first dial</span><strong>{reviewMetricText(data.backlog.awaitingFirstDial, 'count')}</strong><small>No recorded first-dial event in this scope</small></div><div><span>Median delivery → first dial</span><strong>{data.sla.medianDeliveryToDial || 'Unavailable'}</strong><small>Valid recorded timestamp pairs</small></div><div><span>Evidence status</span><strong>{data.validationStatus.replace(/_/g, ' ')}</strong><small>Not a certification of live source completeness</small></div></div>
      </>}
      <section className="cx-review-questions" aria-label="Guided investigation"><h3>Choose the question you need to answer</h3><div className="cx-question-options">{REVIEW_QUESTIONS.map(item => <button key={item.id} type="button" aria-pressed={questionId === item.id} onClick={() => setQuestionId(item.id)}>{item.title}</button>)}</div><p>{question.detail}</p><ol className="cx-review-steps">{question.paths.map(path => <li key={path}><Link to={scoped(path)} onClick={onNavigate}>{navigationPage(path)?.name || path}<ArrowRight size={14} aria-hidden="true"/></Link></li>)}</ol></section>
      <details className="cx-read-guide"><summary>What is not yet supported by the source evidence?</summary><p>Actual spend needs an approved observed-spend feed; budget remains planning-only. Full BLC contract-stage reporting requires validated lead/consumer/contract links and retained status history. Live agent states and retry adherence require event-level dialler feeds and approved, effective-dated rules. None is inferred from a missing value.</p></details>
      <div className="cx-review-footer"><Link to={scoped('/data-integrity')} onClick={onNavigate}>Check source completeness</Link><button type="button" className="cx-button-secondary" disabled={!data || loading || !!error} onClick={() => { void copy(); }}><Copy size={14}/>Copy review summary</button></div>
      <p role="status" className="cx-review-note">{notice}</p>
    </div>
  </>;
}
