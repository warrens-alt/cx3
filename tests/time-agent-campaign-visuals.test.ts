import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('speed-to-lead uses existing numeric timing evidence in a visual stage comparison', () => {
  const page = read('src/features/contact/SpeedPage.tsx');
  assert.match(page, /medianSec/);
  assert.match(page, /displayValue: stage\.median/);
  assert.match(page, /P90 \$\{stage\.p90 \?\? \'Unavailable\'\}/);
  assert.match(page, /<EvidenceBars/);
  assert.match(page, /Longer bars mean a longer measured median duration/);
  assert.match(page, /useSpeedModel/);
  assert.match(read('src/features/contact/model/useSpeedModel.ts'), /fetchSpeedToLead/);
});

test('temporal workspace keeps existing heatmap semantics and adds navigation only', () => {
  const page = read('src/pages/TemporalIntelligence.tsx');
  assert.match(page, /heatmapColors\(value, maxMetric\)/);
  assert.match(page, /metricView === 'contactRate'/);
  assert.match(page, /id="temporal-matrix"/);
  assert.match(page, /id="temporal-peaks"/);
  assert.match(page, /fetchTemporal/);
});

test('agent comparison ranks only existing returned roster measures', () => {
  const page = read('src/pages/AgentPerformanceIntelligence.tsx');
  assert.match(page, /type AgentMetric = 'calls' \| 'contactRate' \| 'saleRate'/);
  assert.match(page, /row\.totalCalls/);
  assert.match(page, /row\.contactRate/);
  assert.match(page, /row\.saleRate/);
  assert.match(page, /<EvidenceBars/);
  assert.match(page, /does not assign performance scores/);
  assert.match(page, /fetchAgentPerformance/);
});

test('campaign comparison excludes planning budget from the selectable performance measures', () => {
  const page = read('src/pages/CampaignIntelligence.tsx');
  assert.match(page, /type CampaignMeasure = 'leads' \| 'spend' \| 'ctr' \| 'cpl'/);
  assert.doesNotMatch(page, /type CampaignMeasure[^\n]*budget/);
  assert.match(page, /Budget remains excluded from performance comparisons/);
  assert.match(page, /setFilter\('campaign'/);
  assert.match(page, /fetchCampaigns/);
});

test('phase 5 styles keep dense evidence tables sticky and responsive', () => {
  const css = read('src/styles/timeAgentCampaignVisuals.css');
  for (const selector of ['.cx-speed-page', '.cx-temporal-page', '.cx-agent-page', '.cx-campaign-page']) assert.ok(css.includes(selector));
  assert.match(css, /position:sticky/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /https?:|@import|url\(/);
});

test('phase 5 stylesheet loads after earlier visual refinement layers', () => {
  const main = read('src/main.tsx');
  const previous = main.indexOf("import './styles/salesCommercialVisuals.css';");
  const phase = main.indexOf("import './styles/timeAgentCampaignVisuals.css';");
  assert.ok(previous >= 0 && phase > previous);
});
