import React, { useEffect, type ComponentProps } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { formatTableNumber } from '../../lib/formatters';
import InvestigationContextBar, { useInvestigationModel } from './InvestigationContextBar';
import { useEvidenceTray } from './EvidenceTray';
import { investigationPath } from './investigationModel';
import type { InvestigationAnalysisSummary } from './useInvestigationAnalysis';

export type InvestigationStage = 'signal' | 'diagnose' | 'segment' | 'records' | 'evidence' | 'conclusion';
const stageTargets: Record<InvestigationStage, string> = {
  signal: 'investigation-signal', diagnose: 'investigation-diagnose', segment: 'investigation-segment',
  records: 'investigation-records', evidence: 'investigation-evidence-tray', conclusion: 'investigation-conclusion',
};

/** The current location indicates focus; stage labels never claim analytical completion. */
export function currentInvestigationStage(pathname: string, hash: string, active: boolean, narrowed: boolean): InvestigationStage {
  const anchored = (Object.entries(stageTargets) as Array<[InvestigationStage, string]>).find(([, target]) => hash === `#${target}`);
  if (anchored) return anchored[0];
  if (pathname === '/lead-explorer') return 'records';
  return narrowed ? 'segment' : active ? 'diagnose' : 'signal';
}

function focusStage(stage: InvestigationStage) {
  if (stage === 'evidence' || stage === 'conclusion') {
    const tray = document.getElementById(stageTargets.evidence) as HTMLDetailsElement | null;
    if (tray) tray.open = true;
  }
  requestAnimationFrame(() => {
    const target = document.getElementById(stageTargets[stage]);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
}

type Props = ComponentProps<typeof InvestigationContextBar> & {
  analysis?: InvestigationAnalysisSummary | null;
  recordsLoaded?: boolean;
  requestError?: string | null;
};

export default function InvestigationWorkflow({ analysis, recordsLoaded = false, requestError, ...context }: Props) {
  const location = useLocation();
  const [params] = useSearchParams();
  const { isAdmin } = useAuth();
  const model = useInvestigationModel();
  const { items, notes } = useEvidenceTray();
  const active = Boolean(model.drill || model.metric);
  const current = currentInvestigationStage(location.pathname, location.hash, active, model.segments.length > 0);
  useEffect(() => {
    const anchored = (Object.keys(stageTargets) as InvestigationStage[]).find(stage => location.hash === `#${stageTargets[stage]}`);
    if (anchored) focusStage(anchored);
  }, [location.pathname, location.hash]);
  const recordPage = location.pathname === '/lead-explorer';
  const population = context.populationCount;
  const conclusion = Boolean(notes.conclusion.trim());
  const unknowns = Boolean(notes.unknowns.trim());
  const status = context.validationStatus || analysis?.validationStatus || 'NOT_VERIFIED';
  const signalDetail = requestError ? 'Current evidence unavailable' : analysis?.state === 'available'
    ? `Current ${analysis.current} · previous ${analysis.previous} · change ${analysis.change}${analysis.severity ? ` · ${analysis.severity} severity` : ''}`
    : population != null ? `${formatTableNumber(population)} affected leads` : active ? 'Current value unavailable' : 'Choose a signal from the inbox';
  const diagnosis = !active ? 'Select a signal to inspect descriptive drivers' : analysis?.state === 'unavailable' ? analysis.detail
    : model.search ? 'Clear record search to compare complete populations' : analysis?.state === 'available'
      ? `${analysis.dimension || 'Population'} · ${model.metric ? 'descriptive contributors' : 'current concentration'}` : 'Loading descriptive context';
  const recordState = !isAdmin ? 'Administrator access required' : requestError && recordPage ? 'Record evidence unavailable'
    : context.selectedLead ? 'Lead dossier open · selection stays in this session'
      : recordsLoaded ? population === 0 ? 'No matching records' : population == null ? 'Returned records · total unavailable' : `${formatTableNumber(population)} matching leads`
        : population === 0 ? 'Empty population · inspect records' : 'Inspect records to establish availability';
  const stages: Array<{ key: InvestigationStage; label: string; detail: string; available: boolean }> = [
    { key: 'signal', label: 'Signal', detail: signalDetail, available: true },
    { key: 'diagnose', label: 'Diagnose', detail: diagnosis, available: active },
    { key: 'segment', label: 'Segment', detail: model.segments.length ? model.segments.map(segment => `${segment.label}: ${segment.value}`).join(' · ') : 'No additional narrowing', available: true },
    { key: 'records', label: 'Records', detail: recordState, available: isAdmin },
    { key: 'evidence', label: 'Evidence', detail: `${items.length} session ${items.length === 1 ? 'observation' : 'observations'} pinned · ${status}`, available: true },
    { key: 'conclusion', label: 'Conclusion', detail: `${conclusion ? 'Analyst note exists' : 'Conclusion incomplete'} · ${unknowns ? 'open questions recorded' : 'unknowns not yet recorded'}`, available: true },
  ];
  const href = (stage: InvestigationStage) => {
    const destination = stage === 'records' ? '/lead-explorer' : stage === 'signal' || stage === 'diagnose' ? '/investigate' : location.pathname;
    return `${investigationPath(destination, params)}#${stageTargets[stage]}`;
  };
  return <InvestigationContextBar {...context} validationStatus={status}>
    <p className="cx-investigation-progress" aria-live="polite">{active ? 'Signal selected' : 'Select a signal'} → {model.segments.length ? `narrowed by ${model.segments.map(segment => segment.label.toLowerCase()).join(', ')}` : 'reporting scope retained'} → {items.length} pinned → {conclusion ? 'analyst conclusion recorded' : 'conclusion incomplete'}</p>
    <nav className="cx-investigation-workflow" aria-label="Investigation workflow"><ol>{stages.map((stage, index) => <li key={stage.key} data-current={stage.key === current}>
      {stage.available ? <Link data-stage={stage.key} to={href(stage.key)} aria-current={stage.key === current ? 'step' : undefined} onClick={() => focusStage(stage.key)}>
        <span className="cx-investigation-stage-title"><span aria-hidden="true">{index + 1}</span>{stage.label}{stage.key === current && <small>Current</small>}</span><span className="cx-investigation-stage-detail">{stage.detail}</span>
      </Link> : <span data-stage={stage.key} aria-disabled="true"><span className="cx-investigation-stage-title"><span aria-hidden="true">{index + 1}</span>{stage.label}</span><span className="cx-investigation-stage-detail">{stage.detail}</span></span>}
    </li>)}</ol></nav>
    <p className="cx-investigation-support-boundary">Evidence sufficiency has not been established. Source coverage does not certify this population. Pins retain their original scopes; analyst conclusions remain notes, separate from validation.</p>
  </InvestigationContextBar>;
}
