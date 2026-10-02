import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildOperatingControlsResult } from '../server/analytics/contact/operatingControls';
import { AttemptCoveragePanel, ContactGovernancePanel, OperatingControlStrip, VendorControlsPanel } from '../src/components/OfferNetControlPanels';

const data = buildOperatingControlsResult({
  total_leads: 10, dialled_leads: 8, delivered_leads: 9,
  unrecorded_call_leads: 3, dialled_unrecorded_call_leads: 2, zero_call_leads: 1, one_call_leads: 2,
  attempts: [{ bucket: 'Unrecorded', leads: 3, contacted: 0, sales: 0, activations: 0 }, { bucket: '0 calls', leads: 1, contacted: 0, sales: 0, activations: 0 }],
  vendor_controls: [{ vendor: 'Synthetic vendor', leads: 10, dialled: 8, unrecorded_call_leads: 3, dialled_unrecorded_call_leads: 2, zero_call_leads: 1, one_call_leads: 2 }],
}, {}, { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] });

test('operating controls presentation keeps zero and unrecorded coverage separate', () => {
  const html = renderToStaticMarkup(React.createElement(AttemptCoveragePanel, { data }));
  assert.match(html, /<th>Call count unrecorded<\/th><td>3<\/td>/);
  assert.match(html, /<th>Zero calls<\/th><td>1<\/td>/);
  assert.match(html, /including 2 dialled leads \(25.0% of the dialled denominator\)/);
  assert.match(html, /unknown RPC is excluded/);
});

test('contact governance exposes both count populations and unknown denominator coverage', () => {
  const html = renderToStaticMarkup(React.createElement(ContactGovernancePanel, { data }));
  assert.match(html, /Call count unrecorded/);
  assert.match(html, /Zero calls/);
  assert.match(html, /2 qualified dialled leads lack a valid cumulative counter/);
  assert.match(html, /explicit non-RPC evidence; unknown RPC does not qualify/);
  const strip = renderToStaticMarkup(React.createElement(OperatingControlStrip, { data }));
  assert.match(strip, /2 dialled leads have unrecorded call counts/);
  assert.match(strip, /Awaiting qualified first dial/);
});

test('vendor controls preserve missing-vs-zero and denominator counts in separate columns', () => {
  const html = renderToStaticMarkup(React.createElement(VendorControlsPanel, { data }));
  assert.match(html, /<th>Zero calls<\/th><th>Call count unrecorded<\/th><th>Dialled with count unrecorded<\/th>/);
  assert.match(html, /<td>1<\/td><td>3<\/td><td>2 · 25.0%<\/td>/);
});

test('unavailable counter coverage is not rendered as zero', () => {
  const missing = buildOperatingControlsResult({ total_leads: 10, dialled_leads: 8 }, {}, { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] });
  const html = renderToStaticMarkup(React.createElement(ContactGovernancePanel, { data: missing }));
  assert.match(html, /— qualified dialled leads lack a valid cumulative counter/);
  assert.doesNotMatch(html, /0 qualified dialled leads lack a valid cumulative counter/);
});
