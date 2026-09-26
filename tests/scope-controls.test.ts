import test from 'node:test';
import assert from 'node:assert/strict';
import { dateDraftError, scopeFilterSummary, scopeSelectValue } from '../src/lib/scopeControls';

test('custom dates validate the whole pending range without publishing partial input', () => {
  assert.equal(dateDraftError({ start: '2026-10-01', end: '2026-09-30' }), 'End date must be on or after start date.');
  assert.equal(dateDraftError({ start: '2026-02-29', end: '' }), 'Choose a valid start date.');
  assert.equal(dateDraftError({ start: '', end: '', startIncomplete: true }), 'Enter a complete start date.');
  assert.equal(dateDraftError({ start: '2026-09-01', end: '', endIncomplete: true }), 'Enter a complete end date.');
  assert.equal(dateDraftError({ start: '2024-02-29', end: '2024-02-29' }), null);
});

test('custom dates preserve supported open-ended and all-time scopes', () => {
  assert.equal(dateDraftError({ start: '2026-09-01', end: '' }), null);
  assert.equal(dateDraftError({ start: '', end: '2026-09-30' }), null);
  assert.equal(dateDraftError({ start: '', end: '' }), null);
});

test('single-choice controls distinguish multiple and exclusion filters from one selected value', () => {
  assert.equal(scopeSelectValue(undefined), '');
  assert.equal(scopeSelectValue({ operator: 'in', values: ['Vendor A'] }), 'Vendor A');
  assert.equal(scopeSelectValue({ operator: 'equals', value: 'Vendor A' }), 'Vendor A');
  assert.equal(scopeSelectValue({ operator: 'in', values: ['Vendor A', 'Vendor B'] }), null);
  assert.equal(scopeSelectValue({ operator: 'not_equals', value: 'Vendor A' }), null);
});

test('applied filter summaries retain every supported operator and falsy values', () => {
  assert.equal(scopeFilterSummary({ operator: 'in', values: ['A', 'B'] }), 'A, B');
  assert.equal(scopeFilterSummary({ operator: 'equals', value: false }), 'false');
  assert.equal(scopeFilterSummary({ operator: 'not_equals', value: 'A' }), 'Not A');
  assert.equal(scopeFilterSummary({ operator: 'greater_than', value: 0 }), 'More than 0');
  assert.equal(scopeFilterSummary({ operator: 'less_than', value: 5 }), 'Less than 5');
  assert.equal(scopeFilterSummary({ operator: 'between', min: 0, max: 5 }), '0–5');
});
