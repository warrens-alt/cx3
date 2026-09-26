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


test('shared dialogs trap focus, restore focus and lock background scrolling', () => {
  const modal = read('src/components/Modal.tsx');
  const hook = read('src/hooks/useDialogAccessibility.ts');
  assert.match(modal, /useDialogAccessibility/);
  assert.match(modal, /role="dialog"/);
  assert.match(hook, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(hook, /event\.key === 'Escape'/);
  assert.match(hook, /event\.key !== 'Tab'/);
  assert.match(hook, /previousFocus\.focus/);
});

test('root-cause and lead timeline dialogs use shared accessibility behavior', () => {
  for (const path of [
    'src/components/RootCauseDrawer.tsx',
    'src/components/MarketingRootCauseDrawer.tsx',
    'src/pages/LeadExplorerIntelligence.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /useDialogAccessibility/);
    assert.match(source, /aria-modal="true"/);
  }
});

test('legacy lead timeline request carries the selected workspace scope', () => {
  const timeline = read('src/components/LeadTimelineModal.tsx');
  assert.match(timeline, /useClient/);
  assert.match(timeline, /clientId: selectedClient/);
  assert.match(timeline, /encodeURIComponent\(leadId\)/);
  assert.match(timeline, /credentials: 'same-origin'/);
});

test('login and access-state screens do not claim unverified live infrastructure state', () => {
  const login = read('src/components/LoginView.tsx');
  const pending = read('src/components/PendingApprovalView.tsx');
  const suspended = read('src/components/SuspendedView.tsx');

  assert.doesNotMatch(login, /BIGQUERY SYNCED/);
  assert.doesNotMatch(login, /\bLIVE\b/);
  assert.doesNotMatch(login, /TLS 1\.3/);
  assert.doesNotMatch(login, /8 Tenants/);
  assert.match(login, /ACCESS-CONTROLLED WORKSPACE/);

  assert.doesNotMatch(pending, /administrators have been notified/i);
  assert.doesNotMatch(pending, /window\.location\.reload/);
  assert.match(pending, /monitored while this page is open/i);

  assert.doesNotMatch(suspended, /mailto:/);
  assert.match(suspended, /platform administrator or internal support owner/);
});

test('route changes reset overlays, scroll to top and move focus to main content', () => {
  const app = read('src/App.tsx');
  assert.match(app, /setMobile\(false\)/);
  assert.match(app, /setCommand\(false\)/);
  assert.match(app, /window\.scrollTo/);
  assert.match(app, /getElementById\('main-content'\)\?\.focus/);
});

test('evidence reports and Firebase are split from the main application bundle', () => {
  const app = read('src/App.tsx');
  const vite = read('vite.config.ts');
  assert.match(app, /const VersionedReports = React\.lazy/);
  assert.doesNotMatch(app, /import VersionedReports from/);
  assert.match(vite, /vendor-firebase/);
  assert.match(vite, /node_modules\/firebase/);
});


test('mobile and in-page operational navigation preserve reporting scope', () => {
  const mobile = read('src/components/MobileBottomNav.tsx');
  assert.match(mobile, /navigationTarget\('\/overview', location\.pathname, location\.search\)/);
  assert.match(mobile, /navigationTarget\('\/funnel', location\.pathname, location\.search\)/);
  assert.match(mobile, /navigationTarget\('\/speed-to-lead', location\.pathname, location\.search\)/);
  assert.match(mobile, /navigationTarget\('\/vendor-quality', location\.pathname, location\.search\)/);

  for (const path of [
    'src/pages/ExecutiveOverview.tsx',
    'src/pages/FunnelIntelligence.tsx',
    'src/pages/SpeedToLeadIntelligence.tsx',
    'src/pages/VendorLeadQuality.tsx',
    'src/pages/Exceptions.tsx',
    'src/pages/SalesActivationIntelligence.tsx',
    'src/pages/CommercialIntelligence.tsx',
    'src/pages/TemporalIntelligence.tsx',
    'src/pages/AgentPerformanceIntelligence.tsx',
    'src/pages/RoutingIntelligence.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /useScopedNavigationTarget/);
    assert.doesNotMatch(source, /<Link\b[^>]*to=["']\/(?:overview|funnel|speed-to-lead|contact-strategy|vendor-quality|exceptions|campaigns|commercial|reports|lead-explorer|cli-performance)["']/);
  }
});

test('selected client is URL-addressable and preserved through evidence navigation', () => {
  const clients = read('src/lib/ClientContext.tsx');
  const presentation = read('src/lib/presentation.ts');
  assert.match(clients, /useSearchParams/);
  assert.match(clients, /next\.set\('clientId', id\)/);
  assert.match(clients, /searchParams\.get\('clientId'\)/);
  assert.match(presentation, /currentParams\.get\('clientId'\)/);
  assert.match(presentation, /workspace\.set\('clientId', clientId\)/);
});

test('Explorer record loading follows applied URL search state', () => {
  const explorer = read('src/pages/LeadExplorerIntelligence.tsx');
  assert.match(explorer, /const appliedSearch = params\.get\('search'\) \|\| ''/);
  assert.match(explorer, /search: appliedSearch \|\| undefined/);
  assert.match(explorer, /\[selectedClient, startDate, endDate, filters, drill, drillValue, appliedSearch, page\]/);
  assert.match(explorer, /setSearch\(appliedSearch\)/);
});

test('all custom analysis drawers use focus-managed dialog semantics', () => {
  for (const path of [
    'src/components/AnalyseDrawer.tsx',
    'src/components/MetricLineageDrawer.tsx',
    'src/components/RootCauseDrawer.tsx',
    'src/components/MarketingRootCauseDrawer.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /useDialogAccessibility/);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
  }
  const hook = read('src/hooks/useDialogAccessibility.ts');
  assert.match(hook, /topmostDialog/);
  assert.match(hook, /querySelector<HTMLElement>\('\.cx-main'\)/);
});
