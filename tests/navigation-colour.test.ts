import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUSINESS_AREAS, ROUTE_MANIFEST, getAreaForPath } from '../src/app/routeManifest';

const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const globals = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8');
const light = tokens.match(/:root\s*\{([^}]+)\}/)![1];
const dark = tokens.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)![1];
const expected = { overview: '#315BCB', journey: '#4F46E5', contact: '#0F766E', sales: '#0369A1', commercial: '#7C3AED', investigate: '#475569' };

function value(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}:\\s*([^;]+);`));
  assert.ok(match, `Missing ${name}`);
  return match[1].trim();
}

function rgb(hex: string): number[] {
  assert.match(hex, /^#[\da-f]{6}$/i);
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

function contrast(foreground: number[], background: number[]): number {
  const luminance = (channels: number[]) => channels.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

test('every business area has one canonical navigation identity and all aliases retain that identity', () => {
  for (const area of BUSINESS_AREAS) {
    const token = area.id === 'settings' ? 'admin' : area.id;
    const mapping = globals.match(new RegExp(`\\[data-navigation-area="${area.id}"\\]\\s*\\{([^}]+)\\}`));
    assert.ok(mapping, `Missing navigation mapping for ${area.name}`);
    assert.match(mapping[1], new RegExp(`--cx-nav-accent:\\s*var\\(--cx-area-${token}\\)`));
    assert.match(mapping[1], new RegExp(`--cx-nav-soft:\\s*var\\(--cx-area-${token}-soft\\)`));
  }
  for (const route of ROUTE_MANIFEST) {
    for (const path of [route.path, ...(route.urlAliases || [])]) {
      assert.equal(getAreaForPath(path).id, route.area, path);
      assert.equal(getAreaForPath(`${path}?clientId=synthetic`).id, route.area, `${path} with scope`);
    }
  }
  for (const [area, hex] of Object.entries(expected)) assert.equal(value(light, `--cx-area-${area}`), hex);
  for (const block of [light, dark]) {
    assert.equal(value(block, '--cx-area-admin'), 'var(--cx-text-secondary)');
    assert.equal(value(block, '--cx-area-admin-soft'), 'var(--cx-surface-subtle)');
  }
});

for (const [theme, block] of [['light', light], ['dark', dark]]) {
  test(`${theme} area text and icons exceed WCAG AA contrast on navigation surfaces and selected backgrounds`, () => {
    for (const area of [...Object.keys(expected), 'admin']) {
      const ink = rgb(value(block, area === 'admin' ? '--cx-text-secondary' : `--cx-area-${area}`));
      for (const surface of ['--cx-surface', '--cx-surface-subtle', '--cx-surface-elevated']) {
        const ratio = contrast(ink, rgb(value(block, surface)));
        assert.ok(ratio >= 4.5, `${theme} ${area} on ${surface}: ${ratio.toFixed(2)}:1`);
      }
      const soft = value(block, `--cx-area-${area}-soft`);
      const percent = soft.match(/color-mix\(in srgb, var\(--cx-area-\w+\) (\d+)%, var\(--cx-surface\)\)/)?.[1];
      const surface = rgb(value(block, area === 'admin' ? '--cx-surface-subtle' : '--cx-surface'));
      if (area !== 'admin') assert.ok(percent, 'Selected background should derive from its area token');
      const weight = Number(percent || 0) / 100;
      const background = surface.map((channel, i) => channel * (1 - weight) + ink[i] * weight);
      const ratio = contrast(ink, background);
      assert.ok(ratio >= 4.5, `${theme} ${area} on selected background: ${ratio.toFixed(2)}:1`);
    }
  });
}
