import { getBigQueryClient } from '../server/bigquery/client';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getOffershopProcessFlow,
  getOffershopStageDetails,
  getOffershopSimulation,
} from '../server/analytics/process/offershopProcess';
import {
  OFFERSHOP_PROCESS_VERSION,
  OFFERSHOP_PARTNER_CONFIGS,
} from '../contracts/offershopProcess';

test('getOffershopProcessFlow produces complete multi-stage observability across all 8 stages', async context => {
  context.mock.method(getBigQueryClient('dashboards-422710'), 'query', async () => [[{ total_leads: 3, valid_id: 1, invalid_id: 1, unknown_id: 1, valid_phone: 1, invalid_phone: 1, unknown_phone: 1 }]] as any);
  const result = await getOffershopProcessFlow({
    clientId: 'default_tenant',
    startDate: '2026-09-01',
    endDate: '2026-09-27',
  });

  assert.equal(result.processVersion, OFFERSHOP_PROCESS_VERSION);
  assert.ok(result.readinessSummary.totalNodes >= 20);
  assert.ok(result.readinessSummary.mappedCount > 0);
  assert.ok(result.readinessSummary.dependencyBlockedCount > 0);

  // Verify all documented stages are present
  const stageFamilies = [
    'acquisition',
    'ingestion',
    'preparation_validation',
    'consumer_hospital',
    'partner_qualification',
    'hlc_delivery',
    'dialler_activity',
    'commercial_activation',
    'tedi_feedback',
    'advertising_feedback',
  ];

  for (const family of stageFamilies) {
    const stage = result.stages[family as keyof typeof result.stages];
    assert.ok(stage, `Missing stage: ${family}`);
    assert.ok(stage.nodes.length > 0, `Stage ${family} has no nodes`);
    assert.ok(stage.title.length > 0);
  }

  // Preparation & validation explicit 1 vs 2 checks
  const prep = result.stages.preparation_validation;
  assert.ok(prep.observedMetrics.idValidationValidCode1 !== undefined);
  assert.equal(prep.observedMetrics.idValidationInvalidCode2, 1);
  assert.equal(prep.observedMetrics.idValidationUnknown, 1);

  // Partner summary matches documented duplicate configurations
  for (const [partnerId, cfg] of Object.entries(OFFERSHOP_PARTNER_CONFIGS)) {
    const partnerSummary = result.partnerSummary[partnerId as keyof typeof result.partnerSummary];
    assert.ok(partnerSummary);
    assert.equal(partnerSummary.duplicateWindowText, cfg.duplicateWindowText);
    assert.equal(partnerSummary.duplicateAction, cfg.duplicateAction);
  }

  // Advertising feedback is marked as a separate related process, never conflated with dialler
  assert.equal(result.advertisingFeedbackSummary.status, 'SEPARATE_RELATED_PROCESS');
  assert.equal(result.advertisingFeedbackSummary.isConflatedWithDialler, false);
});

test('getOffershopStageDetails retrieves node and stage definitions safely', async context => {
  context.mock.method(getBigQueryClient('dashboards-422710'), 'query', async () => [[{}]] as any);
  const nodeDetail = await getOffershopStageDetails('VAL-01', { clientId: 'default_tenant' });
  assert.ok(nodeDetail.node);
  assert.equal(nodeDetail.node.nodeId, 'VAL-01');
  assert.equal(nodeDetail.node.originalLabel, 'National ID Validity Check');

  const stageDetail = await getOffershopStageDetails('consumer_hospital', { clientId: 'default_tenant' });
  assert.ok(stageDetail.stage);
  assert.equal(stageDetail.stage.family, 'consumer_hospital');

  await assert.rejects(
    () => getOffershopStageDetails('NON_EXISTENT_STAGE_XYZ', { clientId: 'default_tenant' }),
    /not recognized in process catalog/
  );
});

test('getOffershopSimulation runs read-only simulation with mandatory disclaimer and preserves baseline', () => {
  const result = getOffershopSimulation(
    { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-27' },
    {
      partner: 'mondo',
      hypotheticalDuplicateWindowHours: 480, // doubled from baseline 240h (10 days)
      hypotheticalColourRule: 'GreenOnly',
      simulationScope: { startDate: '2026-09-01', endDate: '2026-09-27' },
    }
  );

  assert.equal(result.isSimulation, true);
  assert.equal(
    result.readOnlyDisclaimer,
    'THIS IS A READ-ONLY RULE SIMULATION. RESULTS DO NOT REPRESENT OBSERVED PRODUCTION TRAFFIC AND ARE EXCLUDED FROM ACTUAL REPORTED METRICS.'
  );

  assert.equal(result.partner, 'mondo');
  assert.equal(result.simulatedEligibleCount, null);
  assert.equal(result.simulatedSuppressedCount, null);
  assert.equal(result.simulatedChangePct, null);
  assert.equal(result.status, 'BASELINE_REQUIRED');
  assert.equal(result.observedBaselineCount, null); // No invented baseline
});

test('getOffershopProcessFlow does not manufacture fixed fallbacks (12450, 4920) or synthetic fractions', async context => {
  context.mock.method(getBigQueryClient('dashboards-422710'), 'query', async () => [[{ total_leads: 3, valid_id: 1, invalid_id: 1, unknown_id: 1, valid_phone: 1, invalid_phone: 1, unknown_phone: 1 }]] as any);
  const result = await getOffershopProcessFlow({
    clientId: 'default_tenant',
    startDate: '2026-09-01',
    endDate: '2026-09-27',
  });

  // Verify that uninstrumented or offline metrics are null, NOT synthetic 12450 or 4920
  const acquisition = result.stages.acquisition;
  assert.notEqual(acquisition.observedMetrics.totalSubmissions, 12450);
  assert.equal(acquisition.observedMetrics.onChannelSharePct, null);
  assert.equal(acquisition.observedMetrics.abandonedConversationsPendingRecovery, null);

  const dialler = result.stages.dialler_activity;
  assert.notEqual(dialler.observedMetrics.rightPartyContacts, 4920);
  assert.notEqual(dialler.observedMetrics.discreteCallAttempts, 28400);

  // Partner summary must have null for uninstrumented counts, not synthetic fractions
  const mondo = result.partnerSummary.mondo;
  assert.equal(mondo.observedEligibleCount, null);
  assert.equal(mondo.observedSuppressedCount, null);

  // Consumer hospital tags must be null, not synthetic 45% or 28% fractions
  const hospital = result.consumerHospitalSummary;
  assert.equal(hospital.tagsObserved.EXACT, null);
  assert.equal(hospital.tagsObserved.SMALL_DIFF_1_DIGIT, null);
});

