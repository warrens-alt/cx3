import React, { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, GitBranch, Search } from 'lucide-react';
import AnalyticsPageLayout from '../../components/AnalyticsPageLayout';
import ReportingScopeBar from '../../shared/reporting/ReportingScopeBar';
import { ReportStatusSlot } from '../../shared/reporting/ReportPresentation';
import ReportingScopeSummary from '../../shared/reporting/ReportingScopeSummary';
import ChartFrame from '../../shared/visuals/ChartFrame';
import EvidenceBars from '../../shared/visuals/EvidenceBars';
import { LifecycleNode } from '../../shared/visuals/LifecyclePath';
import { lifecyclePresentation } from '../../shared/visuals/lifecyclePresentation';
import VisualSkeleton from '../../shared/visuals/VisualSkeleton';
import AuditEvidenceButton from '../../shared/evidence/AuditEvidenceButton';
import InspectorHost, { type InspectorContent } from '../../shared/evidence/InspectorHost';
import { useAuditMode } from '../../shared/evidence/AuditMode';
import { STAGE_METRIC_IDS } from '../../shared/evidence/auditPresentation';
import { OperationalError } from '../../components/OperationalState';
import { MatchedPeriodPanel, LifecycleSegmentsPanel } from '../../components/LifecycleDiagnostics';
import { useJourneyModel } from '../../features/journey/model/useJourneyModel';
import { adaptJourneyData } from '../../features/journey/model/journeyAdapter';
import JourneyTiming from '../../features/journey/components/JourneyTiming';
import JourneyProgression from '../../features/journey/components/JourneyProgression';
import JourneyAuditLens from '../../features/journey/components/JourneyAuditLens';
import { lifecycleVisualAudit } from '../../features/evidenceWorkspace/metricVisualAudit';
import { formatPercent, formatTableNumber } from '../../lib/formatters';
import { selectionDrill, selectionLabel, selectionMetric, selectionStage, selectionTransition, supportedJourneyLenses, JOURNEY_TRANSITIONS, type JourneySelection, type JourneyAnalysisLens } from './journeySelection';
import JourneyMetricEvidence from './JourneyMetricEvidence';
import '../../styles/journeyContactVisuals.css';

const JourneyTransitionContext = lazy(() => import('./JourneyTransitionContext'));
const lensLabels: Record<JourneyAnalysisLens, string> = { comparison: 'Comparison', vendor: 'Vendor', source: 'Source', grade: 'Grade', captureHour: 'Capture hour', captureDay: 'Capture day', timing: 'Timing' };
const rootMetrics: Record<string, string> = { fetched: 'fetchedLeads', delivered: 'deliveryRate', dialled: 'dialRate', rpc: 'contactRate', sales: 'leadToSaleRate', activated: 'activationRate' };
const count = (value: number | null | undefined) => value == null ? 'Unavailable' : formatTableNumber(value);
const stageDescriptions = { fetched: 'Distinct analytical leads captured in the selected intake cohort.', delivered: 'Leads with an ordered capture and delivery timestamp.', dialled: 'Leads with a qualified delivery and ordered first dial.', rpc: 'Qualified dialled leads with positive recorded RPC evidence.', sales: 'Leads with recorded sales; a sale does not imply RPC or billing.', activated: 'Leads with recorded activations; activation does not imply billing or collection.' };

