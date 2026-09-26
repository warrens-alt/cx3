import type { CheckEvidence, SourceEvidence } from './reporting';

export const EXCEPTION_CONTRACT_VERSION = 'cx.exceptions.1.0.0';
export type ExceptionStatus = 'AVAILABLE' | 'CONFIGURATION_REQUIRED' | 'SOURCE_UNAVAILABLE' | 'RULE_NOT_SUPPORTED';
export type ExceptionSeverity = 'critical' | 'high' | 'medium' | 'low' | 'information';

export interface ExceptionRuleResult {
  id: string;
  label: string;
  description: string;
  population: string;
  count: string | null;
  vendor: string | null;
  severity: ExceptionSeverity;
  age: string | null;
  sourceEvidence: string[];
  status: ExceptionStatus;
  owner: string | null;
  reason: string | null;
  recordsPath: string | null;
  scopeBasis: 'selected_period' | 'release_validation';
}

export interface ExceptionConfiguration {
  deliveryToFirstDialMinutes?: string;
  captureToDeliveryMinutes?: string;
  repeatAttemptThreshold?: string;
  activationEligibilityLagDays?: string;
  staleSourceMinutes?: string;
  owners?: Record<string, string>;
}

const definition = (id: string, label: string, description: string, population: string, severity: ExceptionSeverity, sourceEvidence: string[], reason: string): ExceptionRuleResult => ({
  id, label, description, population, count: null, vendor: null, severity, age: null, sourceEvidence,
  status: 'CONFIGURATION_REQUIRED', owner: null, reason, recordsPath: null, scopeBasis: 'selected_period',
});

export function exceptionCatalogue(sources: SourceEvidence[], checks: CheckEvidence[], configuration: ExceptionConfiguration = {}): ExceptionRuleResult[] {
  const rules: ExceptionRuleResult[] = [
    definition('delivered_not_dialled_sla', 'Delivered but not dialled beyond SLA', 'Delivered episodes without a subsequent observed call after the approved operating-time threshold.', 'Successful delivery episodes', 'high', ['deliveries', 'calls'], 'Configure an approved delivery-to-first-dial SLA and operating-hours calendar.'),
    definition('capture_to_delivery_sla', 'Capture-to-delivery unusually slow', 'Lead captures whose successful delivery exceeds an approved threshold.', 'Lead delivery episodes', 'medium', ['leads', 'deliveries'], 'Configure an approved capture-to-delivery threshold and operating-hours calendar.'),
    definition('missing_disposition', 'Missing call disposition', 'Observed call events without an approved canonical disposition.', 'Observed call events', 'medium', ['calls'], 'The canonical call fact does not yet include an approved disposition mapping.'),
    definition('repeat_attempts_no_outcome', 'Repeated calls without outcome', 'Delivery episodes with repeated observed call attempts and no supported sale outcome.', 'Delivered episodes with calls', 'medium', ['deliveries', 'calls', 'sales'], 'Configure the repeat-attempt threshold.'),
    definition('source_feed_stale', 'Source feed stale', 'Source evidence older than the approved freshness objective.', 'Published source contracts', 'high', sources.map(source => source.fact), 'Configure an approved freshness threshold for each source.'),
    definition('identifier_mismatch', 'Identifier relationship mismatch', 'Canonical child facts whose approved parent key is absent.', 'Frozen canonical facts', 'critical', ['leads', 'deliveries', 'calls', 'sales', 'activations', 'commercial'], 'Release relationship validation has not produced an inspectable result.'),
    definition('delivery_rejection', 'Delivery rejection', 'Attempted delivery episodes without a successful delivery observation.', 'Delivery attempts', 'medium', ['deliveries'], 'An approved rejection reason mapping is not present in the canonical delivery fact.'),
    definition('activation_missing_after_sale', 'Activation missing after eligible sale', 'Eligible sale events without an activation after the approved maturation period.', 'Eligible sale events', 'high', ['sales', 'activations'], 'Configure eligibility rules and the activation maturation period.'),
    definition('reporting_coverage_degraded', 'Reporting coverage degraded', 'Published facts whose source evidence is partial or unavailable.', 'Published source contracts', 'high', sources.map(source => source.fact), 'No published source evidence was available.'),
  ];
  const configurationMap: Record<string, string | undefined> = {
    delivered_not_dialled_sla: configuration.deliveryToFirstDialMinutes,
    capture_to_delivery_sla: configuration.captureToDeliveryMinutes,
    repeat_attempts_no_outcome: configuration.repeatAttemptThreshold,
    activation_missing_after_sale: configuration.activationEligibilityLagDays,
    source_feed_stale: configuration.staleSourceMinutes,
  };
  for (const rule of rules) {
    rule.owner = configuration.owners?.[rule.id] ?? null;
    const missingFact = rule.sourceEvidence.find(fact => !sources.some(source => source.fact === fact && source.status !== 'UNAVAILABLE'));
    if (missingFact) { rule.status = 'SOURCE_UNAVAILABLE'; rule.reason = `Required ${missingFact} evidence is unavailable; absence is not zero.`; continue; }
    if (configurationMap[rule.id] !== undefined) rule.reason = 'Rule configuration is present; an execution adapter is required before affected records can be published.';
  }
  const relationshipCheck = checks.find(check => check.id === 'relationships');
  const relationshipRule = rules.find(rule => rule.id === 'identifier_mismatch')!;
  if (relationshipCheck?.status === 'PASS' && /^\d+$/.test(relationshipCheck.observed)) {
    relationshipRule.status = 'AVAILABLE'; relationshipRule.count = relationshipCheck.observed; relationshipRule.reason = null;
    relationshipRule.scopeBasis = 'release_validation'; relationshipRule.age = 'At release cutoff';
  }
  const degraded = sources.filter(source => source.status !== 'COMPLETE');
  const coverageRule = rules.find(rule => rule.id === 'reporting_coverage_degraded')!;
  if (sources.length) {
    coverageRule.status = 'AVAILABLE'; coverageRule.count = String(degraded.length); coverageRule.reason = degraded.length ? 'One or more published facts have partial or unavailable evidence.' : null;
    coverageRule.scopeBasis = 'release_validation'; coverageRule.age = 'At release cutoff';
  }
  return rules;
}
