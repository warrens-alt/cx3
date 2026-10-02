import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { completedReviewWeek, previousCalendarWindow, reviewMetrics, reviewMetricText, validReviewWindow, REVIEW_QUESTIONS } from '../src/lib/reviewModel';
import { navigationPage } from '../src/lib/navigation';
import { operationalQueryOptions } from '../src/lib/operationalQueries';

test('review comparisons use complete valid calendar periods including leap days', () => {
  assert.equal(validReviewWindow('', ''), false);
  assert.equal(validReviewWindow('2026-02-30', '2026-03-01'), false);
  assert.equal(validReviewWindow('2026-09-22', '2026-09-20'), false);
  assert.deepEqual(previousCalendarWindow('2024-02-28', '2024-03-01'), { startDate: '2024-02-25', endDate: '2024-02-27', days: 3 });
  assert.deepEqual(completedReviewWeek(new Date('2026-09-27T12:00:00Z')), { startDate: '2026-09-14', endDate: '2026-09-20' });
  assert.deepEqual(completedReviewWeek(new Date('2026-09-27T22:30:00Z'), 'Africa/Johannesburg'), { startDate: '2026-09-21', endDate: '2026-09-27' });
});
test('review labels and calculations preserve null, zero and approved denominator semantics', () => {
  const data: any = { kpis: { fetchedLeads: 0, deliveryRate: null, dialRate: 0, contactRate: 25, leadToSaleRate: 4, activationRate: 10 }, comparisonWindow: { startDate: '2026-08-01', endDate: '2026-08-07' }, comparison: { fetchedDelta: null, contactRateDelta: -2 } };
  const rows = reviewMetrics(data);
  assert.equal(rows[0].value, 0); assert.equal(rows[1].value, null);
  assert.equal(rows[3].label, 'RPC / dialled'); assert.match(rows[3].calculation, /Dialled leads/);
  assert.equal(rows[3].deltaUnit, 'pp'); assert.equal(rows[0].deltaUnit, '%');
  assert.equal(reviewMetricText(0, '%'), '0%'); assert.equal(reviewMetricText(null, '%'), 'Unavailable');
  data.comparisonWindow = null; assert.equal(reviewMetrics(data)[3].delta, null);
});
test('review navigation uses existing surfaces and opening review reuses the overview resource key', () => {
  for (const question of REVIEW_QUESTIONS) for (const path of question.paths) assert.ok(navigationPage(path));
  const scope = { clientId: 'mtn', filters: '{"vendor":{"operator":"in","values":["MTN"]}}' };
  const fetcher = async () => ({});
  assert.deepEqual(operationalQueryOptions('ManagementReview', scope, fetcher).queryKey, operationalQueryOptions('ExecutiveOverview', scope, fetcher).queryKey);
  assert.notDeepEqual(operationalQueryOptions('ExecutiveOverview', { ...scope, clientId: 'mondo' }, fetcher).queryKey, operationalQueryOptions('ExecutiveOverview', scope, fetcher).queryKey);
});
test('navigation is query-free and guided review is lazy, scope-bound and not a fake live feed', () => {
  const sidebar = fs.readFileSync('src/app/navigation/PrimaryNavigation.tsx', 'utf8');
  const review = fs.readFileSync('src/components/ManagementReview.tsx', 'utf8');
  const launcher = fs.readFileSync('src/components/ReviewLauncher.tsx', 'utf8');
  assert.doesNotMatch(sidebar, /fetch\(/); assert.doesNotMatch(sidebar, /\/api\/analytics\/health/);
  assert.match(sidebar, /ReviewLauncher compact/); assert.doesNotMatch(sidebar, /Source status & completeness/);
  assert.match(launcher, /lazy\(/); assert.match(review, /fetchOverview, bounded/);
  assert.match(review, /Source data cutoff: not supplied/); assert.match(review, /extractOffernetFilters\(filters\)/);
});
