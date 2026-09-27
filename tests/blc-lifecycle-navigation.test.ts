import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import BlcLifecycleCard from '../src/components/BlcLifecycleCard';

test('lifecycle navigation accepts the structured target returned by scoped navigation', () => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, {},
    React.createElement(BlcLifecycleCard, {
      source: {},
      reportHref: { pathname: '/sales-activation', search: '?clientId=ontact_blc&startDate=2026-09-01&endDate=2026-09-02' },
    })));
  assert.match(html, /href="\/sales-activation\?clientId=ontact_blc&amp;startDate=2026-09-01&amp;endDate=2026-09-02"/);
});
