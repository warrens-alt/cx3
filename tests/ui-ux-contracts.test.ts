import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('primary operational pages use the shared command-centre shell', () => {
  for (const path of [
    'src/pages/FunnelIntelligence.tsx',
    'src/pages/SpeedToLeadIntelligence.tsx',
    'src/pages/SalesActivationIntelligence.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /cx-command-page/);
    assert.match(source, /OperationalPageHeader/);
    assert.match(source, /OffernetFilterBar/);
  }
});

test('primary diagnostic pages do not require table-vs-chart mode switching', () => {
  const funnel = read('src/pages/FunnelIntelligence.tsx');
  const speed = read('src/pages/SpeedToLeadIntelligence.tsx');
  const sales = read('src/pages/SalesActivationIntelligence.tsx');

  for (const source of [funnel, speed, sales]) {
    assert.doesNotMatch(source, /ViewMode/);
    assert.doesNotMatch(source, /setVendorView/);
    assert.doesNotMatch(source, /setStagesView/);
    assert.doesNotMatch(source, /setCohortsView/);
    assert.doesNotMatch(source, /setAfterHoursView/);
  }
});

test('date presets use the browser local calendar rather than UTC ISO truncation', () => {
  const filters = read('src/components/OffernetFilterBar.tsx');
  const context = read('src/lib/FilterContext.tsx');
  assert.match(filters, /getFullYear\(\)/);
  assert.match(filters, /getMonth\(\)/);
  assert.match(filters, /getDate\(\)/);
  assert.doesNotMatch(filters, /toISOString\(\)\.slice\(0, 10\)/);
  assert.doesNotMatch(context, /const end = now\.toISOString\(\)\.slice\(0, 10\)/);
});

test('mobile navigation exposes the four primary operator goals before More', () => {
  const mobile = read('src/components/MobileBottomNav.tsx');
  for (const label of ['Overview', 'Funnel', 'Contact', 'Performance', 'More']) {
    assert.ok(mobile.includes(`<span>${label}</span>`), `missing mobile destination: ${label}`);
  }
  assert.doesNotMatch(mobile, /<span>Exceptions<\/span>/);
});

test('sidebar uses one command search instead of a second filtering navigation system', () => {
  const sidebar = read('src/components/Sidebar.tsx');
  assert.match(sidebar, /cx-sidebar-search/);
  assert.doesNotMatch(sidebar, /placeholder="Search navigation/);
  assert.doesNotMatch(sidebar, /setCollapsed/);
  assert.doesNotMatch(sidebar, /animate-ping/);
});

test('campaign reporting does not silently discard persisted operational filters', () => {
  const campaign = read('src/pages/CampaignIntelligence.tsx');
  assert.match(campaign, /\.\.\.extractOffernetFilters\(filters\)/);
  assert.doesNotMatch(campaign, /campaign:\s*extractOffernetFilters\(filters\)\.campaign/);
});
