import type { LifecycleStage } from '../../shared/visuals/lifecyclePresentation';
import type { LifecycleDiagnostics } from '../../../contracts/lifecycleAnalytics';

export const JOURNEY_STAGES: LifecycleStage[] = ['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activated'];
export const JOURNEY_TRANSITIONS = ['fetched-to-delivered', 'delivered-to-dialled', 'dialled-to-rpc', 'rpc-to-sales', 'sales-to-activated'] as const;
export type JourneySelection = LifecycleStage | typeof JOURNEY_TRANSITIONS[number];
export type JourneyAnalysisLens = 'comparison' | 'vendor' | 'source' | 'grade' | 'captureHour' | 'captureDay' | 'timing';

/** Presentation selection only; no identifiers, filters or evidence values are persisted. */
export function validJourneySelection(value: unknown): JourneySelection {
  return typeof value === 'string' && [...JOURNEY_STAGES, ...JOURNEY_TRANSITIONS].includes(value as JourneySelection) ? value as JourneySelection : 'fetched';
}
export function selectionStage(selection: JourneySelection): LifecycleStage {
  return (selection.includes('-to-') ? selection.split('-to-')[1] : selection) as LifecycleStage;
}
export function selectionMetric(selection: JourneySelection): string {
  return ({ fetched: 'fetched', delivered: 'delivered', dialled: 'dialled', rpc: 'rpc', sales: 'sales', activated: 'activations' })[selectionStage(selection)];
}
export function selectionDrill(selection: JourneySelection) {
  return selection.includes('-to-') ? { drill: 'funnel-loss', drillValue: selection } : { drill: 'funnel-stage', drillValue: selection };
}
export function selectionTransition(selection: JourneySelection, data?: LifecycleDiagnostics) {
  const index = JOURNEY_TRANSITIONS.indexOf(selection as typeof JOURNEY_TRANSITIONS[number]);
  return index < 0 ? undefined : data?.transitions[index];
}
export function supportedJourneyLenses(data?: LifecycleDiagnostics): JourneyAnalysisLens[] {
  return ['comparison', ...(['vendor', 'source', 'grade', 'captureHour', 'captureDay'] as const).filter(key => data?.segments && key in data.segments && !data.unsupportedDimensions?.includes(key)), 'timing'] as JourneyAnalysisLens[];
}
export function selectionLabel(selection: JourneySelection): string {
  const labels: Record<string, string> = { fetched: 'Fetched', delivered: 'Delivered', dialled: 'Dialled', rpc: 'RPC', sales: 'Sale', activated: 'Activation' };
  return selection.split('-to-').map(key => labels[key]).join(' → ');
}
