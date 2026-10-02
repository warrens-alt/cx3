import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? files(file) : [file];
});
const styles = ['src/index.css', ...files('src/styles').filter(file => file.endsWith('.css'))];
const canonical = ['.cx-page-shell', '.cx-command-page', '.cx-command-content', '.cx-page-header', '.cx-metric-card', '.cx-report-panel', '.enterprise-card', '.enterprise-table', '.cx-scope-controls'];

test('canonical reporting primitives have exactly one stylesheet owner', () => {
  const owners = new Map(canonical.map(selector => [selector, new Set<string>()]));
  for (const file of styles) {
    postcss.parse(readFileSync(file, 'utf8')).walkRules(rule => {
      for (const selector of rule.selectors) owners.get(selector)?.add(file);
    });
  }
  for (const [selector, paths] of owners) assert.deepEqual([...paths], ['src/styles/reporting.css'], selector);
});

test('retired stylesheet generations cannot return through source or fixture imports', () => {
  const retired = ['navigation', 'theme', 'charts', 'operations', 'reportBrowsing', 'analyticsVisuals', 'visualRefinement', 'scopeControls'];
  const sources = [...files('src'), ...files('scripts'), ...files('tests/frontend')].filter(file => /\.(css|tsx?|m?js)$/.test(file));
  for (const name of retired) {
    assert.equal(existsSync(`src/styles/${name}.css`), false, name);
    for (const file of sources) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), new RegExp(`(?:import\\s*(?:[^;]*?from\\s*)?|@import\\s*)['\"][^'\"]*(?:styles/|\\./)${name}\\.css['\"]`), `${file} imports ${name}`);
    }
  }
});

test('explicit theme selection drives Tailwind dark utilities independently of OS preference', () => {
  const css = readFileSync('src/index.css', 'utf8');
  assert.match(css, /@custom-variant dark.*data-theme="dark"/);
});

test('shared application foundations resolve paint through the ConversionX palette', () => {
  for (const file of ['src/index.css', 'src/styles/globals.css', 'src/styles/product.css', 'src/styles/reporting.css', 'src/styles/shell.css', 'src/shared/evidence/auditEvidence.css']) {
    postcss.parse(readFileSync(file, 'utf8')).walkDecls(declaration => {
      // Palette declarations are the source of colour; consumers must use them.
      if (declaration.prop.startsWith('--')) return;
      assert.doesNotMatch(declaration.value, /#[0-9a-f]{3,8}\b|\brgba?\(|\b(?:white|black)\b/i,
        `${file}:${declaration.source?.start?.line} ${declaration.prop} bypasses the theme palette`);
    });
  }
});
