import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import VisualWorkspace from '../src/pages/VisualWorkspace';

test('visual catalogue renders unavailable evidence instead of synthetic business measurements', () => {
  const render = (route: string) => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(VisualWorkspace)));
  const first = render('/visuals?clientId=tenant-a&startDate=2026-09-01&endDate=2026-09-30');
  const other = render('/visuals?clientId=tenant-b&startDate=2026-08-01&endDate=2026-08-31');
  assert.equal(first, other, 'An unconnected catalogue cannot imply measurements for the selected scope');
  assert.match(first, /No analytical dataset is connected/);
  assert.match(first, /No plottable values/);
  assert.match(first, /data-state="unavailable"/);
  assert.match(first, /Recorded Sales/);
  assert.doesNotMatch(first, /Verified Sales|cx-viz-canvas|returned points|tenant-a|2026-09-01|Selected Point/);
  assert.equal((first.match(/aria-pressed="true"/g) || []).length, 1);
  assert.equal((first.match(/aria-pressed="false"/g) || []).length, 4);
});

test('unconnected visual catalogue has no synthetic generator or selected-scope data dependency', () => {
  const source = readFileSync('src/pages/VisualWorkspace.tsx', 'utf8');
  assert.doesNotMatch(source, /Math\.(sin|random)|useFilters|useClient|fetch\(|Verified Sales/);
  assert.match(source, /const points: VisualPoint\[\] = \[\]/);
});

test('unmounted historical executive console is not an application lazy import', () => {
  const router = readFileSync('src/app/AppRouter.tsx', 'utf8');
  assert.doesNotMatch(router, /pages\/ExecutiveOverview|ExecutiveAnalyticsConsole/);
  assert.match(router, /path="\/overview" element=\{<OverviewPage/);
});
