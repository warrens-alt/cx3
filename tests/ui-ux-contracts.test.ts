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
  for (const label of ['Overview', 'Journey', 'Contact', 'Investigate', 'More']) {
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
  const routerPath = fs.existsSync('src/app/AppRouter.tsx') ? 'src/app/AppRouter.tsx' : 'src/App.tsx';
  const app = read(routerPath);
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
    assert.ok(
      app.includes(`path="${from}" element={<ScopePreservingRedirect to="${to}" replace />}`) ||
      app.includes(`path="${from}" element={<Navigate to="${to}" replace />}`),
      `missing redirect ${from} -> ${to}`
    );
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
  const shellPath = fs.existsSync('src/app/layouts/AppShell.tsx') ? 'src/app/layouts/AppShell.tsx' : 'src/App.tsx';
  const app = read(shellPath);
  assert.match(app, /setMobile\(false\)/);
  assert.match(app, /setCommand\(false\)/);
  assert.match(app, /window\.scrollTo/);
  assert.match(app, /const main = document\.getElementById\('main-content'\)/);
  assert.match(app, /main\?\.scrollTo/);
  assert.match(app, /main\?\.focus/);
});

test('evidence reports and Firebase are split from the main application bundle', () => {
  const routerPath = fs.existsSync('src/app/AppRouter.tsx') ? 'src/app/AppRouter.tsx' : 'src/App.tsx';
  const app = read(routerPath);
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
  assert.match(mobile, /navigationTarget\('\/contact-strategy', location\.pathname, location\.search\)/);
  assert.match(mobile, /navigationTarget\('\/exceptions', location\.pathname, location\.search\)/);

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
  assert.match(explorer, /\[selectedClient, startDate, endDate, filters, drill, drillValue, appliedSearch\]/);
  assert.match(explorer, /offset: page \* pageSize/);
  assert.match(explorer, /useOperationalData<RawLeadsData>/);
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


test('primary OfferNet tabs expose operating-control analytics appropriate to their purpose', () => {
  const expectations = [
    ['src/pages/ExecutiveOverview.tsx', 'OperatingControlStrip'],
    ['src/pages/FunnelIntelligence.tsx', 'SlaBandsPanel'],
    ['src/pages/SpeedToLeadIntelligence.tsx', 'OperatingWindowPanel'],
    ['src/pages/VendorLeadQuality.tsx', 'VendorControlsPanel'],
    ['src/pages/Exceptions.tsx', 'ContactGovernancePanel'],
    ['src/pages/SalesActivationIntelligence.tsx', 'ActivationAgeingPanel'],
    ['src/pages/TemporalIntelligence.tsx', 'OperatingWindowPanel'],
    ['src/pages/DataIntegrityIntelligence.tsx', 'DataCompletenessPanel'],
  ] as const;
  for (const [path, component] of expectations) {
    assert.match(read(path), new RegExp(component));
  }
});

test('contact strategy exposes observed effort controls without prescriptive redial claims', () => {
  const page = read('src/pages/ContactStrategyIntelligence.tsx');
  assert.match(page, /Zero-call leads/);
  assert.match(page, /One-call share/);
  assert.match(page, /5\+ calls, no RPC/);
  assert.match(page, /descriptive, not a recommended stop-threshold model/);
});

test('Explore labels OfferNet contact-governance drill populations', () => {
  const explorer = read('src/pages/LeadExplorerIntelligence.tsx');
  assert.match(explorer, /'high-attempt-no-rpc': '5\+ recorded calls without RPC'/);
  assert.match(explorer, /'one-call-only': 'Exactly one recorded call'/);
});

test('funnel source and grade views show delivery-to-sale progression', () => {
  const funnel = read('src/pages/FunnelIntelligence.tsx');
  assert.match(funnel, /cx-segment-funnel-rates/);
  assert.match(funnel, /<dt>Delivery<\/dt>/);
  assert.match(funnel, /<dt>Dial<\/dt>/);
  assert.match(funnel, /<dt>RPC<\/dt>/);
  assert.match(funnel, /<dt>Sale<\/dt>/);
});


test('record-level audit UI reflects admin-only access', () => {
  const drawer = read('src/components/DataAuditDrawer.tsx');
  assert.match(drawer, /useAuth/);
  assert.match(drawer, /enabled: isOpen && isAdmin/);
  assert.match(drawer, /Record access is restricted/);
});

test('CLI mutation controls are admin-only and production sample is hidden', () => {
  const cli = read('src/pages/CliPerformance.tsx');
  assert.match(cli, /isAdmin &&/);
  assert.match(cli, /sampleDataEnabled/);
  assert.match(cli, /\(import\.meta as any\)\.env\?\.DEV === true/);
  assert.match(cli, /Import report/);
  assert.match(cli, /Ask an administrator to configure a CLI source/);
});

test('Campaigns surfaces contracted reach and outbound-click analytics', () => {
  const page = read('src/pages/CampaignIntelligence.tsx');
  const client = read('src/lib/offernetClient.ts');
  assert.match(page, /Reach, outbound traffic & lead capture/);
  assert.match(page, /Outbound CTR/);
  assert.match(page, /Click → lead/);
  assert.match(client, /outboundClicks: number \| null/);
  assert.match(client, /clickToLeadRate: number \| null/);
});

test('frontend analytics cache is bounded and prunes stale entries', () => {
  const client = read('src/lib/offernetClient.ts');
  assert.match(client, /CACHE_MAX_ENTRIES = 200/);
  assert.match(client, /function pruneOffernetCache/);
  assert.match(client, /memoryCache\.delete/);
});


test('CLI import UI matches the scoped source contract and renders unavailable metrics safely', () => {
  const cli = read('src/pages/CliPerformance.tsx');
  assert.match(cli, /report_date, cli_number, campaign_code, total_calls, contact_count, sale_count/);
  assert.match(cli, /Missing optional metrics remain unavailable; CX3 never estimates them/);
  assert.match(cli, /summary\.distinctLeads !== null/);
  assert.match(cli, /summary\.durationGe5mRate !== null/);
  assert.match(cli, /Duration not supplied/);
  assert.match(cli, /d\.durationGe5mRate == null \? 'Unavailable'/);
});


test('trust-safe funnel, outcome and temporal presentation', () => {
  const funnel = read('src/pages/FunnelIntelligence.tsx');
  const sales = read('src/pages/SalesActivationIntelligence.tsx');
  const commercial = read('src/pages/CommercialIntelligence.tsx');
  const temporal = read('src/pages/TemporalIntelligence.tsx');
  const speed = read('src/pages/SpeedToLeadIntelligence.tsx');

  assert.match(funnel, /formatRatioPercent/);
  assert.doesNotMatch(funnel, /den > 0 .* : 0/);
  assert.doesNotMatch(funnel, /Number\(row\.[a-zA-Z]+ \|\| 0\)\.toLocaleString/);

  assert.match(sales, /formatRatioPercent\(row\.activations, row\.sales\)/);
  assert.doesNotMatch(sales, /activationRate \?\? 0/);

  assert.match(commercial, /<th>Coverage<\/th>/);
  assert.match(commercial, /formatTableNumber\(row\.platformLeads\)/);

  assert.match(temporal, /: null;/);
  assert.match(temporal, /data-empty=\{value === null\}/);
  assert.doesNotMatch(temporal, /rawVal \?\? 0/);

  assert.match(speed, /formatTableNumber\(row\.leads\)/);
  assert.match(speed, /formatPercent\(row\.contactRate\)/);
});

test('superseded page implementations stay removed behind compatibility redirects', () => {
  for (const path of [
    'src/pages/Acquisition.tsx',
    'src/pages/CallPerformance.tsx',
    'src/pages/DataAudit.tsx',
    'src/pages/DataCoverage.tsx',
    'src/pages/DataQuality.tsx',
    'src/pages/DataTrust.tsx',
    'src/pages/Explore.tsx',
    'src/pages/Funnel.tsx',
    'src/pages/Insights.tsx',
    'src/pages/LeadExplorer.tsx',
    'src/pages/Outcomes.tsx',
    'src/pages/Overview.tsx',
    'src/pages/QualityVetting.tsx',
    'src/pages/Revetting.tsx',
    'src/pages/SourceAnalysis.tsx',
    'src/pages/SpeedToLead.tsx',
  ]) {
    assert.equal(fs.existsSync(path), false, `superseded page returned: ${path}`);
  }
});


test('primary operational analytics are chart-first while retaining evidence tables', () => {
  const lifecycle = read('src/components/LifecycleDiagnostics.tsx');
  const speed = read('src/pages/SpeedToLeadIntelligence.tsx');
  const sales = read('src/pages/SalesActivationIntelligence.tsx');
  const agents = read('src/pages/AgentPerformanceIntelligence.tsx');
  const integrity = read('src/pages/DataIntegrityIntelligence.tsx');
  const campaigns = read('src/pages/CampaignIntelligence.tsx');

  assert.match(lifecycle, /FunnelWaterfall/);
  assert.match(lifecycle, /RankedMetricChart/);
  assert.match(speed, /Lead age vs downstream outcomes/);
  assert.match(speed, /VolumeRateComboChart/);
  assert.match(sales, /Vendor sales and activation/);
  assert.match(agents, /Agent call volume and RPC rate/);
  assert.match(integrity, /Observed discrepancy populations/);
  assert.match(integrity, /Source freshness age/);
  assert.match(campaigns, /Campaign lead volume and response rate/);
  assert.match(campaigns, /Planning budget only — not observed media spend/);
});

test('shared operational visual components centralize Recharts usage for new analytics', () => {
  const visuals = read('src/components/charts/OperationalVisuals.tsx');
  assert.match(visuals, /VolumeRateComboChart/);
  assert.match(visuals, /RankedMetricChart/);
  assert.match(visuals, /GroupedOutcomeChart/);
  assert.match(visuals, /ANALYTICS_COLORS/);
  assert.doesNotMatch(visuals, /budget.*spend/i);
});


test('overview and secondary operational tabs use the shared visual analytics language', () => {
  const overview = read('src/pages/ExecutiveOverview.tsx');
  const commercial = read('src/pages/CommercialIntelligence.tsx');
  const temporal = read('src/pages/TemporalIntelligence.tsx');
  const contact = read('src/pages/ContactStrategyIntelligence.tsx');
  const exceptions = read('src/pages/Exceptions.tsx');

  assert.match(overview, /Lead-to-activation journey/);
  assert.match(overview, /FunnelWaterfall/);
  assert.match(commercial, /Matched funnel outcomes by attribution key/);
  assert.match(temporal, /outcomes by hour/);
  assert.match(temporal, /VolumeRateComboChart/);
  assert.match(contact, /Observed yield by call-count bucket/);
  assert.doesNotMatch(contact, /from 'recharts'/);
  assert.match(exceptions, /Largest active exception populations/);
});


test('vendor, cohort and routing analytics use visual composition and maturation views', () => {
  const vendor = read('src/pages/VendorLeadQuality.tsx');
  const cohorts = read('src/pages/Cohorts.tsx');
  const routing = read('src/pages/RoutingIntelligence.tsx');
  const exceptions = read('src/pages/Exceptions.tsx');
  const visuals = read('src/components/charts/OperationalVisuals.tsx');

  assert.match(vendor, /Vendor grade composition/);
  assert.match(vendor, /StackedCompositionChart/);
  assert.match(vendor, /Vendor volume and downstream rates/);
  assert.match(cohorts, /maturation curves/);
  assert.match(cohorts, /MultiSeriesTrendChart/);
  assert.match(cohorts, /Cohort volume and observed outcomes/);
  assert.match(routing, /Routing depth and observed outcomes/);
  assert.match(routing, /Most common route sequences/);
  assert.match(visuals, /onSelect/);
  assert.match(exceptions, /useNavigate/);
  assert.match(exceptions, /onSelect=/);
});


test('chart interactions write into the existing URL-backed analytical filter scope', () => {
  const vendor = read('src/pages/VendorLeadQuality.tsx');
  const campaign = read('src/pages/CampaignIntelligence.tsx');
  const visuals = read('src/components/charts/OperationalVisuals.tsx');

  assert.match(visuals, /onSelect\?:/);
  assert.match(visuals, /cx-chart-clickable/);
  assert.match(vendor, /setFilter\('vendor'/);
  assert.match(campaign, /setFilter\('campaign'/);
  assert.match(campaign, /Select a bar to filter to that campaign/);
});

test('visual analytics styling is isolated and unreferenced legacy stylesheets stay removed', () => {
  const main = read('src/main.tsx');
  const analyticsCss = read('src/styles/analyticsVisuals.css');
  const productCss = read('src/styles/product.css');

  assert.match(main, /styles\/analyticsVisuals\.css/);
  assert.match(analyticsCss, /cx-analytics-visual-grid/);
  assert.match(analyticsCss, /cx-chart-toolbar/);
  assert.doesNotMatch(productCss, /Visual analytics hierarchy/);

  for (const path of [
    'src/styles/acquisition.css',
    'src/styles/explore.css',
    'src/styles/demo.css',
    'src/styles/visuals.css',
  ]) {
    assert.equal(fs.existsSync(path), false, `unused legacy stylesheet returned: ${path}`);
  }
});

test('ScopePreservingRedirect preserves scope, client, dates, and vendor across legacy aliases', async () => {
  const { buildPreservedDestination } = await import('../src/app/navigation/ScopePreservingRedirect');

  // Concrete regression example from user specification:
  // /calls?clientId=<authorised-fixture-client>&startDate=2026-09-01&endDate=2026-09-15&vendor=V1
  // must reach /contact-strategy with the same effective client, dates and vendor
  const callDestination = buildPreservedDestination(
    '/contact-strategy',
    '?clientId=test-client&startDate=2026-09-01&endDate=2026-09-15&vendor=V1'
  );
  assert.equal(
    callDestination,
    '/contact-strategy?clientId=test-client&startDate=2026-09-01&endDate=2026-09-15&vendor=V1'
  );

  // /acquisition -> /campaigns
  const acqDestination = buildPreservedDestination(
    '/campaigns',
    '?clientId=test-client&startDate=2026-08-01&endDate=2026-08-31&campaign=CMP1'
  );
  assert.equal(
    acqDestination,
    '/campaigns?clientId=test-client&startDate=2026-08-01&endDate=2026-08-31&campaign=CMP1'
  );
});

test('ScopePreservingRedirect preserves repeated parameters without silent last-value sanitization', async () => {
  const { buildPreservedDestination } = await import('../src/app/navigation/ScopePreservingRedirect');

  const destination = buildPreservedDestination(
    '/contact-strategy',
    '?clientId=c1&clientId=c2&vendor=V1&vendor=V2'
  );
  const params = new URLSearchParams(destination.split('?')[1]);
  assert.deepEqual(params.getAll('vendor'), ['V1', 'V2']);
  assert.deepEqual(params.getAll('clientId'), ['c1', 'c2']);
});

test('ScopePreservingRedirect preserves explore-local state for /leads and /explore', async () => {
  const { buildPreservedDestination } = await import('../src/app/navigation/ScopePreservingRedirect');

  const destination = buildPreservedDestination(
    '/lead-explorer',
    '?clientId=tenant&search=smith&drill=source&drillValue=v1&page=2&pageSize=50'
  );
  assert.equal(
    destination,
    '/lead-explorer?clientId=tenant&search=smith&drill=source&drillValue=v1&page=2&pageSize=50'
  );

  // Transient explore params must not leak into unrelated report families
  const nonExplore = buildPreservedDestination(
    '/sales-activation',
    '?clientId=tenant&search=smith&drill=source&drillValue=v1&page=2'
  );
  assert.equal(nonExplore, '/sales-activation?clientId=tenant');
});

test('ScopePreservingRedirect forces vendor dispositions tab while preserving mode, group and global scope', async () => {
  const { buildPreservedDestination } = await import('../src/app/navigation/ScopePreservingRedirect');

  const destination = buildPreservedDestination(
    '/contact-strategy?tab=vendor_dispositions',
    '?clientId=tenant&startDate=2026-09-01&endDate=2026-09-15&vendor=V1&mode=call_records&group=CONTACTED_RPC'
  );
  assert.equal(
    destination,
    '/contact-strategy?clientId=tenant&startDate=2026-09-01&endDate=2026-09-15&vendor=V1&mode=call_records&group=CONTACTED_RPC&tab=vendor_dispositions'
  );
  const params = new URLSearchParams(destination.split('?')[1]);
  assert.equal(params.get('tab'), 'vendor_dispositions');
  assert.equal(params.get('mode'), 'call_records');
  assert.equal(params.get('group'), 'CONTACTED_RPC');
  assert.equal(params.get('vendor'), 'V1');
  assert.equal(params.get('clientId'), 'tenant');
});

test('ScopePreservingRedirect isolates fixed release scope for /reports', async () => {
  const { buildPreservedDestination } = await import('../src/app/navigation/ScopePreservingRedirect');

  const destination = buildPreservedDestination(
    '/reports',
    '?clientId=tenant&release=v1.0.0&startDate=2026-09-01&endDate=2026-09-15&vendor=V1'
  );
  assert.equal(destination, '/reports?clientId=tenant&release=v1.0.0');
});

test('ScopePreservingRedirect rejects external redirect targets', async () => {
  const { buildPreservedDestination } = await import('../src/app/navigation/ScopePreservingRedirect');

  assert.equal(buildPreservedDestination('//evil.com', '?clientId=tenant'), '/overview');
  assert.equal(buildPreservedDestination('https://evil.com', '?clientId=tenant'), '/overview');
  assert.equal(buildPreservedDestination('javascript:alert(1)', '?clientId=tenant'), '/overview');
});

test('AppShell is the sole client switcher owner and ReportingScopeBar renders no competing interactive dropdown', () => {
  const shell = read('src/app/layouts/AppShell.tsx');
  const scopeBar = read('src/shared/reporting/ReportingScopeBar.tsx');

  assert.match(shell, /aria-label="Active client"/);
  assert.match(shell, /cx-workspace-select/);
  assert.doesNotMatch(scopeBar, /<select[^>]*aria-label="Client"/);
});

test('duplicate section navigation is removed and does not compete with AppShell area navigation', () => {
  const header = read('src/components/OperationalPageHeader.tsx');
  const sectionNav = read('src/components/SectionNavigation.tsx');

  assert.doesNotMatch(header, /SectionNavigation/);
  assert.match(sectionNav, /return null/);
});

test('R2: Overview router mounts OverviewPage on / and /overview', () => {
  const router = read('src/app/AppRouter.tsx');
  assert.match(router, /import\('\.\.\/features\/overview\/OverviewPage'\)/);
  assert.match(router, /path="\/" element={<OverviewPage key={selectedClient} \/>}/);
  assert.match(router, /path="\/overview" element={<OverviewPage key={selectedClient} \/>}/);
});

test('R2: PerformanceTrend adapts Overview API dailyTrends without zero-filling absent metrics', async () => {
  const { adaptDailyTrends } = await import('../src/features/overview/components/PerformanceTrend');
  const apiRows = [
    { date: '2026-09-01', leads: 150, delivered: 120, sales: 15, activations: 10, dialled: 110, contacted: 60, revenue: 15000 },
    { date: '2026-09-02', leads: 200, delivered: 180, sales: 25 },
  ];
  const adapted = adaptDailyTrends(apiRows);
  assert.equal(adapted.length, 2);
  assert.equal(adapted[0].leads, 150);
  assert.equal(adapted[0].delivered, 120);
  assert.equal(adapted[0].sales, 15);
  assert.equal(adapted[0].activations, 10);
  assert.equal(adapted[0].dialled, 110);
  assert.equal(adapted[0].contacted, 60);

  // Absent values must remain undefined rather than fabricated zero
  assert.equal(adapted[1].dialled, undefined);
  assert.equal(adapted[1].contacted, undefined);
  assert.equal(adapted[1].activations, undefined);
  assert.equal(adapted[1].revenue, undefined);
});

test('R2: OverviewPage binds verified lifecycle segments directly and eliminates backlog substitution', () => {
  const overviewPage = read('src/features/overview/OverviewPage.tsx');
  assert.doesNotMatch(overviewPage, /data\.segments \?\? data\.backlog/);
  assert.match(overviewPage, /segments=\{data\.lifecycle\?\.segments \|\| null\}/);
});

test('R2: SegmentComparison defines typed segment model, sorts by volume with stable tie-breaker, and discloses subset', () => {
  const segmentComp = read('src/features/overview/components/SegmentComparison.tsx');
  assert.match(segmentComp, /TypedSegmentItem/);
  assert.match(segmentComp, /b\.volume - a\.volume/);
  assert.match(segmentComp, /a\.name\.localeCompare\(b\.name\)/);
  assert.match(segmentComp, /Showing top \{displayedSubset\.length\} of \{sortedItems\.length\}/);
});

test('R2: InspectorHost preserves reporting scope on evidence drill navigation', () => {
  const inspector = read('src/shared/evidence/InspectorHost.tsx');
  assert.match(inspector, /useScopedNavigationTarget/);
  assert.match(inspector, /to=\{scoped\(drillPath\)\}/);
});


