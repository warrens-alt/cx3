/** Routed synthetic product QA. No production authentication, warehouse or customer data. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { buildAcceptanceFixture } from './build-frontend-acceptance-fixture.mjs';
const { chromium } = await import(process.env.CX_PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.CX_BROWSER_QA_OUTPUT || await mkdtemp(path.join(tmpdir(), 'cx3-product-qa-'));
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(path.join(tmpdir(), 'cx3-product-app-'));
await buildAcceptanceFixture(fixture);
const metadataPath = path.join(fixture, 'product-payloads.mjs');
await build({ stdin: { contents: `export { reductionPayloads } from './tests/frontend/reductionFixtures';
  export { convergencePayloads } from './tests/frontend/convergenceFixtures';
  export { secondaryMaturityPayloads } from './tests/frontend/secondaryMaturityFixtures';
  export { productPayloads } from './tests/frontend/productFixtures';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: metadataPath });
const { reductionPayloads, convergencePayloads, secondaryMaturityPayloads, productPayloads } = await import(pathToFileURL(metadataPath).href);
const payloads = { ...convergencePayloads, ...reductionPayloads, ...secondaryMaturityPayloads, ...productPayloads,
  '/api/analytics/offernet/exceptions': { exceptions: [{ id:'awaiting-first-dial',title:'Awaiting first dial',count:20,previousCount:15,absoluteChange:5,percentageChange:100/3,severity:'medium',description:'Synthetic pending queue',byVendor:[{name:'Synthetic vendor',count:20}],bySource:[{name:'synthetic-source',count:20}] }],validationStatus:'NOT_VERIFIED',populationNote:'Synthetic overlapping checks',comparison:{current:{startDate:'2026-09-28',endDate:'2026-09-28'},previous:{startDate:'2026-09-27',endDate:'2026-09-27'},days:1} }
};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = pathname === '/brand/conversionx-grey.png' ? 'conversionx-grey.png' : ['/fixture.js', '/fixture.css', '/application.css'].includes(pathname) ? pathname.slice(1) : 'index.html';
  try { response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html'); response.end(await readFile(path.join(fixture, file))); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.CX_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CX_CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
await page.addInitScript(payloads => {
  let fixture;
  Object.defineProperty(window, '__fixture', { configurable:true, get:()=>fixture, set:value=>{fixture=value;fixture.payloads={...payloads,...value.payloads};} });
}, payloads);
const errors = [], consoleMessages = [], checks = [], screenshots = [];
page.on('pageerror', error => errors.push({ route: page.url(), message: error.message }));
page.on('console', entry => { if (['error','warning'].includes(entry.type())) consoleMessages.push({ route: page.url(), message: entry.text() }); });
const scope = '?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-28';
const check = async (name, action) => { await action(); checks.push({ name, passed: true }); console.log(`PASS: ${name}`); };
let failure;
try {
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(theme => localStorage.setItem('cx-theme', theme), theme);
    for (const width of [1440, 1024, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [route, heading] of [['/command','Command'],['/journey','Journey'],['/operations','Operations'],['/investigate','Investigate'],['/commercial','Commercial'],['/evidence','Evidence']]) {
        await check(`${theme} ${width}px ${route}: meaningful workspace, one heading, no page overflow`, async () => {
          await page.goto(origin + route + scope);
          await page.getByRole('heading', { name: heading, exact: true, level: 1 }).waitFor();
          // The workspace's lazy analytical owner must settle before measuring geometry.
          await page.waitForFunction(() => ![...document.querySelectorAll('[role="status"]')].some(el => /^(Opening |Loading operational|Loading lifecycle)/.test(el.textContent || '')));
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          assert.equal(await page.locator('main h1').count(), 1);
          assert.equal(await page.locator('vite-error-overlay').count(), 0);
          assert.equal(await page.getByText('This page could not be displayed', { exact: true }).count(), 0);
          assert.equal(await page.getByText(/This view couldn.t be loaded|Synthetic request failure/).count(), 0);
          const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, main: document.querySelector('main').clientWidth, mainScroll: document.querySelector('main').scrollWidth }));
          assert.ok(geometry.document <= width + 1, JSON.stringify(geometry));
          assert.ok(geometry.mainScroll <= geometry.main + 1, JSON.stringify(geometry));
          if (route === '/evidence') {
            const spacing = await page.evaluate(() => ({
              headingBottom: document.querySelector('.cx-product-workspace-heading').getBoundingClientRect().bottom,
              dateTop: document.querySelector('.cx-scope-summary > span').getBoundingClientRect().top,
            }));
            assert.ok(spacing.dateTop >= spacing.headingBottom + 8, `Evidence date must clear the workspace description: ${JSON.stringify(spacing)}`);
          }
          if ([1440,390,320].includes(width)) {
            const name = `${route.slice(1)}-${theme}-${width}.png`; await page.screenshot({ path: path.join(output, name) }); screenshots.push(name);
          }
        });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await check('Command movement opens exact scoped Investigation, excluding private identity', async () => {
    await page.goto(origin + '/command' + scope + '&vendor=Synthetic%20vendor&source=synthetic-source&selectedLeadId=PRIVATE');
    await page.getByRole('heading', { name: 'Command', exact: true, level: 1 }).waitFor();
    await page.evaluate(async () => {
      const data = window.__fixture.payloads['/api/analytics/offernet/overview'];
      data.comparison = { fetchedDelta: 20, deliveryRateDelta: null, dialRateDelta: null, contactRateDelta: -2.4, saleRateDelta: null, activationRateDelta: null };
      data.comparisonWindow = { startDate: '2026-09-27', endDate: '2026-09-27' };
      const rootCause = window.__fixture.payloads['/api/analytics/offernet/root-cause'];
      rootCause.metric = {id:'contactRate',label:'Right-party contact',kind:'rate',currentValue:18.6,previousValue:21,delta:-2.4,deltaUnit:'pp'};
      rootCause.dimensions = [{key:'vendor',label:'Vendor',reconciliationStatus:'NOT_VERIFIED',segments:[{name:'Synthetic vendor',currentValue:18.6,previousValue:21,currentNumerator:93,currentDenominator:500,previousNumerator:105,previousDenominator:500,contribution:-2.4,shareOfDelta:100}]}];
      await window.__fixture.refresh();
    });
    await page.getByRole('button', { name: 'Investigate Right-party contact (RPC) movement', exact: true }).click();
    await page.getByRole('navigation', { name: 'Investigation workflow', exact: true }).waitFor();
    const params = new URL(page.url()).searchParams;
    assert.equal(new URL(page.url()).pathname, '/investigate');
    for (const [key,value] of [['clientId','synthetic-a'],['startDate','2026-09-28'],['endDate','2026-09-28'],['vendor','Synthetic vendor'],['source','synthetic-source'],['investigationMetric','contactRate']]) assert.equal(params.get(key), value);
    assert.equal(params.has('selectedLeadId'), false);
    assert.equal(await page.locator('[data-stage]').count(), 6);
    await page.getByText('Matched-period comparison', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => window.__fixture.requests.some(url => url.includes('/root-cause?') && new URL(url,'http://fixture.invalid').searchParams.get('metric') === 'contactRate')));
    await page.screenshot({ path: path.join(output, 'rpc-investigation.png') }); screenshots.push('rpc-investigation.png');
  });
  await check('Canonical release links retain exact selected dates and filters; operational return drops release identity only', async () => {
    await page.goto(origin + '/evidence/releases' + scope + '&release=frozen&vendor=Synthetic%20vendor');
    await page.getByRole('heading', { name: 'Evidence', exact: true, level: 1 }).waitFor();
    const nav = page.locator('#desktop-navigation nav[aria-label="Main navigation"]');
    const target = new URL(await nav.getByRole('link', { name:'Command',exact:true }).getAttribute('href'),origin);
    assert.equal(target.searchParams.get('startDate'),'2026-09-28');
    assert.equal(target.searchParams.get('vendor'),'Synthetic vendor');
    assert.equal(target.searchParams.has('release'),false);
  });
  await check('No page errors or relevant browser console warnings', async () => { assert.deepEqual(errors, []); assert.deepEqual(consoleMessages, []); });
} catch (error) { failure = error; await page.screenshot({ path: path.join(output, 'failure.png') }); }
finally {
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ synthetic:true, origin, browser:await browser.version(), checks, screenshots, errors, consoleMessages, failure:failure?.message }, null, 2));
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
if (failure) throw failure;
console.log(`Product QA passed: ${checks.length} checks. Evidence: ${output}`);
