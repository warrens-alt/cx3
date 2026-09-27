import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { JSDOM } from 'jsdom';
import BlcLifecycleCard from '../src/components/BlcLifecycleCard';

test('lifecycle navigation accepts the structured target returned by scoped navigation', () => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, {},
    React.createElement(BlcLifecycleCard, {
      source: {},
      reportHref: { pathname: '/sales-activation', search: '?clientId=ontact_blc&startDate=2026-09-01&endDate=2026-09-02' },
    })));
  // Validate the actual destination rather than an HTML serializer's entity spelling.
  const dom = new JSDOM(html);
  try {
    const link = dom.window.document.querySelector('a');
    assert.ok(link, 'The lifecycle card must expose its scoped report link');
    const href = link.getAttribute('href');
    assert.ok(href, 'The report link must have a destination');
    const target = new URL(href, 'https://cx3.example');
    assert.equal(target.origin, 'https://cx3.example');
    assert.equal(target.pathname, '/sales-activation');
    assert.deepEqual([...target.searchParams.entries()], [
      ['clientId', 'ontact_blc'],
      ['startDate', '2026-09-01'],
      ['endDate', '2026-09-02'],
    ]);
  } finally {
    dom.window.close();
  }
});
