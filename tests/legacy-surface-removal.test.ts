import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ROUTE_MANIFEST } from '../src/app/routeManifest';
import { NAVIGATION_PAGES, navigationPage, searchNavigation } from '../src/lib/navigation';

test('legacy Lead Engine has no route, navigation, search or alias entry', () => {
  const app = readFileSync('src/app/AppRouter.tsx', 'utf8');
  assert.doesNotMatch(app, /lead-engine|leadEngine|LeadEngine/);
  for (const route of ROUTE_MANIFEST) {
    assert.notEqual(route.path, '/lead-engine');
    assert.ok(!route.urlAliases?.includes('/lead-engine'));
  }
  assert.ok(!NAVIGATION_PAGES.some(page => /lead.?engine/i.test(`${page.path} ${page.name}`)));
  assert.equal(navigationPage('/lead-engine'), undefined);
  for (const admin of [true, false]) {
    assert.equal(searchNavigation('Lead Engine', admin).length, 0);
    assert.ok(!searchNavigation('', admin).some(page => page.path === '/lead-engine'));
  }
});

test('unused Lead Engine frontend and backend packages are deleted', () => {
  assert.equal(existsSync('src/leadEngine'), false);
  assert.equal(existsSync('server/leadEngine'), false);
});


test('historical synthetic executive analytics cannot be imported or bundled', () => {
  assert.equal(existsSync('src/pages/ExecutiveOverview.tsx'), false);
  assert.equal(existsSync('src/components/analytics/ExecutiveAnalyticsConsole.tsx'), false);
  const router = readFileSync('src/app/AppRouter.tsx', 'utf8');
  assert.doesNotMatch(router, /ExecutiveOverview|ExecutiveAnalyticsConsole/);
  assert.match(router, /path="\/overview" element=\{<OverviewPage/);
});


test('unconsumed duplicate legacy implementations cannot reintroduce numeric fallbacks', () => {
  assert.equal(existsSync('server/queries.ts'), false);
  for (const name of ['overview', 'funnel', 'quality', 'calls', 'sources', 'leads', 'routing', 'index']) {
    assert.equal(existsSync(`server/bigquery/legacy/${name}.ts`), false, name);
  }
  assert.equal(existsSync('server/bigquery/legacy/cohorts.ts'), true);
});

test('diagnostic routes mount their canonical owners after unused lazy exports are retired', () => {
  const router = readFileSync('src/app/AppRouter.tsx', 'utf8');
  for (const [path, component, lens] of [['/funnel', 'JourneyWorkspace', 'lifecycle'], ['/speed-to-lead', 'OperationsWorkspace', 'response'], ['/contact-strategy', 'OperationsWorkspace', 'contact'], ['/sales-activation', 'JourneyWorkspace', 'outcomes']]) {
    assert.ok(router.includes(`path="${path}" element={<${component} key={selectedClient} lens="${lens}"`), `${path} mounts its ${component} lens`);
  }
  const journey = readFileSync('src/workspaces/journey/JourneyWorkspace.tsx', 'utf8');
  const operations = readFileSync('src/workspaces/operations/OperationsWorkspace.tsx', 'utf8');
  assert.match(journey, /const JourneyWorkbench = lazy\(\(\) => import\('\.\/JourneyWorkbench'\)\)/);
  assert.match(journey, /<JourneyWorkbench selection=\{selection\} onSelect=\{select\}/);
  assert.match(journey, /const Outcomes = lazy\(\(\) => import\('\.\.\/\.\.\/features\/sales\/SalesActivationPage'\)\)/);
  assert.match(journey, /outcomes: Outcomes/);
  assert.match(journey, /Specialist \? <Specialist \/>/);
  assert.match(operations, /const Contact = lazy\(\(\) => import\('\.\.\/\.\.\/features\/contact\/ContactPage'\)\)/);
  assert.match(operations, /const Response = lazy\(\(\) => import\('\.\.\/\.\.\/features\/contact\/SpeedPage'\)\)/);
  assert.match(operations, /active === 'contact' \|\| active === 'dispositions' \? <Contact/);
  assert.match(operations, /active === 'response' \? <Response \/>/);
  for (const name of ['SpeedToLeadIntelligence', 'ContactStrategyIntelligence', 'SalesActivationIntelligence']) {
    assert.equal(existsSync(`src/pages/${name}.tsx`), false, name);
    assert.ok(!router.includes(name), `${name} is not bundled by the router`);
  }
  assert.equal(existsSync('src/pages/FunnelIntelligence.tsx'), true, 'unresolved vendor-ratio semantics remain reference-only');
  assert.doesNotMatch(router, /pages\/FunnelIntelligence/);
  assert.match(router, /path="\/outcomes" element=\{<ScopePreservingRedirect to="\/sales-activation"/);
  assert.match(router, /path="\/lead-ledger" element=\{<LeadLedgerCompatibilityRedirect/);
  assert.match(router, /attemptChunkRecovery\(\)/);
  assert.match(router, /<ErrorBoundary/);
  assert.match(router, /<Suspense/);
});

test('unused access duplicates are retired while mounted access capabilities retain their owners', () => {
  for (const name of ['AccessInvitesTab', 'AccessPoliciesTab', 'AuditLogTab', 'PreAuthorizeModal', 'TenantScopeModal', 'UsersDirectoryTab']) {
    assert.equal(existsSync(`src/components/users/${name}.tsx`), false, name);
  }
  const management = readFileSync('src/pages/UserManagement.tsx', 'utf8');
  for (const owner of ['UserDirectory', 'AccessInvites', 'AccessPolicies', 'AccessAuditLog', 'UserAccessEditor']) {
    assert.ok(management.includes(`features/access/${owner}`), owner);
  }
});

test('workspace failure retains recovery without advertising an unimplemented synthetic demo', () => {
  assert.equal(existsSync('src/pages/DemoWorkspace.tsx'), false);
  const shell = readFileSync('src/app/layouts/AppShell.tsx', 'utf8');
  assert.doesNotMatch(shell, /DEMO_ENTRY_URL|View demo data|demo is a separate, synthetic workspace/);
  assert.match(shell, /onClick=\{retryClient\}/);
  assert.match(shell, /No fallback tenant or substitute analytical data is being displayed/);
});
