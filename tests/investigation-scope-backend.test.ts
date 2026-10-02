import test from 'node:test';
import assert from 'node:assert/strict';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';
import { getRawLeads, buildQualifiedInvestigationEvidence } from '../server/analytics/investigation/records';
import { getLeadTimeline } from '../server/analytics/investigation/timeline';
import { getExceptionAnalytics } from '../server/analytics/investigation/exceptions';
import { getAiInsightsAnalytics } from '../server/analytics/investigation/aiInsights';
import { EXCEPTION_DEFINITIONS, buildInvestigationPredicate, exceptionPredicate, driverFirstDialAgeSql } from '../server/analytics/investigation/exceptionPredicates';
import { investigationReasonFor, DRIVER_FIRST_DIAL_AGES } from '../contracts/investigation';

const scope = { clientId: 'default_tenant', startDate: '2026-09-08', endDate: '2026-09-14' };
const client = getBigQueryClient(getClientConfig(scope.clientId).bigQueryProject);

test('each exception record reason corresponds to the shared qualifying predicate without changing pagination', async t => {
  const queries: Array<{ query: string; params: Record<string, unknown> }> = [];
  t.mock.method(client, 'query', async options => {
    queries.push(options);
    return [[{ total_count: 1, evidence_rows: [{ lead_id: 'L1', contacted: null, total_calls: null }] }]];
  });
  for (const definition of EXCEPTION_DEFINITIONS) {
    const response = await getRawLeads({ ...scope, drill: definition.id });
    const reason = response.rows[0].investigationReason;
    assert.ok(reason?.code, definition.id);
    assert.ok(reason?.label, definition.id);
    assert.deepEqual(reason, investigationReasonFor(definition.id));
    assert.ok(queries.at(-1)!.query.includes(`AND (${exceptionPredicate(definition.id)})`));
    assert.equal(response.rows[0].contacted, null);
    assert.equal(response.rows[0].total_calls, null);
    assert.match(queries.at(-1)!.query, /ORDER BY fetched_ts DESC NULLS LAST, lead_id ASC/);
    assert.match(queries.at(-1)!.query, /LIMIT 50\s+OFFSET 0/);
    assert.equal(response.validationStatus, 'NOT_VERIFIED');
  }
  const unrestricted = await getRawLeads(scope);
  assert.equal(unrestricted.rows[0].investigationReason, undefined);
  assert.match(investigationReasonFor('high-attempt-no-rpc')!.label, /explicitly false/);
  assert.match(investigationReasonFor('funnel-loss', 'dialled-to-rpc')!.label, /false or unavailable/);
  assert.match(investigationReasonFor('zero-call-leads')!.detail!, /Missing call counters do not/);
});

test('supported drill families describe their exact qualifying evidence; unsupported reasons are absent', () => {
  const families: Array<[string, string]> = [
    ...['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activated'].map(value => ['funnel-stage', value] as [string, string]),
    ...['fetched-to-delivered', 'delivered-to-dialled', 'dialled-to-rpc', 'rpc-to-sales', 'sales-to-activated'].map(value => ['funnel-loss', value] as [string, string]),
    ...['0–15m', '15–30m', '30–60m', '1–6h', '6–12h', '12–24h', '24h+'].map(value => ['backlog-age', value] as [string, string]),
    ...['lead-age', 'delivery-age'].flatMap(drill => ['Not delivered', 'Undialled', 'Invalid timing', '0–5m', '0–15m', '5–15m', '15–30m', '30–60m', '1–3h', '3–6h', '6–12h', '12–24h', '1–6h', '6–24h', '24h+'].map(value => [drill, value] as [string, string])),
    ...['0 calls', '1 call', '2 calls', '3 calls', '4 calls', '5+ calls', 'Unrecorded'].map(value => ['call-effort', value] as [string, string]),
    ['lifecycle-segment', 'source:Unrecorded'], ['lifecycle-vendor', 'A'], ['lifecycle-source', 'web'], ['lifecycle-grade', 'A'],
  ];
  for (const [drill, drillValue] of families) {
    assert.ok(buildInvestigationPredicate({ ...scope, drill, drillValue }, {}), `${drill}/${drillValue}`);
    assert.ok(investigationReasonFor(drill, drillValue), `${drill}/${drillValue}`);
  }
  for (const [drill, drillValue] of [['made-up', ''], ['constructor', ''], ['funnel-stage', 'constructor'], ['funnel-loss', 'new-stage'], ['backlog-age', '77h'], ['backlog-age', 'constructor'], ['lead-age', 'constructor'], ['call-effort', '__proto__'], ['lifecycle-segment', 'password:x']]) {
    assert.equal(investigationReasonFor(drill, drillValue), undefined);
    assert.throws(() => buildInvestigationPredicate({ ...scope, drill, drillValue }, {}), /Unsupported/);
  }
  assert.throws(() => buildInvestigationPredicate({ ...scope, drillValue: 'Undialled' }, {}), /requires/);
});

