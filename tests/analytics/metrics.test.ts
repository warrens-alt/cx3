import test from 'node:test';
import assert from 'node:assert/strict';
import {
  numberOrNull,
  countOrZero,
  ratioOrNull,
  percentOrNull,
  durationSecondsOrNull,
  formatDurationOrNull,
  formatDurationSafe,
} from '../../server/analytics/common/metrics';

test('metrics: rate test matrix for zero vs unavailable', () => {
  // Normal positive rate: 10 / 100 -> 10%
  assert.equal(percentOrNull(10, 100, 1), 10.0);
  assert.equal(percentOrNull('10', '100', 1), 10.0);

  // Genuine measured zero: 0 / 100 -> 0%
  assert.equal(percentOrNull(0, 100, 1), 0);
  assert.equal(percentOrNull('0', '100', 1), 0);

  // Zero denominator / no measurable population: 0 / 0 -> null (NEVER 0%)
  assert.equal(percentOrNull(0, 0, 1), null);
  assert.equal(percentOrNull(10, 0, 1), null);

  // Missing numerator or denominator -> null
  assert.equal(percentOrNull(null, 100, 1), null);
  assert.equal(percentOrNull(undefined, 100, 1), null);
  assert.equal(percentOrNull(10, null, 1), null);
  assert.equal(percentOrNull(10, undefined, 1), null);
  assert.equal(percentOrNull(null, null, 1), null);

  // Negative denominator -> invalid population -> null
  assert.equal(percentOrNull(5, -10, 1), null);
});

test('metrics: duration test matrix for zero vs unavailable', () => {
  // 120 seconds -> 2m
  assert.equal(formatDurationOrNull(120), '2m');
  assert.equal(formatDurationSafe(120), '2m');

  // 0 seconds observed -> 0s
  assert.equal(formatDurationOrNull(0), '0s');
  assert.equal(formatDurationSafe(0), '0s');

  // 45 seconds -> 45s
  assert.equal(formatDurationOrNull(45), '45s');

  // 3600 seconds -> 1.0h
  assert.equal(formatDurationOrNull(3600), '1.0h');

  // 86400 seconds -> 1.0d
  assert.equal(formatDurationOrNull(86400), '1.0d');

  // NULL or undefined duration -> null / —
  assert.equal(formatDurationOrNull(null), null);
  assert.equal(formatDurationSafe(null), '—');
  assert.equal(formatDurationOrNull(undefined), null);
  assert.equal(formatDurationSafe(undefined), '—');

  // Invalid / negative timestamps -> null / — (never false 0s)
  assert.equal(durationSecondsOrNull(-45), null);
  assert.equal(formatDurationOrNull(-45), null);
  assert.equal(formatDurationSafe(-45), '—');
  assert.equal(durationSecondsOrNull('invalid'), null);
  assert.equal(formatDurationOrNull(NaN), null);
  assert.equal(formatDurationSafe(NaN), '—');
});

test('metrics: ratioOrNull precision and safety', () => {
  // Normal ratio
  assert.equal(ratioOrNull(25, 100, 2), 0.25);
  // Zero numerator
  assert.equal(ratioOrNull(0, 50, 2), 0);
  // Zero or negative denominator
  assert.equal(ratioOrNull(10, 0, 2), null);
  assert.equal(ratioOrNull(10, -5, 2), null);
  // Null inputs
  assert.equal(ratioOrNull(null, 10, 2), null);
  assert.equal(ratioOrNull(10, null, 2), null);
});

test('metrics: countOrZero and numberOrNull', () => {
  assert.equal(countOrZero(42), 42);
  assert.equal(countOrZero('42'), 42);
  assert.equal(countOrZero(null), 0);
  assert.equal(countOrZero(undefined), 0);
  assert.equal(countOrZero(''), 0);
  assert.equal(countOrZero(-5), 0);
  assert.equal(countOrZero(NaN), 0);

  assert.equal(numberOrNull(42.5), 42.5);
  assert.equal(numberOrNull('42.5'), 42.5);
  assert.equal(numberOrNull(0), 0);
  assert.equal(numberOrNull(null), null);
  assert.equal(numberOrNull(undefined), null);
  assert.equal(numberOrNull(''), null);
  assert.equal(numberOrNull('abc'), null);
});
