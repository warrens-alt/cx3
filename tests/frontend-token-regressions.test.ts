import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compile } from 'tailwindcss';

const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

// These are token/utility compiler regressions, not a claim of whole-app visual
// or accessibility verification. Browser interaction and cascade checks are separate.
for (const [legacy, canonical] of [
  ['--cx-radius-card', '--cx-radius-lg'],
  ['--cx-radius-control', '--cx-radius-sm'],
  ['--cx-shadow-elevated', '--cx-shadow-md'],
] as const) {
  test(`existing presentation consumer ${legacy} resolves through the canonical scale`, () => {
    const root = tokens.match(/:root\s*\{([^}]+)\}/)?.[1];
    assert.ok(root, 'A canonical root token block is required');
    assert.match(root, new RegExp(`${legacy}:\\s*var\\(${canonical}\\)\\s*;`));
    assert.match(root, new RegExp(`${canonical}:\\s*[^;]+;`));
  });
}

test('analytical surfaces stay flat in both themes while elevated overlays retain a shadow scale', () => {
  assert.equal([...tokens.matchAll(/--cx-shadow-card:\s*none\s*;/g)].length, 2);
  assert.match(tokens, /--cx-shadow-elevated:\s*var\(--cx-shadow-md\)/);
});

test('Tailwind emits the brand utilities already used by active report controls', async () => {
  const compiler = await compile(`${tokens}\n@tailwind utilities;`);
  const css = compiler.build(['text-brand-primary', 'border-brand-primary', 'hover:border-brand-primary/40']);
  assert.ok(css.includes('.text-brand-primary'), 'Brand text utility must not be silently omitted');
  assert.ok(css.includes('.border-brand-primary'), 'Brand border utility must not be silently omitted');
  assert.ok(css.includes('.hover\\:border-brand-primary\\/40'), 'Opacity/hover variants must compile');
  assert.match(css, /color:\s*var\(--cx-brand-primary\)/);
});

test('Tailwind emits a theme-aware subtle-surface utility for existing report regions', async () => {
  const compiler = await compile(`${tokens}\n@tailwind utilities;`);
  const css = compiler.build(['bg-surface-subtle', 'hover:bg-surface-subtle']);
  assert.ok(css.includes('.bg-surface-subtle'));
  assert.ok(css.includes('.hover\\:bg-surface-subtle'));
  assert.match(css, /background-color:\s*var\(--cx-surface-subtle\)/);
});

test('selection and action-soft utilities share the current theme selection surface', async () => {
  const compiler = await compile(`${tokens}\n@tailwind utilities;`);
  const css = compiler.build(['bg-selected-bg', 'hover:bg-selected-bg', 'bg-action-soft/50']);
  assert.ok(css.includes('.bg-selected-bg'));
  assert.ok(css.includes('.hover\\:bg-selected-bg'));
  assert.ok(css.includes('.bg-action-soft\\/50'));
  assert.match(css, /background-color:\s*var\(--cx-selected-bg\)/);
  assert.match(css, /color-mix\(in oklab, var\(--cx-selected-bg\) 50%, transparent\)/);
});

function hexValue(block: string, name: string): string {
  const value = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1];
  assert.ok(value, `Missing explicit palette entry ${name}`);
  return value;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  return channelLuminance(channels);
}

function channelLuminance(channels: number[]): number {
  const linear = channels.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} status text retains 4.5:1 contrast on its tinted reporting surfaces`, () => {
    const block = theme === 'light'
      ? tokens.match(/:root\s*\{([^}]+)\}/)?.[1]
      : tokens.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1];
    assert.ok(block);
    for (const role of ['positive', 'negative', 'warning']) {
      const foreground = luminance(hexValue(block, `--cx-${role}`));
      const tint = block.match(new RegExp(`--cx-${role}-bg:\\s*([^;]+);`))?.[1];
      assert.ok(tint);
      for (const surface of ['--cx-canvas', '--cx-surface', '--cx-surface-subtle', '--cx-surface-elevated']) {
        let background: number;
        if (tint.startsWith('#')) background = luminance(tint);
        else {
          const [r, g, b, alpha] = tint.match(/[\d.]+/g)!.map(Number);
          const base = hexValue(block, surface);
          const blended = [r, g, b].map((channel, index) => (channel * alpha + Number.parseInt(base.slice(1 + index * 2, 3 + index * 2), 16) * (1 - alpha)) / 255);
          background = channelLuminance(blended);
        }
        const ratio = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        assert.ok(ratio >= 4.5, `${theme} ${role} on ${surface}: ${ratio.toFixed(3)}:1`);
      }
    }
  });

  test(`${theme} categorical strokes retain at least 3:1 contrast against their chart surfaces`, () => {
    const block = theme === 'light'
      ? tokens.match(/:root\s*\{([^}]+)\}/)?.[1]
      : tokens.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1];
    assert.ok(block);
    const names = [
      ...['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activation'].map(name => `--cx-data-${name}`),
      ...Array.from({ length: 8 }, (_, index) => `--cx-visual-category-${index + 1}`),
    ];
    for (const surface of ['--cx-surface', '--cx-surface-subtle', '--cx-surface-elevated']) {
      const background = luminance(hexValue(block, surface));
      for (const name of names) {
        const foreground = luminance(hexValue(block, name));
        const ratio = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        assert.ok(ratio >= 3, `${theme} ${name} on ${surface}: ${ratio.toFixed(3)}:1`);
      }
    }
  });
}