test('investigation segments are ANDed with original reporting filters and predicate using bound parameters', () => {
  const result = buildQualifiedInvestigationEvidence({ ...scope, vendor: 'Global vendor', source: 'Paid',
    drill: 'invalid-timestamps', segmentVendor: "Other' OR TRUE --", segmentSource: 'Unrecorded', segmentGrade: 'A', segmentLeadAge: 'Undialled', search: 'L123' });
  assert.equal(result.queryParams.vendor, 'Global vendor');
  assert.equal(result.queryParams.source, 'Paid');
  assert.equal(result.queryParams.segmentVendor, "Other' OR TRUE --");
  assert.equal(result.queryParams.search, '%L123%');
  assert.doesNotMatch(result.qualifiedSql, /Other' OR TRUE/);
  assert.match(result.qualifiedSql, /\(m.delivered_ts < m.fetched_ts OR .*\) AND \(COALESCE/s);
  assert.match(result.qualifiedSql, /TRIM\(m.vendor\).*@segmentVendor/);
  assert.match(result.qualifiedSql, /TRIM\(m.source\).*'Unrecorded'.*@segmentSource/);
  assert.match(result.qualifiedSql, /@segmentGrade/);
  assert.match(result.qualifiedSql, /@segmentLeadAge/);
  assert.match(result.qualifiedSql, /LOWER\(h.vendor\) = LOWER\(@vendor\)/);
  assert.equal(result.effectiveFilters.vendor.value, 'Global vendor');
  assert.throws(() => buildQualifiedInvestigationEvidence({ ...scope, segmentVendor: ' ' }), /Missing vendor/);
  assert.throws(() => buildQualifiedInvestigationEvidence({ ...scope, segmentLeadAge: '1–3h' }), /Unsupported/);
  for (const segmentLeadAge of DRIVER_FIRST_DIAL_AGES) assert.ok(buildInvestigationPredicate({ ...scope, segmentLeadAge }, {}));
  const ageSql = driverFirstDialAgeSql();
  assert.ok(ageSql.indexOf('delivered_ts IS NULL') < ageSql.indexOf('first_call_ts IS NULL'));
  assert.match(ageSql, /TIMESTAMP_DIFF\(m.first_call_ts, m.delivered_ts, SECOND\)/);
});

test('timeline admits the exact record through the same scope and keeps per-call evidence withheld', async t => {
  let queried: any;
  t.mock.method(client, 'query', async options => {
    queried = options;
    return [[{ lead_id: 'L1', vendor: 'A', fetched: '2026-09-08T11:00:00Z', delivered: '2026-09-09T11:00:00Z', first_call_date: null, total_calls: 0 }]];
  });
  const timeline = await getLeadTimeline('L1', { ...scope, vendor: 'A', source: 'Paid', drill: 'awaiting-first-dial', segmentGrade: 'A', search: 'L1' });
  assert.match(queried.query, /JOIN qualified_evidence population ON population.lead_id = l.lead_id/);
  assert.match(queried.query, /AND l.lead_id = @investigationLeadId/);
  assert.match(queried.query, /m.is_delivered AND NOT m.is_dialled/);
  assert.match(queried.query, /@segmentGrade/);
  assert.equal(queried.params.startDate, scope.startDate);
  assert.equal(queried.params.endDate, scope.endDate);
  assert.equal(queried.params.source, 'Paid');
  assert.equal(queried.params.vendor, 'A');
  assert.equal(queried.params.investigationLeadId, 'L1');
  assert.equal(timeline!.leadId, 'L1');
  assert.equal(timeline!.callEvidence.status, 'CONTRACT_REQUIRED');
  assert.equal(timeline!.events.some(item => item.stage.startsWith('Call row')), false);
  t.mock.method(client, 'query', async () => [[]]);
  assert.equal(await getLeadTimeline('not-in-scope', { ...scope, drill: 'awaiting-first-dial' }), null);
});

const aggregate = { population_count: 3, missing_call_counters: 1, unknown_rpc: 2,
  vendors: [{ name: 'A', count: 3 }], sources: [{ name: 'Paid', count: 3 }], first_dial_ages: [{ name: 'Undialled', count: 3 }] };

test('investigation synthesis uses exact aggregate-only scope and never loads broad exceptions or drivers', async t => {
  const queries: any[] = [];
  t.mock.method(client, 'query', async options => { queries.push(options); return [[aggregate]]; });
  const result = await getAiInsightsAnalytics({ ...scope, drill: 'awaiting-first-dial', vendor: 'A', segmentVendor: 'A', segmentSource: 'Paid', segmentLeadAge: 'Undialled', search: 'Scoped search', question: 'What evidence is missing?', metric: 'leadToSaleRate' });
  assert.equal(queries.length, 1);
  assert.match(queries[0].query, /investigation_population AS/);
  assert.doesNotMatch(queries[0].query, / AS evidence_rows| AS exceptions|FROM dimensional/);
  assert.match(queries[0].query, /m.is_delivered AND NOT m.is_dialled/);
  assert.equal(queries[0].params.search, '%Scoped search%');
  assert.equal(queries[0].params.segmentVendor, 'A');
  assert.equal(queries[0].params.segmentSource, 'Paid');
  assert.equal(queries[0].params.segmentLeadAge, 'Undialled');
  assert.ok('scope' in result);
  assert.equal(result.scope.drill, 'awaiting-first-dial');
  assert.equal(result.scope.metric, 'leadToSaleRate');
  assert.equal(result.scope.filters.vendor.value, 'A');
  assert.equal(result.populationCount, 3);
  assert.equal(result.requestedQuestion, 'What evidence is missing?');
  assert.equal(result.validationStatus, 'NOT_VERIFIED');
  assert.ok(result.insights.every(insight => insight.metricReference.startsWith('investigation.')));
  assert.ok(result.limitations.some(text => /No selected-metric value, matched-period comparison/.test(text)));
  assert.ok(result.insights.some(item => /unavailable cumulative call counters/.test(item.finding)));
});

test('scoped synthesis rejects unsupported drill and unavailable counts instead of broadening or inventing zero', async t => {
  let queries = 0;
  let row: any = { ...aggregate, population_count: null };
  t.mock.method(client, 'query', async () => { queries++; return [[row]]; });
  await assert.rejects(getAiInsightsAnalytics({ ...scope, drill: 'unsupported' }), /Unsupported/);
  assert.equal(queries, 0);
  await assert.rejects(getAiInsightsAnalytics({ ...scope, drill: 'one-call-only' }), /unavailable investigation count/);
  row = { ...aggregate, unknown_rpc: 4 };
  await assert.rejects(getAiInsightsAnalytics({ ...scope, drill: 'one-call-only' }), /exceed/);
  row = { ...aggregate, first_dial_ages: [] };
  await assert.rejects(getAiInsightsAnalytics({ ...scope, drill: 'one-call-only' }), /does not reconcile/);
  row = { population_count: 0, missing_call_counters: 0, unknown_rpc: 0, vendors: [], sources: [], first_dial_ages: [] };
  const empty = await getAiInsightsAnalytics({ ...scope, drill: 'one-call-only' });
  assert.ok('populationCount' in empty);
  assert.equal(empty.populationCount, 0);
  assert.match(empty.strategicFocus, /No records match this scope/);
});


test('queue narrowing preserves each independent exception predicate and explicit missing-source labels', async t => {
  let query: any;
  t.mock.method(client, 'query', async options => {
    query = options;
    return [[{ id: 'missing-source', comparison_period: 'current', vendor: 'A', source: '', affected_count: 2 }]];
  });
  const result = await getExceptionAnalytics({ ...scope, vendor: 'Global', drill: 'awaiting-first-dial', segmentSource: 'Unrecorded', segmentVendor: 'A' });
  assert.equal(query.params.vendor, 'Global');
  assert.equal(query.params.segmentSource, 'Unrecorded');
  assert.equal(query.params.segmentVendor, 'A');
  assert.match(query.query, /WHERE \(COALESCE/);
  assert.doesNotMatch(query.query, /WHERE .*m.is_delivered AND NOT m.is_dialled/);
  assert.ok(EXCEPTION_DEFINITIONS.every(item => query.query.includes(exceptionPredicate(item.id))));
  assert.deepEqual(result.exceptions.find(item => item.id === 'missing-source')!.bySource, [{ name: 'Unrecorded', count: 2 }]);
  const searched = await getExceptionAnalytics({ ...scope, search: 'A', drill: 'zero-call-leads', segmentGrade: 'A' });
  assert.match(query.query, /JOIN qualified_evidence search_match USING \(lead_id\)/);
  assert.equal(query.params.search, '%A%');
  assert.equal(query.params.segmentGrade, 'A');
  assert.equal(searched.exceptions.length, EXCEPTION_DEFINITIONS.length);
});


test('timeline source histories intersect the selected vendor while retaining exact lead membership and global scope', async t => {
  let queried: any;
  t.mock.method(client, 'query', async options => { queried = options; return [[]]; });
  const expected = "COALESCE(NULLIF(TRIM(COALESCE(hlc.vendor, 'Unknown')), ''), 'Unrecorded') = @segmentVendor";
  for (const segmentVendor of ['A', 'Unknown', 'Unrecorded']) {
    await getLeadTimeline('L1', { ...scope, vendor: 'Global vendor', drill: 'awaiting-first-dial', segmentVendor });
    const outer = queried.query.slice(queried.query.lastIndexOf('FROM scoped_leads l'));
    assert.ok(outer.includes('JOIN qualified_evidence population ON population.lead_id = l.lead_id'));
    assert.ok(outer.includes(expected), 'Displayed history must apply the selected vendor after exact lead qualification');
    assert.match(outer, /LOWER\(hlc.vendor\) = LOWER\(@vendor\)/);
    assert.equal(queried.params.vendor, 'Global vendor');
    assert.equal(queried.params.segmentVendor, segmentVendor);
    assert.equal(queried.params.investigationLeadId, 'L1');
    assert.match(queried.query, /m.is_delivered AND NOT m.is_dialled/);
    assert.equal(queried.params.startDate, scope.startDate);
    assert.equal(queried.params.endDate, scope.endDate);
  }
  await getLeadTimeline('L1', scope);
  const unrestrictedOuter = queried.query.slice(queried.query.lastIndexOf('FROM scoped_leads l'));
  assert.equal(unrestrictedOuter.includes('@segmentVendor'), false, 'Unsegmented histories retain their existing vendor scope');
});
