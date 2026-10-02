import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  formatChartAxis,
  formatChartTooltip,
  formatCurrency,
  formatKpiValue,
  formatPercent,
  formatRatioPercent,
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
  assert.equal(formatTableNumber('not-a-number'), '—');
  assert.equal(formatRatioPercent(3, 0), '—');
  assert.equal(formatRatioPercent(undefined, 10), '—');
});

test('real measured zero remains visibly zero', () => {
  assert.equal(formatKpiValue(0), '0');
  assert.equal(formatPercent(0), '0.0%');
  assert.equal(formatCurrency(0), 'R 0.00');
  assert.equal(formatTableNumber(0), '0');
  assert.equal(formatRatioPercent(1, 4), '25.0%');
});

test('OfferNet control panels do not invent missing operating configuration or metric values', () => {
  const source = fs.readFileSync('src/components/OfferNetControlPanels.tsx', 'utf8');
  assert.doesNotMatch(source, /operatingContext\s*\|\|\s*\{/);
  assert.doesNotMatch(source, /\(\{\}\s+as\s+any\)/);
  assert.doesNotMatch(source, /\?\?\s*0}%/);
  assert.match(source, /Operating-hours configuration is unavailable for this scope/);
  assert.match(source, /formatPercent/);
});

test('operational pages preserve unavailable metrics instead of displaying fallback zeroes', () => {
  for (const path of [
    'src/features/overview/OverviewPage.tsx',
    'src/pages/Exceptions.tsx',
    'src/pages/ContactStrategyIntelligence.tsx',
    'src/pages/DataIntegrityIntelligence.tsx',
  ]) {
    const source = fs.readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /Number\([^\n]*\|\|\s*0\)\.toLocaleString\(\)/);
    assert.doesNotMatch(source, /\?\?\s*0}%/);
  }
});
