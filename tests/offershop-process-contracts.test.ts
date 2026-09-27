import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFERSHOP_PROCESS_VERSION,
  OFFERSHOP_PROCESS_NODES,
  OFFERSHOP_PARTNER_CONFIGS,
  CONSUMER_HOSPITAL_TAGS,
  TEDI_REFERENCE_SCHEDULES,
  OFFERSHOP_VALIDATION_VALID,
  OFFERSHOP_VALIDATION_INVALID,
  parseOffershopValidationCode,
  isOffershopValid,
  type OffershopPartner,
} from '../contracts/offershopProcess';
import { OBSERVED_EXPORT_FAILURES } from '../contracts/warehouseDictionary';

test('Offershop validation encoding explicitly uses 1=valid and 2=invalid (not JS truthiness)', () => {
  assert.equal(OFFERSHOP_VALIDATION_VALID, 1);
  assert.equal(OFFERSHOP_VALIDATION_INVALID, 2);

  assert.equal(parseOffershopValidationCode(1), 1);
  assert.equal(parseOffershopValidationCode('1'), 1);
  assert.equal(parseOffershopValidationCode(2), 2);
  assert.equal(parseOffershopValidationCode('2'), 2);

  // Rejects arbitrary values
  assert.equal(parseOffershopValidationCode(0), null);
  assert.equal(parseOffershopValidationCode(true), null);
  assert.equal(parseOffershopValidationCode(false), null);
  assert.equal(parseOffershopValidationCode('random'), null);

  // Helper check
  assert.equal(isOffershopValid(1), true);
  assert.equal(isOffershopValid(2), false);
  assert.equal(isOffershopValid(null), false);
  assert.equal(isOffershopValid(undefined), false);
});

test('Consumer hospital outcome tags match diagram specifications', () => {
  const expectedTags = [
    'EXACT',
    'INVALID_ID_ZERO',
    'SMALL_DIFF_1_DIGIT',
    'SMALL_DIFF_2_DIGIT',
    'SMALL_DIFF_3_DIGIT',
    'DIFFERENT',
  ];
  assert.deepEqual([...CONSUMER_HOSPITAL_TAGS], expectedTags);
});

test('Partner duplicate windows match diagram documentation exactly', () => {
  // BLC: 48h
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.blc_ontact.duplicateWindowHours, 48);
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.blc_ontact.duplicateAction, 'UPDATE_EXISTING');

  // Mondo: 10 days (240h)
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.mondo.duplicateWindowHours, 240);
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.mondo.duplicateWindowText, '10 days');
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.mondo.duplicateAction, 'SUPPRESS');

  // MTN: 48h
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.mtn.duplicateWindowHours, 48);
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.mtn.duplicateAction, 'UPDATE_EXISTING');

  // Real Promotions: 7 days (168h)
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.real_promotions.duplicateWindowHours, 168);
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.real_promotions.duplicateWindowText, '7 days');
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.real_promotions.duplicateAction, 'SUPPRESS');

  // BizVoIP: 48h
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.bizvoip.duplicateWindowHours, 48);
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.bizvoip.duplicateAction, 'SUPPRESS');

  // Invalid-ID campaign: 48h with RECLASSIFY action
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.invalid_id_campaign.duplicateWindowHours, 48);
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.invalid_id_campaign.duplicateAction, 'RECLASSIFY');

  // RewardsCo: 48h
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.rewardsco.duplicateWindowHours, 48);
  assert.equal(OFFERSHOP_PARTNER_CONFIGS.rewardsco.duplicateAction, 'SUPPRESS');
});

test('Process catalog preserves unique node IDs and documented readiness states', () => {
  assert.ok(OFFERSHOP_PROCESS_NODES.length >= 20);
  const nodeIds = new Set<string>();

  for (const node of OFFERSHOP_PROCESS_NODES) {
    assert.ok(!nodeIds.has(node.nodeId), `Duplicate node ID: ${node.nodeId}`);
    nodeIds.add(node.nodeId);

    assert.ok(node.originalLabel.length > 0);
    assert.ok(node.family.length > 0);
    assert.ok(node.entityGrain.length > 0);
    assert.ok(['MAPPED', 'DEPENDENCY_BLOCKED', 'MAPPING_REQUIRED', 'NOT_INSTRUMENTED'].includes(node.readiness));
  }

  // Check specific critical nodes
  const val01 = OFFERSHOP_PROCESS_NODES.find(n => n.nodeId === 'VAL-01');
  assert.ok(val01);
  assert.equal(val01.readiness, 'MAPPED');
  assert.match(val01.intendedRule, /1=valid/);

  const mondoNode = OFFERSHOP_PROCESS_NODES.find(n => n.nodeId === 'PART-MONDO');
  assert.ok(mondoNode);
  assert.equal(mondoNode.readiness, 'DEPENDENCY_BLOCKED');
  assert.ok(mondoNode.unresolvedDependencies.some(d => d.includes('Access Denied')));

  const advNode = OFFERSHOP_PROCESS_NODES.find(n => n.nodeId === 'ADV-01');
  assert.ok(advNode);
  assert.equal(advNode.family, 'advertising_feedback');
  assert.equal(advNode.readiness, 'NOT_INSTRUMENTED');
});

test('TEDI schedules document expected cadences and handle missing evidence safely', () => {
  assert.ok(TEDI_REFERENCE_SCHEDULES.length >= 5);
  for (const item of TEDI_REFERENCE_SCHEDULES) {
    assert.ok(item.partner);
    assert.ok(item.fileType);
    assert.ok(['daily', 'weekly', 'monthly'].includes(item.expectedCadence));
    // Without monitoring evidence, status must not be assumed FAILED
    assert.ok(['UNKNOWN', 'LOADED_UNMATCHED', 'NOT_YET_EXPECTED'].includes(item.observedStatus));
  }
});
