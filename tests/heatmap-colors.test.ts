import test from 'node:test';
import assert from 'node:assert/strict';
import { heatmapColors } from '../src/lib/heatmapColors';

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(colors: ReturnType<typeof heatmapColors>) {
  const [light, dark] = [luminance(colors.backgroundColor), luminance(colors.color)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

test('all relative intensities retain small-text contrast, including the maximum cell', () => {
  let previousBackgroundLuminance = Infinity;
  for (let value = 0; value <= 1000; value++) {
    const colors = heatmapColors(value, 1000);
    assert.ok(contrast(colors) >= 4.5, `value ${value} has insufficient contrast`);
    const currentLuminance = luminance(colors.backgroundColor);
    assert.ok(currentLuminance <= previousBackgroundLuminance, 'higher values must not use a lighter fill');
    previousBackgroundLuminance = currentLuminance;
  }
  assert.equal(heatmapColors(1000, 1000).color, '#FFFFFF');
});

test('missing values and recorded zero remain distinct and readable', () => {
  assert.notDeepEqual(heatmapColors(null, 100), heatmapColors(0, 100));
  for (const value of [null, undefined, Number.NaN, Infinity]) {
    assert.deepEqual(heatmapColors(value, 100), heatmapColors(null, 100));
    assert.ok(contrast(heatmapColors(value, 100)) >= 4.5);
  }
});

test('out-of-range values and invalid scales still produce bounded accessible colors', () => {
  assert.deepEqual(heatmapColors(200, 100), heatmapColors(100, 100));
  for (const maximum of [0, -1, Number.NaN, Infinity]) {
    assert.deepEqual(heatmapColors(1, maximum), heatmapColors(1, 1));
    assert.ok(contrast(heatmapColors(1, maximum)) >= 4.5);
  }
});
