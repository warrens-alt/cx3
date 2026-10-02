import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heatmapColors } from '../src/lib/heatmapColors';

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
function resolveColors(colors: ReturnType<typeof heatmapColors>, theme: 'light' | 'dark') {
  const root = tokens.match(/:root\s*\{([^}]+)\}/)![1];
  const dark = tokens.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)![1];
  const declarations = new Map([...`${root}\n${theme === 'dark' ? dark : ''}`.matchAll(/(--cx-[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(match => [match[1], match[2]]));
  const resolve = (value: string) => {
    const token = value.match(/^var\((--cx-[\w-]+)\)$/)?.[1];
    assert.ok(token, `Heatmap paint should follow a theme token: ${value}`);
    const color = declarations.get(token);
    assert.ok(color, `Missing ${theme} palette entry ${token}`);
    return color;
  };
  return { backgroundColor: resolve(colors.backgroundColor), color: resolve(colors.color) };
}

function contrast(colors: ReturnType<typeof heatmapColors>) {
  const [light, dark] = [luminance(colors.backgroundColor), luminance(colors.color)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} heatmap intensities retain small-text contrast and ordered strength`, () => {
    let previousBackgroundLuminance = theme === 'light' ? Infinity : 0;
    for (let value = 0; value <= 1000; value++) {
      const colors = resolveColors(heatmapColors(value, 1000), theme);
      assert.ok(contrast(colors) >= 4.5, `${theme} value ${value} has insufficient contrast`);
      const currentLuminance = luminance(colors.backgroundColor);
      assert.ok(theme === 'light' ? currentLuminance <= previousBackgroundLuminance : currentLuminance >= previousBackgroundLuminance,
        'Higher values must retain a consistent progression through the theme palette');
      previousBackgroundLuminance = currentLuminance;
    }
  });
}

test('missing values and recorded zero remain distinct and readable', () => {
  assert.notDeepEqual(heatmapColors(null, 100), heatmapColors(0, 100));
  for (const value of [null, undefined, Number.NaN, Infinity]) {
    assert.deepEqual(heatmapColors(value, 100), heatmapColors(null, 100));
    for (const theme of ['light', 'dark'] as const) assert.ok(contrast(resolveColors(heatmapColors(value, 100), theme)) >= 4.5);
  }
});

test('out-of-range values and invalid scales still produce bounded accessible colors', () => {
  assert.deepEqual(heatmapColors(200, 100), heatmapColors(100, 100));
  for (const maximum of [0, -1, Number.NaN, Infinity]) {
    assert.deepEqual(heatmapColors(1, maximum), heatmapColors(1, 1));
    for (const theme of ['light', 'dark'] as const) assert.ok(contrast(resolveColors(heatmapColors(1, maximum), theme)) >= 4.5);
  }
});
