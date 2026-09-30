import React, { useState, useRef, useEffect } from 'react';
import { useOperationalData } from '../lib/useOperationalData';
import {
  AlertTriangle,
  ShieldCheck,
  Lightbulb,
  Send,
  MessageSquare,
  Cpu,
  Layers,
  CheckCircle2,
  Copy,
  Check,
  ChevronDown,
  Filter,
  BarChart3,
  HelpCircle,
} from 'lucide-react';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchAiInsights, askGeminiAnalytics, type AiInsightsData } from '../lib/offernetClient';

import InsightWorkbench from '../features/evidenceWorkspace/InsightWorkbench';
import '../styles/evidenceWorkspaces.css';

const QUICK_QUESTIONS = [
  'What is driving the change in lead-to-sale rate?',
  'Which exception populations have the highest backlog?',
  'What are the primary funnel drop-offs across datasets?',
  'Analyze cross-dataset performance across lead_ledger, watfall_report, and vibe_coding_data',
  'What do the raw JSON datasets in vibe-code-warren-stear reveal about dialler timing?',
];

export default function AiOperationalInsights() {
  const { selectedClient, clientConfig } = useClient();
  const { startDate, endDate, filters } = useFilters();

  const queryParams = {
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  };

  const { data, loading, error, loadData } = useOperationalData<AiInsightsData>(
    'AiOperationalInsights',
    queryParams,
    fetchAiInsights
  );

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const resultScope = JSON.stringify([selectedClient, startDate, endDate, filters]);
  const requestVersion = useRef(0);
  const currentResultScope = useRef(resultScope);
  currentResultScope.current = resultScope;
  const [qaResultState, setQaResult] = useState<{ scope: string; value: { answer: string; model: string; citations: string[] } } | null>(null);
  const qaResult = qaResultState?.scope === resultScope ? qaResultState.value : null;
  const [qaError, setQaError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  useEffect(() => { requestVersion.current += 1; setQaResult(null); setQaError(null); setAsking(false); }, [resultScope]);

  const handleAskQuestion = async (qText?: string) => {
    const promptToAsk = (qText || question).trim();
    if (!promptToAsk || asking) return;
    const requestScope = resultScope;
    const version = ++requestVersion.current;
    setQaResult(null);
    setAsking(true);
    setQaError(null);
    try {
      const response = await askGeminiAnalytics(promptToAsk, queryParams);
      if (currentResultScope.current === requestScope && requestVersion.current === version) setQaResult({ scope: requestScope, value: response });
    } catch (err: any) {
      if (currentResultScope.current === requestScope && requestVersion.current === version) setQaError(err?.message || 'Failed to process question via Google Gemini API');
    } finally {
      if (currentResultScope.current === requestScope && requestVersion.current === version) setAsking(false);
    }
  };

  const handleCopySummary = () => {
    if (!data?.executiveSummary) return;
    navigator.clipboard.writeText(`${data.executiveSummary}\n\nStrategic Focus: ${data.strategicFocus || 'N/A'}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="cx-command-page cx-ai-evidence-page">
      <OffernetFilterBar onRefresh={() => loadData(true)} />
      <div className="cx-command-content space-y-6">
        <header className="cx-command-hero"><div><span className="cx-command-eyebrow">Operational analysis</span><h1>AI insights & evidence</h1><p>Review the returned briefing, explore its findings and inspect supplied metric references before acting.</p></div><Cpu size={24} aria-hidden="true" /></header>
        <dl className="cx-ai-provenance" aria-label="Briefing provenance"><div><dt>Source</dt><dd>{data?.source || 'Not reported'}</dd></div><div><dt>Reported model</dt><dd>{data?.model || 'Not reported'}</dd></div><div><dt>Response status</dt><dd>{data?.status || 'Not reported'}</dd></div><div><dt>Validation</dt><dd>{data?.validationStatus || 'NOT_VERIFIED'}</dd></div></dl>
        {data && <nav className="cx-admin-section-nav" aria-label="AI insight sections"><a href="#ai-briefing">Briefing</a><a href="#ai-findings">Findings & evidence</a><a href="#ai-question">Ask a question</a></nav>}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 p-4 text-xs text-red-800 dark:text-red-300 flex items-center justify-between gap-2" role="alert">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => loadData(true)}
              className="text-red-900 dark:text-red-200 underline font-semibold hover:text-red-700 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !data ? (
          <div className="cx-command-loading" role="status">
            <div className="cx-command-spinner" />
            <span>Synthesizing operational metrics via Google Gemini…</span>
          </div>
        ) : data ? (
          <>
            {/* Executive Synthesis Card */}
            <section id="ai-briefing" className="cx-ai-briefing enterprise-card p-6 border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-white via-slate-50/50 to-blue-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Lightbulb size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Executive Operational Synthesis
                    </h2>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Workspace: {clientConfig?.name || selectedClient} · {data.source}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors shadow-2xs"
                  >
                    {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy briefing'}</span>
                  </button>
                  <ExportAnalysisButton
                    filename="gemini_operational_insights"
                    rows={[
                      ['Category', 'Severity', 'Finding', 'Metric Reference', 'Action Directive'],
                      ...data.insights.map(item => [item.category, item.severity, item.finding, item.metricReference, item.directive]),
                    ]}
                    definitions={data.reason || 'Synthesized using Google Gemini based on verified BigQuery sources.'}
                    validationStatus={data.validationStatus || 'NOT_VERIFIED'}
                  />
                </div>
              </div>

              {/* Narrative Content */}
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                  {data.executiveSummary || 'Operational metrics have been compiled across the selected date window.'}
                </p>

                {data.strategicFocus && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200">
                    <Lightbulb size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block mb-0.5">Primary Operational Directive</strong>
                      <span>{data.strategicFocus}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-2 font-mono">
                  <ShieldCheck size={14} className="text-blue-500 shrink-0" />
                  <span>{data.reason}</span>
                </div>
              </div>
            </section>

            <InsightWorkbench key={JSON.stringify([selectedClient, startDate, endDate, filters])} insights={data.insights} severity={severityFilter} onSeverity={setSeverityFilter} />

            {/* Interactive "Ask Gemini Analytics" Section */}
            <section id="ai-question" className="cx-ai-question enterprise-card p-6 space-y-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <MessageSquare size={17} className="text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Ask Gemini Analytics
                </h2>
                <span className="text-[10px] text-slate-500 font-mono">
                  Grounded BigQuery Analysis
                </span>
              </div>

              {/* Question Input */}
              <div className="space-y-2">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    aria-label="Question for analytics assistant"
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAskQuestion()}
                    placeholder="Ask about conversion bottlenecks, vendor SLA, or matched-period changes…"
                    disabled={asking}
                    className="w-full pl-3.5 pr-24 py-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleAskQuestion()}
                    disabled={asking || !question.trim()}
                    className="absolute right-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    {asking ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    <span>{asking ? 'Analyzing…' : 'Ask AI'}</span>
                  </button>
                </div>

                {/* Preset Prompt Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10.5px] text-slate-500 font-semibold mr-1 flex items-center gap-1">
                    <HelpCircle size={12} className="text-blue-500" />
                    Suggested:
                  </span>
                  {QUICK_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQuestion(q);
                        handleAskQuestion(q);
                      }}
                      disabled={asking}
                      className="text-[11px] px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:bg-blue-950/50 dark:hover:text-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all shadow-2xs font-medium"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* QA Error Alert */}
              {qaError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle size={15} />
                  <span>{qaError}</span>
                </div>
              )}

              {/* QA Result Card */}
              {qaResult && (
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-950 dark:text-blue-200">
                    <div className="flex items-center gap-2">
                      <Lightbulb size={14} className="text-blue-600 dark:text-blue-400" />
                      <span>Gemini Synthesis Response</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      {qaResult.model}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                    {qaResult.answer}
                  </p>

                  {qaResult.citations && qaResult.citations.length > 0 && (
                    <div className="pt-2 border-t border-blue-100 dark:border-blue-900/40 space-y-1">
                      <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Supplied metric references
                      </span>
                      <ul className="space-y-1">
                        {qaResult.citations.map((cite, i) => (
                          <li key={i} className="text-[11px] font-mono text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                            <span>{cite}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>

          </>
        ) : null}
      </div>
    </div>
  );
}
