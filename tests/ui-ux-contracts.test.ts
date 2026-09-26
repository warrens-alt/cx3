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


test('advanced analytics use the consolidated operational shell', () => {
  for (const path of [
    'src/pages/TemporalIntelligence.tsx',
    'src/pages/AgentPerformanceIntelligence.tsx',
    'src/pages/RoutingIntelligence.tsx',
    'src/pages/Cohorts.tsx',
    'src/pages/CliPerformance.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /cx-command-page/);
    assert.match(source, /OperationalPageHeader/);
  }
});

test('advanced pages no longer expose redundant table-versus-graph view toggles', () => {
  for (const path of [
    'src/pages/TemporalIntelligence.tsx',
    'src/pages/AgentPerformanceIntelligence.tsx',
    'src/pages/RoutingIntelligence.tsx',
    'src/pages/Cohorts.tsx',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /setViewMode/);
    assert.doesNotMatch(source, /setMatrixView/);
    assert.doesNotMatch(source, /setFunnelView/);
    assert.doesNotMatch(source, /setDepthView/);
    assert.doesNotMatch(source, /setPathsView/);
    assert.doesNotMatch(source, /setHandoffView/);
  }
});

test('CLI funnel never fabricates answered or activation stages', () => {
  const cli = read('src/pages/CliPerformance.tsx');
  assert.doesNotMatch(cli, /Math\.round\(calls\s*\*\s*0\.54\)/);
  assert.doesNotMatch(cli, /Math\.round\(sales\s*\*\s*0\.68\)/);
  assert.match(cli, /s\.answeredCount !== null/);
  assert.match(cli, /s\.activations !== null/);
});

test('agent UI does not render an unapproved performance tier', () => {
  const agent = read('src/pages/AgentPerformanceIntelligence.tsx');
  assert.doesNotMatch(agent, /Performance Tier/);
  assert.doesNotMatch(agent, /performanceTier/);
  assert.match(agent, /does not assign performance scores or tiers/);
});

test('duplicate legacy routes redirect to maintained product surfaces', () => {
  const app = read('src/App.tsx');
  const redirects = [
    ['/insights', '/overview'],
    ['/explore', '/lead-explorer'],
    ['/acquisition', '/campaigns'],
    ['/call-performance', '/contact-strategy'],
    ['/outcomes', '/sales-activation'],
    ['/sources', '/vendor-quality'],
    ['/quality', '/vendor-quality'],
    ['/data-trust', '/data-integrity'],
    ['/data-quality', '/data-integrity'],
    ['/data-coverage', '/data-integrity'],
    ['/audit', '/data-integrity'],
  ];
  for (const [from, to] of redirects) {
    assert.ok(app.includes(`path="${from}" element={<Navigate to="${to}" replace />}`), `missing redirect ${from} -> ${to}`);
  }
});
