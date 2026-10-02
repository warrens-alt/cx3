import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';

const read = (file: string) => fs.readFileSync(file, 'utf8');
const shell = postcss.parse(read('src/styles/shell.css'));

function declaration(selector: string, property: string) {
  const rule = shell.nodes.find(node => node.type === 'rule' && node.selector === selector) as postcss.Rule;
  assert.ok(rule, `Missing ${selector}`);
  return rule.nodes.find(node => node.type === 'decl' && node.prop === property) as postcss.Declaration;
}

test('shell.css owns canonical navigation selectors across both source and imported stylesheet layers', () => {
  assert.match(read('src/app/layouts/AppShell.tsx'), /import '\.\.\/\.\.\/styles\/shell\.css'/);
  const canonical = new Set(['.cx-app', '.cx-workarea', '.cx-main', '.cx-sidebar', '.cx-desktop-sidebar', '.cx-topbar', '.cx-breadcrumb', '.cx-nav-link', '.cx-area-nav', '.cx-area-nav-item', '.cx-mobile-bottom-nav', '.cx-command-modal']);
  const files = ['src/index.css', ...fs.readdirSync('src/styles').filter(name => name.endsWith('.css') && name !== 'shell.css').map(name => `src/styles/${name}`)];
  for (const file of files) {
    postcss.parse(read(file)).walkRules(rule => {
      for (const selector of postcss.list.comma(rule.selector)) assert.ok(!canonical.has(selector.trim()), `${selector} still has competing ownership in ${file}`);
    });
  }
});

test('desktop rail retains useful width and shell styles use local tokens and reduced motion', () => {
  assert.equal(declaration('.cx-desktop-sidebar', 'width').value, '248px');
  assert.equal(declaration('.cx-desktop-sidebar[data-collapsed="true"]', 'width').value, '60px');
  const css = read('src/styles/shell.css');
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i, 'Theme-specific shell colours belong to design tokens');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.cx-nav-link\[aria-current\]/);
  assert.equal(fs.existsSync('src/components/Sidebar.tsx'), false);
  assert.equal(fs.existsSync('src/components/SectionNavigation.tsx'), false);
});
