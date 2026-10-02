/**
 * Synthetic frontend acceptance: 84 route/viewport/theme checks, six lifecycle interactions, seven shell interactions and two access-control theme checks.
 * Run after npm run build. Browser plugin not available; uses an optional Playwright runtime.
 * CX_PLAYWRIGHT_MODULE / CX_CHROMIUM_EXECUTABLE select an existing runtime; no dependencies are installed.
 * Screenshots and results are written outside the repository through CX_BROWSER_QA_OUTPUT or a temp directory.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { buildAcceptanceFixture } from './build-frontend-acceptance-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.env.CX_BROWSER_QA_OUTPUT || await mkdtemp(path.join(tmpdir(), 'cx3-convergence-qa-')));
const relativeOutput = path.relative(root, output);
assert.ok(relativeOutput === '..' || relativeOutput.startsWith(`..${path.sep}`) || path.isAbsolute(relativeOutput), 'Browser evidence must be written outside the repository.');
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(path.join(tmpdir(), 'cx3-convergence-app-'));
await buildAcceptanceFixture(fixture);
// Import the canonical metadata without requiring Node to understand TSX or browser modules.
const metadataPath = path.join(fixture, 'metadata.mjs');
await build({
  stdin: { contents: `import { ROUTE_MANIFEST, BUSINESS_AREAS } from './src/app/routeManifest';
    import { reductionPayloads } from './tests/frontend/reductionFixtures';
    import { convergencePayloads } from './tests/frontend/convergenceFixtures';
    import { SIDEBAR_COLLAPSED_KEY } from './src/lib/presentation';
    export const routes = ROUTE_MANIFEST.map(({icon, ...route}) => route);
    export const areas = BUSINESS_AREAS.map(({id, name, landingPath}) => ({id, name, landingPath}));
    export { reductionPayloads, convergencePayloads, SIDEBAR_COLLAPSED_KEY };`, resolveDir: root, loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', outfile: metadataPath,
});
const { routes, areas, reductionPayloads, convergencePayloads, SIDEBAR_COLLAPSED_KEY } = await import(pathToFileURL(metadataPath).href);
const matrixPaths = ['/overview', '/funnel', '/contact-strategy', '/speed-to-lead', '/temporal', '/sales-activation', '/vendor-quality', '/campaigns', '/commercial', '/investigate', '/lead-explorer', '/lead-ledger', '/data-integrity', '/admin'];
const matrixRoutes = matrixPaths.map(routePath => {
  const route = routes.find(item => item.path === routePath);
  assert.ok(route, `Missing requested canonical route ${routePath}`);
  return route;
});
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
];
const scope = '?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-28';
// The exception payload is shared in shape and values with check-investigation-browser.mjs.
const exception = { id: 'awaiting-first-dial', title: 'Awaiting first dial', count: 20, previousCount: 15, absoluteChange: 5, percentageChange: 100 / 3, severity: 'medium', description: 'Synthetic pending queue', byVendor: [{ name: 'Synthetic vendor', count: 20 }], bySource: [{ name: 'synthetic-source', count: 20 }] };
const payloads = {
  ...convergencePayloads,
  ...reductionPayloads,
  '/api/analytics/offernet/exceptions': { exceptions: [exception], validationStatus: 'NOT_VERIFIED', populationNote: 'Synthetic overlapping checks', comparison: { current: { startDate: '2026-09-28', endDate: '2026-09-28' }, previous: { startDate: '2026-09-27', endDate: '2026-09-27' }, days: 1 } },
};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
  const file = ['/fixture.js', '/fixture.css', '/application.css'].includes(pathname) ? pathname.slice(1) : 'index.html';
  try {
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    response.end(await readFile(path.join(fixture, file)));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.CX_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CX_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CX_CHROMIUM_EXECUTABLE } : {}) });
const checks = [], screenshots = [], errors = [], messages = [];
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const stage = (page, name) => page.locator(`nav[aria-label="Investigation workflow"] [data-stage="${name}"]`);
const waitStage = (page, name, value) => page.waitForFunction(({ name, value }) => document.querySelector(`[data-stage="${name}"]`)?.textContent.includes(value), { name, value });
const waitCurrentStage = (page, name) => page.waitForFunction(name => document.querySelector(`[data-stage="${name}"]`)?.getAttribute('aria-current') === 'step', name);
const namedOption = (page, name) => page.getByRole('option').filter({ has: page.locator('strong').filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
const requests = page => page.evaluate(() => [...window.__fixture.requests]);
const endpointCount = (values, endpoint) => values.filter(url => new URL(url, 'http://fixture.invalid').pathname === `/api/analytics/offernet/${endpoint}`).length;
const analyticalRequests = values => values.filter(url => /\/api\/analytics\//.test(url) && !url.includes('/filter-options'));
const basename = value => value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

async function visit(page, routePath, extra = '') {
  await page.goto(origin + routePath + scope + extra);
  await page.locator('main h1').waitFor();
  await page.waitForLoadState('networkidle');
  await settle(page);
}

async function overflow(page) {
  const dimensions = await page.evaluate(() => {
    const main = document.querySelector('main');
    const offenders = [...document.querySelectorAll('body *')].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
    }).slice(0, 30).map(element => ({ tag: element.tagName, class: element.className?.baseVal ?? element.className, text: element.textContent?.trim().slice(0, 70), left: Math.round(element.getBoundingClientRect().left), right: Math.round(element.getBoundingClientRect().right) }));
    return { viewport: innerWidth, document: document.documentElement.scrollWidth, main: main?.clientWidth, mainScroll: main?.scrollWidth, offenders };
  });
  assert.ok(dimensions.document <= dimensions.viewport + 1, `Document overflow: ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.mainScroll <= dimensions.main + 1, `Main content overflow: ${JSON.stringify(dimensions)}`);
  return dimensions;
}

async function ownership(page, route) {
  // Secondary routes expose their current link inside the existing More analyses menu.
  if (route.isMoreView) await page.locator('.cx-area-more-trigger').click();
  await page.waitForFunction(({ area, path }) => document.querySelector('.cx-breadcrumb')?.getAttribute('data-navigation-area') === area
    && document.querySelector('.cx-area-nav a[aria-current="page"]')?.getAttribute('href')?.split('?')[0] === path, { area: route.area, path: route.path });
  const desktop = page.locator('#desktop-navigation nav[aria-label="Main navigation"]');
  assert.deepEqual(await desktop.locator('a[data-navigation-area]').evaluateAll(elements => elements.map(element => element.dataset.navigationArea)), areas.map(area => area.id));
  assert.equal(await desktop.locator('a[aria-current]').count(), 1);
  assert.equal(await desktop.locator('a[aria-current]').getAttribute('data-navigation-area'), route.area);
  assert.equal(await page.locator('.cx-breadcrumb').getAttribute('data-navigation-area'), route.area);
  const contextual = page.locator('.cx-area-nav');
  assert.equal(await contextual.getAttribute('data-navigation-area'), route.area);
  assert.equal(await contextual.locator('a[aria-current="page"]').count(), 1);
  assert.equal(new URL(await contextual.locator('a[aria-current="page"]').getAttribute('href'), origin).pathname, route.path);
  const contextualPaths = await contextual.locator('a').evaluateAll(elements => elements.map(element => new URL(element.href).pathname));
  for (const contextualPath of contextualPaths) assert.equal(routes.find(item => item.path === contextualPath)?.area, route.area);
  const mobile = page.locator('.cx-mobile-nav-items');
  assert.deepEqual(await mobile.locator(':scope > *').allTextContents(), ['Overview', 'Journey', 'Contact', 'Investigate', 'More']);
  assert.equal(await mobile.locator('[aria-current]').count(), 1);
  const activeMobile = mobile.locator('[aria-current]');
  assert.equal(await activeMobile.getAttribute('data-navigation-area'), route.area);
  assert.equal((await activeMobile.textContent()).trim(), ({ overview: 'Overview', journey: 'Journey', contact: 'Contact', investigate: 'Investigate' })[route.area] || 'More');
  const accent = await contextual.evaluate(element => getComputedStyle(element).getPropertyValue('--cx-nav-accent').trim());
  assert.ok(accent, `No canonical accent token for ${route.area}`);
  if (route.isMoreView) await page.locator('.cx-area-more-trigger').click();
}

async function scenario(name, { viewport = viewports[0], theme = 'light', fixtureState = {}, ...metadata } = {}, action) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: theme, reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const localErrors = [], localMessages = [];
  page.on('pageerror', error => { const entry = { scenario: name, message: error.message }; localErrors.push(entry); errors.push(entry); });
  page.on('console', entry => { if (['error', 'warning'].includes(entry.type())) { const value = { scenario: name, type: entry.type(), message: entry.text() }; localMessages.push(value); messages.push(value); } });
  await page.addInitScript(({ theme, payloads, collapsedKey, fixtureState }) => {
    localStorage.setItem('cx-theme', theme);
    localStorage.setItem(collapsedKey, 'false');
    let fixture;
    Object.defineProperty(window, '__fixture', { configurable: true, get: () => fixture, set: value => { fixture = value; Object.assign(fixture, fixtureState); fixture.payloads = { ...payloads, ...value.payloads }; } });
  }, { theme, payloads, collapsedKey: SIDEBAR_COLLAPSED_KEY, fixtureState });
  const result = { name, ...metadata, viewport, theme, passed: false };
  try {
    const details = await action(page);
    await settle(page);
    assert.deepEqual(localErrors, [], 'Browser runtime errors');
    assert.deepEqual(localMessages, [], 'Browser console errors or warnings');
    result.passed = true;
    result.details = details;
    console.log(`PASS: ${name}`);
  } catch (error) {
    result.failure = { message: error.message, stack: error.stack, url: page.url(), body: (await page.locator('body').innerText().catch(() => '')).slice(0, 18000) };
    const screenshot = `failure-${basename(name)}.png`;
    await page.screenshot({ path: path.join(output, screenshot) }).catch(() => {});
    result.failure.screenshot = screenshot;
    console.error(`FAIL: ${name}: ${error.message}`);
  } finally {
    result.requests = await requests(page).catch(() => []);
    checks.push(result);
    await context.close();
  }
}

try {
  for (const theme of ['light', 'dark']) for (const viewport of viewports) for (const route of matrixRoutes) {
    await scenario(`${route.name} · ${viewport.name} · ${theme}`, { viewport, theme, kind: 'matrix', route: route.path }, async page => {
      await visit(page, route.path, ['/investigate', '/lead-explorer'].includes(route.path) ? '&drill=awaiting-first-dial' : '');
      assert.equal(new URL(page.url()).pathname, route.path);
      assert.equal(await page.title(), `${route.name} · Offernet`);
      assert.equal(await page.locator('main h1').count(), 1);
      const heading = (await page.locator('main h1').innerText()).trim();
      assert.equal(heading, route.name, 'The visible heading must match its canonical page identity');
      assert.ok((await page.locator('main').innerText()).length > 120, 'Main content must be meaningful');
      assert.equal(await page.locator('vite-error-overlay, nextjs-portal').count(), 0);
      assert.doesNotMatch(await page.locator('main').innerText(), /Something went wrong|Application error|Page not found/i);
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      if (route.scopePolicy !== 'settings') {
        const scopeBar = page.locator('main [aria-label="Reporting scope"]');
        assert.equal(await scopeBar.count(), 1);
        const scopeBox = await scopeBar.boundingBox();
        const scopeStyle = await scopeBar.evaluate(element => ({ display: getComputedStyle(element).display, visibility: getComputedStyle(element).visibility, opacity: getComputedStyle(element).opacity }));
        assert.ok(await scopeBar.isVisible() && scopeBox && scopeBox.width > 100 && scopeBox.height > 0, `Reporting scope must be visible: ${JSON.stringify({ scopeBox, scopeStyle })}`);
        assert.ok(scopeBox.y >= 0 && scopeBox.y + scopeBox.height <= viewport.height, `Reporting scope must be in the initial viewport: ${JSON.stringify(scopeBox)}`);
        const order = await page.locator('main h1').evaluate(heading => {
          const scope = document.querySelector('main [aria-label="Reporting scope"]');
          return { follows: Boolean(heading.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING), headingBottom: heading.getBoundingClientRect().bottom, scopeTop: scope.getBoundingClientRect().top };
        });
        assert.ok(order.follows && order.headingBottom <= order.scopeTop + 1, `Heading must precede scope: ${JSON.stringify(order)}`);
      }
      await ownership(page, route);
      const dimensions = await overflow(page);
      const metricFonts = await page.locator('.cx-metric-primary, .cx-metric-primary strong, .cx-metric-value, .cx-outcome-value, .cx-driver-summary strong').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => ({ value: element.textContent.trim(), family: getComputedStyle(element).fontFamily })));
      for (const metric of metricFonts) assert.doesNotMatch(metric.family, /monospace|SFMono|Menlo|Monaco|Consolas|Courier/i, `Primary metric must use the UI font: ${JSON.stringify(metric)}`);
      const retain = true;
      if (retain) {
        const filename = `${basename(route.path)}-${viewport.name}-${theme}.png`;
        await page.screenshot({ path: path.join(output, filename) });
        screenshots.push(filename);
      }
      return { heading, dimensions, metricFonts, unavailableState: /Synthetic request failure|unavailable/i.test(await page.locator('main').innerText()) };
    });
  }

  for (const theme of ['light', 'dark']) for (const viewport of viewports) {
    await scenario(`Lifecycle evidence interactions · ${viewport.name} · ${theme}`, { viewport, theme, kind: 'visual-interaction' }, async page => {
      await visit(page, '/overview');
      if (viewport.name === 'mobile') {
        const ribbon = page.locator('.cx-lifecycle-path');
        const iconBox = await ribbon.locator('.cx-lifecycle-node-icon').first().boundingBox();
        const countBox = await ribbon.locator('.cx-lifecycle-node strong').first().boundingBox();
        assert.ok(countBox.x >= iconBox.x + iconBox.width, 'Compact mobile counts must clear the vertical connector');
        const ribbonFile = `overview-ribbon-${viewport.name}-${theme}.png`;
        await ribbon.screenshot({ path: path.join(output, ribbonFile) });
        screenshots.push(ribbonFile);
      }
      const tabs = page.getByRole('tablist', { name: 'Select metric to plot' });
      await tabs.getByRole('tab', { name: 'Fetched leads' }).focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await tabs.getByRole('tab', { name: 'Delivered leads' }).getAttribute('aria-selected'), 'true');
      await page.getByText('View exact daily evidence', { exact: true }).click();
      assert.ok(await page.getByRole('region', { name: 'Daily trend evidence' }).isVisible());
      const before = analyticalRequests(await requests(page));
      await page.locator('.cx-lifecycle-node').first().focus();
      await page.keyboard.press('Enter');
      await page.getByRole('dialog').waitFor();
      assert.match(await page.getByRole('dialog').innerText(), /Fetched evidence/);
      await page.getByRole('button', { name: 'Close inspector' }).click();
      assert.deepEqual(analyticalRequests(await requests(page)), before);
      await visit(page, '/funnel');
      const lifecyclePath = page.locator('.cx-lifecycle-path');
      assert.equal(await lifecyclePath.locator('li[data-stage]').count(), 6);
      assert.equal(await lifecyclePath.locator('[data-transition="non-nested"]').count(), 2);
      assert.match(await lifecyclePath.innerText(), /6 of 8 with both events/);
      await lifecyclePath.scrollIntoViewIfNeeded();
      const filename = `lifecycle-path-${viewport.name}-${theme}.png`;
      await lifecyclePath.screenshot({ path: path.join(output, filename) });
      screenshots.push(filename);
      await page.getByText('View exact transition evidence', { exact: true }).click();
      assert.equal(await page.getByRole('region', { name: 'Transition evidence table' }).locator('tbody tr').count(), 5);
      const journeyRequests = analyticalRequests(await requests(page));
      await lifecyclePath.locator('button.cx-lifecycle-loss').first().focus();
      await page.keyboard.press('Enter');
      await page.getByRole('dialog').waitFor();
      assert.match(await page.getByRole('dialog').innerText(), /Capture.*Delivery Transition Dropoff/);
      assert.match(await page.locator('.cx-audit-result').innerText(), /2 leads/);
      await page.getByRole('button', { name: 'Close inspector' }).click();
      assert.deepEqual(analyticalRequests(await requests(page)), journeyRequests);
      return { exactStages: 6, nonNestedTransitions: 2, keyboardTrendSwitch: true, exactTable: true, keyboardInspectors: true, dimensions: await overflow(page) };
    });
  }

  await scenario('Desktop collapse retains seven accessible area links and a 60px rail', { kind: 'interaction' }, async page => {
    await visit(page, '/overview');
    await page.getByRole('button', { name: 'Collapse navigation', exact: true }).click();
    const rail = page.locator('#desktop-navigation');
    await page.waitForFunction(() => document.getElementById('desktop-navigation')?.getAttribute('data-collapsed') === 'true');
    assert.ok(Math.abs((await rail.boundingBox()).width - 60) <= 1);
    const links = rail.locator('nav[aria-label="Main navigation"] a');
    assert.equal(await links.count(), 7);
    assert.deepEqual(await links.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label'))), areas.map(area => area.name));
    for (const link of await links.all()) assert.equal(await link.isVisible(), true);
    await rail.locator('a[data-navigation-area="contact"]').click();
    await page.waitForURL('**/contact-strategy?**');
    assert.equal(await rail.getAttribute('data-collapsed'), 'true');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SIDEBAR_COLLAPSED_KEY), 'true');
    await page.getByRole('button', { name: 'Expand navigation', exact: true }).click();
    assert.ok((await rail.boundingBox()).width > 60);
    await overflow(page);
  });

  await scenario('Mobile navigation keeps five items; More has three areas and traps and returns focus', { viewport: viewports[2], kind: 'interaction' }, async page => {
    await visit(page, '/overview');
    for (const area of areas) {
      await page.evaluate(url => window.__fixture.navigate(url), area.landingPath + scope);
      await page.waitForURL(url => url.pathname === area.landingPath);
      await ownership(page, routes.find(route => route.path === area.landingPath));
    }
    const trigger = page.getByRole('button', { name: 'More areas', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'More areas', exact: true });
    await dialog.waitFor();
    assert.deepEqual(await dialog.locator('nav[aria-label="Main navigation"] a').evaluateAll(elements => elements.map(element => element.dataset.navigationArea)), ['sales', 'commercial', 'settings']);
    const focusBoundary = async last => dialog.evaluate((element, last) => {
      const controls = [...element.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter(control => control.tabIndex >= 0 && !control.disabled && control.getClientRects().length);
      (last ? controls.at(-1) : controls[0]).focus();
    }, last);
    const atBoundary = async last => dialog.evaluate((element, last) => {
      const controls = [...element.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter(control => control.tabIndex >= 0 && !control.disabled && control.getClientRects().length);
      return document.activeElement === (last ? controls.at(-1) : controls[0]);
    }, last);
    await focusBoundary(true); await page.keyboard.press('Tab'); assert.equal(await atBoundary(false), true);
    await focusBoundary(false); await page.keyboard.press('Shift+Tab'); assert.equal(await atBoundary(true), true);
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    await overflow(page);
  });

  await scenario('Command palette discovers every canonical route and supports keyboard navigation', { kind: 'interaction' }, async page => {
    await visit(page, '/overview');
    await page.keyboard.press('Control+k');
    const input = page.getByRole('combobox', { name: 'Search pages and navigation' });
    await input.waitFor();
    for (const route of routes) {
      await input.fill(route.name);
      const option = namedOption(page, route.name);
      assert.equal(await option.count(), 1, `Route missing from command search: ${route.name}`);
      assert.equal(await option.getAttribute('data-navigation-area'), route.area);
    }
    await input.fill('');
    const first = await input.getAttribute('aria-activedescendant');
    await input.press('ArrowDown'); assert.notEqual(await input.getAttribute('aria-activedescendant'), first);
    await input.press('ArrowUp'); assert.equal(await input.getAttribute('aria-activedescendant'), first);
    await input.fill('Lead ledger'); await input.press('Enter');
    await page.waitForURL('**/lead-ledger?**');
    const params = new URL(page.url()).searchParams;
    assert.equal(params.get('clientId'), 'synthetic-a');
    assert.equal(params.get('startDate'), '2026-09-28');
    assert.equal(params.get('endDate'), '2026-09-28');
    assert.equal(await page.getByRole('dialog', { name: 'Quick navigation' }).count(), 0);
    return { discoveredRoutes: routes.length };
  });

  await scenario('Scope Change is request-free for analytics; Refresh updates each active query once', { kind: 'interaction' }, async page => {
    await visit(page, '/investigate', '&investigationMetric=fetchedLeads');
    await waitStage(page, 'signal', 'Current 120');
    const before = await requests(page);
    const toggle = page.locator('[aria-label="Reporting scope"] .cx-scope-toggle');
    await toggle.click(); assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await settle(page);
    assert.deepEqual(analyticalRequests(await requests(page)), analyticalRequests(before));
    await toggle.click(); assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await page.evaluate(() => { window.__fixture.payloads['/api/analytics/offernet/root-cause'].metric.currentValue = 121; });
    await page.getByRole('button', { name: 'Refresh current view', exact: true }).click();
    await waitStage(page, 'signal', 'Current 121');
    await settle(page);
    const after = await requests(page);
    assert.equal(endpointCount(after, 'root-cause'), endpointCount(before, 'root-cause') + 1);
    assert.equal(endpointCount(after, 'exceptions'), endpointCount(before, 'exceptions') + 1);
    assert.equal(endpointCount(after, 'overview'), 0);
    assert.equal(endpointCount(after, 'operating-controls'), 0);
    return { before: analyticalRequests(before), after: analyticalRequests(after) };
  });

  await scenario('Compact workflow has six truthful stages and follows the current location', { kind: 'interaction' }, async page => {
    await visit(page, '/investigate', '&drill=awaiting-first-dial');
    await waitStage(page, 'signal', 'Current 20');
    const rail = page.getByRole('navigation', { name: 'Investigation workflow', exact: true });
    assert.deepEqual(await rail.locator('[data-stage]').evaluateAll(elements => elements.map(element => element.dataset.stage)), ['signal', 'diagnose', 'segment', 'records', 'evidence', 'conclusion']);
    assert.ok((await rail.boundingBox()).height <= 64, 'Workflow must remain one compact horizontal rail');
    assert.equal(await rail.locator('[aria-current="step"]').count(), 1);
    assert.equal(await stage(page, 'diagnose').getAttribute('aria-current'), 'step');
    const before = await requests(page);
    await stage(page, 'signal').click();
    await waitCurrentStage(page, 'signal');
    assert.equal(await stage(page, 'signal').getAttribute('aria-current'), 'step');
    assert.equal(await page.locator('.cx-investigation-new-signal').evaluate(element => element.open), true);
    await stage(page, 'conclusion').click();
    await waitCurrentStage(page, 'conclusion');
    assert.equal(await stage(page, 'conclusion').getAttribute('aria-current'), 'step');
    assert.equal(await page.locator('#investigation-evidence-tray').evaluate(element => element.open), true);
    assert.equal(new URL(page.url()).searchParams.get('drill'), 'awaiting-first-dial');
    assert.equal(new URL(page.url()).searchParams.get('clientId'), 'synthetic-a');
    assert.deepEqual(await requests(page), before);
    await page.setViewportSize(viewports[2]);
    await settle(page); await overflow(page);
    assert.ok((await rail.boundingBox()).height <= 72);
    assert.match(await rail.innerText(), /Conclusion/);
    assert.doesNotMatch(await rail.innerText(), /completed/i);
  });

  await scenario('Evidence disclosure retains pins, notes and one mounted confidence workspace', { viewport: viewports[2], theme: 'dark', kind: 'interaction' }, async page => {
    await visit(page, '/lead-explorer', '&drill=awaiting-first-dial');
    await page.locator('button[data-lead-id]:visible').first().click();
    await page.getByRole('button', { name: 'Pin lead evidence', exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.has('leadId'), false);
    await stage(page, 'conclusion').click();
    const tray = page.locator('#investigation-evidence-tray');
    const conclusion = page.getByLabel('Analyst conclusion · not validation');
    const unknowns = page.getByLabel('What remains unknown?');
    await conclusion.fill('Synthetic analyst note: further evidence required.');
    await unknowns.fill('Call evidence remains unavailable.');
    const before = await requests(page);
    await conclusion.evaluate(element => { window.__convergenceNote = element; });
    const summary = tray.locator(':scope > summary');
    await summary.click(); assert.equal(await tray.evaluate(element => element.open), false);
    await summary.click(); assert.equal(await tray.evaluate(element => element.open), true);
    assert.equal(await conclusion.inputValue(), 'Synthetic analyst note: further evidence required.');
    assert.equal(await unknowns.inputValue(), 'Call evidence remains unavailable.');
    assert.equal(await conclusion.evaluate(element => element === window.__convergenceNote), true);
    assert.match(await summary.innerText(), /1 pinned observation/);
    assert.equal(await page.locator('.cx-investigation-confidence').count(), 1);
    await page.setViewportSize(viewports[0]); await settle(page);
    assert.ok(Math.abs((await page.locator('.cx-investigation-evidence-panel').boundingBox()).width - 320) <= 1);
    assert.equal(await conclusion.inputValue(), 'Synthetic analyst note: further evidence required.');
    assert.deepEqual(await requests(page), before);
    assert.equal(endpointCount(before, 'data-integrity'), 1);
    await overflow(page);
  });

  await scenario('Role restrictions remove record access, requests and prior session evidence', { kind: 'interaction' }, async page => {
    await visit(page, '/lead-explorer', '&drill=awaiting-first-dial');
    await page.locator('button[data-lead-id]:visible').first().click();
    await page.getByRole('button', { name: 'Pin lead evidence', exact: true }).click();
    await page.evaluate(() => { window.__fixture.requests = []; window.__fixture.setAccess({ nonAdmin: true }); });
    await page.getByText('Record access is restricted to authorised administrators', { exact: false }).waitFor();
    assert.equal(await page.getByRole('complementary', { name: /Lead dossier for/ }).count(), 0);
    assert.equal((await requests(page)).filter(url => /raw-leads|lead-timeline|source-observability/.test(url)).length, 0);
    await page.evaluate(url => window.__fixture.navigate(url), '/investigate' + scope + '&drill=awaiting-first-dial');
    await page.waitForURL('**/investigate?**');
    await stage(page, 'records').waitFor();
    assert.equal(await stage(page, 'records').getAttribute('aria-disabled'), 'true');
    assert.equal(await page.locator('.cx-area-nav a[href*="/lead-explorer"]').count(), 0);
    await page.keyboard.press('Control+k');
    const input = page.getByRole('combobox', { name: 'Search pages and navigation' });
    for (const route of routes.filter(item => item.adminOnly)) {
      await input.fill(route.name);
      assert.equal(await namedOption(page, route.name).count(), 0);
    }
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__fixture.setAccess({ nonAdmin: false }));
    await waitStage(page, 'evidence', '0 session observations');
    assert.equal(await page.getByRole('complementary', { name: /Lead dossier for/ }).count(), 0);
  });

  for (const theme of ['light', 'dark']) {
    await scenario(`Access control policy presentation · ${theme}`, { theme, kind: 'supplemental', route: '/access-control', fixtureState: { firestoreFailure: false } }, async page => {
      // Exercise the fixture's existing successful empty subscription, then inspect its honest draft-policy UI.
      // No account, invite, policy or remote configuration mutation is submitted.
      await visit(page, '/access-control');
      const route = routes.find(route => route.path === '/access-control');
      assert.equal(await page.title(), `${route.name} · Offernet`);
      assert.equal((await page.locator('main h1').innerText()).trim(), route.name);
      await ownership(page, route);
      await page.getByRole('button', { name: 'Access Policies', exact: true }).click();
      await page.getByRole('heading', { name: 'Access Control & Registration Rules', exact: true }).waitFor();
      assert.match(await page.locator('main').innerText(), /Draft policy values\. The current saved policy is not loaded here/);
      assert.equal(await page.getByLabel('Default role', { exact: true }).isVisible(), true);
      assert.equal(await page.getByLabel('Default role', { exact: true }).inputValue(), 'viewer');
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      await overflow(page);
      const filename = `access-control-desktop-${theme}.png`;
      await page.screenshot({ path: path.join(output, filename) });
      screenshots.push(filename);
      assert.deepEqual(analyticalRequests(await requests(page)), []);
      return { subscriptionFixture: 'Successful empty directory, invites and audit subscriptions', policyState: 'Explicitly labelled draft defaults; no mutations submitted' };
    });
  }
} finally {
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ synthetic: true, fixturePolicy: 'Existing synthetic fixtures only; unavailable endpoints remain explicit unavailable states.', browserPath: 'Browser plugin not available; optional Playwright runtime.', origin, browser: await browser.version(), expectedChecks: matrixRoutes.length * viewports.length * 2 + viewports.length * 2 + 9, passed: checks.filter(check => check.passed).length, failed: checks.filter(check => !check.passed).length, checks, screenshots, errors, messages }, null, 2));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(`Browser evidence: ${output}`);
if (checks.length !== 63 || checks.some(check => !check.passed)) process.exitCode = 1;
