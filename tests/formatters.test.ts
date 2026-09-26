import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  formatChartAxis,
  formatChartTooltip,
  formatCurrency,
  formatKpiValue,
  formatPercent,
  formatTableNumber,
} from '../src/lib/formatters';

test('unavailable or invalid metrics are never rendered as measured zero', () => {
  assert.equal(formatKpiValue(null), '—');
  assert.equal(formatKpiValue(undefined), '—');
  assert.equal(formatKpiValue(Number.NaN), '—');
  assert.equal(formatKpiValue(Number.POSITIVE_INFINITY), '—');
  assert.equal(formatChartAxis(Number.NaN), '—');
  assert.equal(formatChartTooltip(Number.POSITIVE_INFINITY), '—');
  assert.equal(formatPercent(undefined), '—');
  assert.equal(formatPercent('not-a-number'), '—');
  assert.equal(formatCurrency(Number.NaN), '—');
  assert.equal(formatTableNumber(null), '—');
});

test('real measured zero remains visibly zero', () => {
  assert.equal(formatKpiValue(0), '0');
  assert.equal(formatPercent(0), '0.0%');
  assert.equal(formatCurrency(0), 'R 0.00');
  assert.equal(formatTableNumber(0), '0');
});

test('OfferNet control panels do not invent missing operating configuration or metric values', () => {
  const source = fs.readFileSync('src/components/OfferNetControlPanels.tsx', 'utf8');
  assert.doesNotMatch(source, /operatingContext\s*\|\|\s*\{/);
  assert.doesNotMatch(source, /\(\{\}\s+as\s+any\)/);
  assert.doesNotMatch(source, /\?\?\s*0}%/);
  assert.match(source, /Operating-hours configuration is unavailable for this scope/);
  assert.match(source, /formatPercent/);
});