export default function JourneyWorkbench({ selection, onSelect }: { selection: JourneySelection; onSelect: (value: JourneySelection) => void }) {
  const { data, loading, error, refreshAll, scope, filters, scoped, handleExportCsv, inspectorContent, setInspectorContent } = useJourneyModel();
  const [requestedLens, setLens] = useState<JourneyAnalysisLens>('comparison');
  const { enabled: auditEnabled } = useAuditMode();
  const [auditLens, setAuditLens] = useState(false);
  const refreshContext = useRef<(() => Promise<void>) | null>(null);
  const registerContextRefresh = useCallback((refresh: (() => Promise<void>) | null) => { refreshContext.current = refresh; }, []);
  const refreshWorkspace = async () => { await Promise.allSettled([refreshAll(), ...(refreshContext.current ? [refreshContext.current()] : [])]); };
  const { stages, transitions } = adaptJourneyData(data);
  const selectedStage = selectionStage(selection);
  const metric = selectionMetric(selection);
  const label = selectionLabel(selection);
  const stage = stages.find(item => item.key === selectedStage)!;
  const transition = selectionTransition(selection, data?.lifecycle);
  const isTransition = selection.includes('-to-');
  const comparison = data?.lifecycle?.comparisons[metric];
  const lenses = supportedJourneyLenses(data?.lifecycle);
  const lens = lenses.includes(requestedLens) ? requestedLens : 'comparison';
  const drill = selectionDrill(selection);
  const investigationPath = `/investigate?drill=${drill.drill}&drillValue=${encodeURIComponent(drill.drillValue)}`;
  const audit: InspectorContent = {
    type: isTransition ? 'stage' : 'metric', title: `${label} ${isTransition ? 'transition' : 'population'}`,
    metricId: isTransition ? undefined : STAGE_METRIC_IDS[selectedStage],
    value: isTransition ? formatPercent(transition?.conversionRate) : count(stage.volume),
    numeratorCount: isTransition ? transition?.converted ?? null : stage.volume,
    denominatorCount: isTransition ? transition?.population ?? null : null,
    numeratorLabel: isTransition ? 'Qualified ordered intersection' : `${label} leads`,
    denominatorLabel: isTransition ? `${transition?.from || 'Prior'} stage population` : undefined,
    definition: { meaning: isTransition ? 'Qualified intersection of the two recorded stage boundaries. Leads without recorded progression are not proven failures.' : stageDescriptions[selectedStage], grain: 'Distinct analytical lead', dateBasis: 'Lead capture cohort', nullMeaning: 'Missing evidence is unavailable, never zero.', calculation: data?.lifecycle?.methodology },
    scope: { clientId: scope.clientId, startDate: scope.startDate, endDate: scope.endDate, filters },
    provenance: { validationStatus: data?.lifecycle?.validationStatus }, recordDrill: { ...drill, label: isTransition ? 'Inspect leads without recorded progression' : 'Inspect stage population' },
  };
  const segmentRows = !['comparison', 'timing'].includes(lens) ? data?.lifecycle?.segments[lens] || [] : [];
  const distribution = [...segmentRows].sort((a, b) => Number(b[metric as keyof typeof b] ?? -1) - Number(a[metric as keyof typeof a] ?? -1));
  const maximum = Math.max(0, ...stages.map(item => item.volume ?? 0));
  const selectStage = (value: JourneySelection) => { onSelect(value); setLens('comparison'); };
  const selectTransition = (value: JourneySelection) => {
    onSelect(value);
    setLens(value === 'delivered-to-dialled' || value === 'sales-to-activated' ? 'timing' : 'comparison');
  };
  return <AnalyticsPageLayout title="Journey" description="Follow the lead population. Select a stage or transition to understand its evidence." className="cx-journey-workbench"
    actions={<><Link className="cx-button-secondary" to={scoped('/investigate')}><Search size={14} aria-hidden="true" />Investigate</Link>{data && <button type="button" className="cx-button-secondary" onClick={handleExportCsv}><Download size={14} aria-hidden="true" />Export CSV</button>}<ReportStatusSlot /></>}
    scope={<ReportingScopeBar onRefresh={refreshWorkspace} comparisonWindow={data?.lifecycle?.period?.previous} />}>
    {error && <OperationalError message={error} onRetry={() => { void refreshAll(); }} />}
    {loading && !data && <VisualSkeleton kind="lifecycle" label="Loading lifecycle evidence" />}
    {data && <>
      <section id="journey-progression" aria-labelledby="journey-progression-heading"><h2 id="journey-progression-heading" className="sr-only">Lifecycle stage progression</h2>
      <ChartFrame title="Lead lifecycle" subtitle="Independent stage populations, with qualified intersections between stages." scope={<ReportingScopeSummary />} className="cx-journey-hero cx-lifecycle-path">
        <ol className="cx-journey-stage-grid">{stages.map(item => <li key={item.key} data-stage={item.key} style={{ '--cx-stage-color': lifecyclePresentation[item.key].color } as React.CSSProperties}>
          <LifecycleNode stage={item} maximum={maximum} selected={selection === item.key} onSelect={() => selectStage(item.key)} />
          <small>{data.lifecycle?.comparisons[selectionMetric(item.key)]?.absoluteChange == null ? 'Comparison unavailable' : `${data.lifecycle.comparisons[selectionMetric(item.key)].absoluteChange! > 0 ? '+' : ''}${formatTableNumber(data.lifecycle.comparisons[selectionMetric(item.key)].absoluteChange)} vs previous`}</small>
        </li>)}</ol>
        <div className="cx-journey-transition-grid" aria-label="Select a lifecycle transition">{JOURNEY_TRANSITIONS.map((key, index) => {
          const evidence = transitions[index];
          return <button key={key} type="button" aria-pressed={selection === key} onClick={() => selectTransition(key)} disabled={!evidence}>
            <span>{selectionLabel(key)}<ArrowRight size={13} aria-hidden="true" /></span>
            <strong>{formatPercent(evidence?.conversionRate)}</strong>
            <small>{evidence ? `${count(evidence.converted)} / ${count(evidence.population)} qualified` : 'Transition unavailable'}</small>
            {evidence?.status === 'NON_NESTED' && <em>Non-nested recorded populations</em>}
          </button>;
        })}</div>
        <p className="cx-journey-unavailable">Qualification population <strong>Unavailable</strong> · Routed population <strong>Unavailable</strong><span>Specialist evidence remains available in the Qualification and Routing lenses; no equivalent lifecycle count is supplied.</span></p>
      </ChartFrame>
      {auditEnabled && <div className="cx-journey-audit-lens-toggle" role="group" aria-label="Journey presentation lens"><button type="button" className="cx-button-secondary" aria-pressed={!auditLens} onClick={() => setAuditLens(false)}>Performance</button><button type="button" className="cx-button-secondary" aria-pressed={auditLens} onClick={() => setAuditLens(true)}>Audit evidence</button></div>}
      {auditEnabled && auditLens && <JourneyAuditLens stages={stages} lifecycle={data.lifecycle} onInspectStage={item => setInspectorContent(lifecycleVisualAudit({ type: 'stage', title: `${item.name} Stage`, metricId: STAGE_METRIC_IDS[item.key], value: count(item.volume), scope: audit.scope, provenance: audit.provenance, recordDrill: { drill: 'funnel-stage', drillValue: item.key } }, item.volume, item.key, data.lifecycle))} />}
      </section>

      <section className="cx-journey-selected" aria-labelledby="journey-selected-heading">
        <header><div><small>Selected {isTransition ? 'transition' : 'stage'}</small><h2 id="journey-selected-heading">{label}</h2><p>{isTransition ? 'Ordered event intersection and leads without recorded progression.' : stageDescriptions[selectedStage]}</p></div>
          <div className="cx-journey-selected-actions"><AuditEvidenceButton content={audit} /><Link className="cx-button-primary" to={scoped(investigationPath)}>Investigate {isTransition ? 'no progression' : 'population'}<ArrowRight size={14} aria-hidden="true" /></Link></div>
        </header>
        <dl className="cx-journey-selected-values">{isTransition ? <>
          <div><dt>Prior population</dt><dd>{count(transition?.population)}</dd></div><div><dt>Qualified intersection</dt><dd>{count(transition?.converted)}</dd></div><div><dt>No recorded progression</dt><dd>{count(transition?.lost)}</dd></div><div><dt>Matched movement</dt><dd>{transition?.deteriorationPp == null ? 'Unavailable' : `${transition.deteriorationPp > 0 ? '+' : ''}${formatTableNumber(transition.deteriorationPp)} pp`}</dd></div>
        </> : <><div><dt>Current population</dt><dd>{count(stage.volume)}</dd></div><div><dt>Matched previous</dt><dd>{count(comparison?.previous)}</dd></div><div><dt>Population change</dt><dd>{comparison?.absoluteChange == null ? 'Unavailable' : `${comparison.absoluteChange > 0 ? '+' : ''}${count(comparison.absoluteChange)}`}</dd></div><div><dt>Validation</dt><dd>Not verified</dd></div></>}</dl>
        <div className="cx-journey-analysis-lenses" role="group" aria-label="Selected journey analysis lens">{lenses.map(key => <button type="button" key={key} aria-pressed={lens === key} onClick={() => setLens(key)}>{lensLabels[key]}</button>)}</div>
        <div className="cx-journey-analysis-content" data-selection={selection} data-lens={lens}>
          {['delivered-to-dialled', 'dialled-to-rpc', 'sales-to-activated'].includes(selection) && ['comparison', 'timing'].includes(lens) && <Suspense fallback={<VisualSkeleton kind="bars" label="Opening transition context" />}><JourneyTransitionContext selection={selection} scope={scope} auditScope={audit.scope} scoped={scoped} registerRefresh={registerContextRefresh} /></Suspense>}
          {lens === 'comparison' && <>
            <EvidenceBars title={isTransition ? 'Qualified transition evidence' : `${label} · matched populations`} description={isTransition ? 'The prior-stage base and its supplied intersection. These populations overlap.' : data.lifecycle?.period ? `${data.lifecycle.period.current.startDate}–${data.lifecycle.period.current.endDate} compared with ${data.lifecycle.period.previous.startDate}–${data.lifecycle.period.previous.endDate}.` : 'Choose a matched reporting period for previous-population evidence.'}
              items={isTransition ? [{ key: 'population', label: 'Prior-stage population', value: transition?.population }, { key: 'converted', label: 'Qualified intersection', value: transition?.converted, color: lifecyclePresentation[selectedStage].color }, { key: 'lost', label: 'No recorded progression', value: transition?.lost, color: 'var(--cx-text-muted)' }] : [{ key: 'current', label: 'Current period', value: stage.volume, color: lifecyclePresentation[selectedStage].color }, { key: 'previous', label: 'Matched previous period', value: comparison?.previous, color: 'var(--cx-text-muted)' }]} />
            <p className="cx-viz-footnote">Matched comparison uses aggregate populations. A previous daily trend is not supplied. Cohorts have different follow-up maturity.</p>
            {!isTransition && <Link to={scoped(`/investigate?investigationMetric=${rootMetrics[selectedStage]}`)} className="cx-button-secondary">Understand the {selectedStage === 'fetched' ? 'population' : 'associated rate'} movement<ArrowRight size={13} aria-hidden="true" /></Link>}
          </>}
          {lens === 'timing' && <><JourneyTiming velocity={data.velocity} speedToLeadPath={scoped('/operations/response')} /><p className="cx-viz-footnote">These lifecycle intervals are averages across each eligible population. Median and percentile response timings are available in Operations.</p>{selection === 'sales-to-activated' && <Link to={scoped('/journey/outcomes')} className="cx-button-secondary">Explore activation ageing and outcomes<ArrowRight size={13} aria-hidden="true" /></Link>}</>}
          {!['comparison', 'timing'].includes(lens) && <>
            <EvidenceBars title={`${lifecyclePresentation[selectedStage].label} by ${lensLabels[lens].toLowerCase()}`} description={isTransition ? 'Destination-stage population concentration. Transition-loss counts by this dimension are not supplied here.' : 'Descriptive concentration within the selected stage. Segment sizes do not establish causes.'}
              items={distribution.slice(0, 12).map(row => ({ key: row.key, label: row.key, value: row[metric as 'fetched'], color: lifecyclePresentation[selectedStage].color }))}
              onSelect={['vendor', 'source', 'grade'].includes(lens) ? key => { window.requestAnimationFrame(() => document.getElementById(`journey-segment-${distribution.findIndex(row => row.key === key)}`)?.focus()); } : undefined}
              selectionLabel="Select" scaleNote={`Showing ${Math.min(12, distribution.length)} of ${distribution.length} returned segments. Exact values and investigation actions below.`} />
            <div className="cx-viz-table-scroll" role="region" aria-label="Selected lifecycle segment evidence" tabIndex={0}><table className="cx-viz-table"><thead><tr><th>{lensLabels[lens]}</th><th>{lifecyclePresentation[selectedStage].label}</th><th>Evidence action</th></tr></thead><tbody>{distribution.map((row, index) => <tr key={row.key}><th scope="row">{row.key}</th><td>{count(row[metric as 'fetched'])}</td><td>{['vendor', 'source', 'grade'].includes(lens) ? <Link id={`journey-segment-${index}`} to={scoped(`/investigate?drill=funnel-stage&drillValue=${selectedStage}&segment${lens[0].toUpperCase()}${lens.slice(1)}=${encodeURIComponent(row.key)}`)}>Investigate stage segment</Link> : <span>Time segment record drill unavailable</span>}</td></tr>)}</tbody></table></div>
          </>}
        </div>
      </section>
      {selection === 'dialled-to-rpc' && <div className="cx-journey-next-analysis"><GitBranch size={17} aria-hidden="true" /><div><strong>Understand contact effort and outcomes</strong><p>Recorded attempt buckets and vendor dispositions retain their own denominators.</p></div><Link className="cx-button-secondary" to={scoped('/operations/contact')}>Open contact analysis<ArrowRight size={14} aria-hidden="true" /></Link></div>}
      <JourneyMetricEvidence stages={stages} lifecycle={data.lifecycle} scope={audit.scope} onInspect={setInspectorContent} />
      <details className="cx-report-disclosure"><summary>All transitions and their exact evidence</summary><JourneyProgression stages={[]} transitions={transitions} showPath={false} /></details>
      {data.lifecycle?.segments && data.lifecycle.priorSegments && <details className="cx-report-disclosure"><summary>Complete lifecycle segments, rates and observed contributions</summary><LifecycleSegmentsPanel data={data.lifecycle} /></details>}
      {data.lifecycle && <details className="cx-report-disclosure"><summary>All matched metrics and methodology</summary><MatchedPeriodPanel data={data.lifecycle} /><p className="cx-viz-footnote">{data.lifecycle.methodology}</p></details>}
    </>}
    <InspectorHost open={Boolean(inspectorContent)} content={inspectorContent} onClose={() => setInspectorContent(null)} />
  </AnalyticsPageLayout>;
}
