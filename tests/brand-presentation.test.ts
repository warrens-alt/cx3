import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';

// Execute the actual component with only its CSS import omitted in the Node renderer.
const compiled = await build({
  entryPoints: ['src/components/ConversionXBrand.tsx'], bundle: true, write: false,
  platform: 'node', format: 'cjs', packages: 'external', loader: { '.css': 'empty' },
});
const componentModule = { exports: {} as { default: React.ComponentType<{
  variant?: 'wordmark' | 'symbol' | 'full'; tone?: 'light' | 'dark' | 'auto'; className?: string;
}> } };
runInNewContext(compiled.outputFiles[0].text, { module: componentModule, exports: componentModule.exports, require: createRequire(import.meta.url) });
const Brand = componentModule.exports.default;
const asset = '/brand/conversionx-grey.png';

test('the one public brand bitmap preserves the supplied original pixels and dimensions', () => {
  assert.deepEqual(readdirSync('public/brand').filter(name => name.endsWith('.png')), ['conversionx-grey.png']);
  const png = readFileSync(`public${asset}`);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 2684);
  assert.equal(png.readUInt32BE(20), 624);
  assert.equal(createHash('sha256').update(png).digest('hex'), 'f1fee4b874c3db4541bb48bc09adbb2a3d58f7f01d03c02e8a027e8a011bf645');
});

test('wordmark and symbol retain their supplied geometry and accessible name for every tone', () => {
  for (const [variant, viewBox] of [['wordmark', '84 81 2516 380'], ['symbol', '2085 81 515 380']] as const) {
    for (const tone of ['light', 'dark', 'auto'] as const) {
      const dom = new JSDOM(renderToStaticMarkup(React.createElement(Brand, { variant, tone, className: 'brand-location' })));
      try {
        const svg = dom.window.document.querySelector('svg')!;
        assert.equal(svg.getAttribute('viewBox'), viewBox);
        assert.equal(svg.getAttribute('role'), 'img');
        assert.equal(svg.getAttribute('aria-label'), 'ConversionX');
        assert.equal(svg.getAttribute('focusable'), 'false');
        assert.equal(svg.getAttribute('data-tone'), tone);
        assert.ok(svg.classList.contains(`cx-brand-${variant}`));
        assert.ok(svg.classList.contains('brand-location'));
        assert.equal(svg.querySelectorAll('image').length, 1);
        const bitmap = svg.querySelector('image')!;
        assert.equal(bitmap.getAttribute('href'), asset);
        assert.equal(bitmap.getAttribute('width'), '2684');
        assert.equal(bitmap.getAttribute('height'), '624');
      } finally { dom.window.close(); }
    }
  }
});

test('the full variant preserves the complete image, tagline and intrinsic proportions', () => {
  for (const tone of ['light', 'dark', 'auto'] as const) {
    const dom = new JSDOM(renderToStaticMarkup(React.createElement(Brand, { variant: 'full', tone })));
    try {
      const bitmap = dom.window.document.querySelector('img')!;
      assert.equal(bitmap.getAttribute('src'), asset);
      assert.equal(bitmap.getAttribute('width'), '2684');
      assert.equal(bitmap.getAttribute('height'), '624');
      assert.equal(bitmap.getAttribute('data-tone'), tone);
      assert.equal(bitmap.getAttribute('alt'), 'ConversionX — Every signal captured. Every conversion owned.');
      assert.equal(dom.window.document.querySelector('svg'), null);
    } finally { dom.window.close(); }
  }
});
