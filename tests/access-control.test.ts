import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';

// Render the real access page with explicit test-only identity and subscription adapters.
// Child components must continue to use the page's one subscription/mutation owner.
const compiled = await build({
  stdin: {
    contents: `import React from 'react';
      import {createRoot} from 'react-dom/client';
      import UserManagement from './src/pages/UserManagement';
      import {MemoryRouter} from 'react-router-dom';
      const root=createRoot(document.getElementById('root'));
      window.access.render=()=>root.render(<MemoryRouter initialEntries={['/admin']}><UserManagement/></MemoryRouter>);
      window.access.unmount=()=>root.unmount();
      window.access.render();`,
    loader: 'tsx', resolveDir: process.cwd(),
  },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  plugins: [{ name: 'isolated-access-adapters', setup(build) {
    build.onResolve({ filter: /(?:\/AuthContext|\/firebase|^firebase\/firestore)$/ }, args => ({ path: args.path, namespace: 'access-test' }));
    build.onLoad({ filter: /.*/, namespace: 'access-test' }, args => {
      if (args.path.endsWith('/AuthContext')) return { contents: 'export function useAuth(){return window.access.auth;}' };
      if (args.path === 'firebase/firestore') return { contents: `
        export const collection=(_db,name)=>name;
        export const query=(name,...rest)=>name;
        export const orderBy=()=>{};
        export const limit=()=>{};
        export function onSnapshot(name,loaded,failed){
          const subscription={name,loaded,failed,closed:false};
          window.access.subscriptions.push(subscription);
          return ()=>{subscription.closed=true;};
        }` };
      return { contents: 'export const db={};' };
    });
  } }],
});
const script = compiled.outputFiles[0].text;
const methodNames = ['updateUserRole', 'updateUserStatus', 'updateUserTenants', 'deleteUserAccount', 'createInvite', 'deleteInvite', 'updatePlatformConfig'];
const account = (uid: string, overrides = {}) => ({ uid, email: `${uid}@example.test`, displayName: uid, role: 'viewer', status: 'active', allowedTenants: ['mtn'], ...overrides });

async function mount(isAdmin = true) {
  const errors: string[] = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://access-test.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console });
  const w = dom.window as any;
  const calls: { method: string; args: any[] }[] = [];
  w.confirm = () => true;
  w.access = { subscriptions: [], auth: { isAdmin, user: { uid: 'self' } } };
  for (const method of methodNames) w.access.auth[method] = async (...args: any[]) => {
    calls.push({ method, args });
    if (w.access.reject === method) throw new Error('Synthetic mutation denied');
  };
  w.eval(script);
  const text = () => w.document.body.textContent || '';
  const all = (selector: string) => [...w.document.querySelectorAll(selector)] as any[];
  const find = (selector: string, label?: string) => all(selector).find(el => label === undefined || (el.getAttribute('aria-label') || el.textContent || '').includes(label));
  const wait = async (check: () => unknown) => {
    for (let i = 0; i < 100; i++) {
      if (check()) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail(`Expected access control UI. ${text()} ${errors.join('\n')}`);
  };
  const settle = () => new Promise(resolve => setTimeout(resolve, 20));
  const click = async (label: string) => { const el = find('button', label); assert.ok(el, label); el.click(); await settle(); };
  const change = async (el: any, value: string) => {
    assert.ok(el);
    const prototype = el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    await settle();
  };
  const emit = async (name: string, rows: any[] | Error) => {
    const sub = w.access.subscriptions.find((s: any) => s.name === name && !s.closed);
    assert.ok(sub, `Subscription for ${name}`);
    if (rows instanceof Error) sub.failed(rows);
    else sub.loaded({ forEach: (fn: any) => rows.forEach(row => fn({ data: () => row })) });
    await settle();
  };
  await wait(() => isAdmin ? w.access.subscriptions.length === 3 : text().includes('Administrator Access Required'));
  return { w, calls, text, find, all, wait, click, change, emit, settle, close() { w.access.unmount(); dom.window.close(); } };
}

test('unauthorized access page cannot subscribe to the directory, invites or audit', async () => {
  const app = await mount(false);
  try {
    assert.equal(app.w.access.subscriptions.length, 0);
    assert.match(app.text(), /Administrator Access Required/);
    assert.equal(app.find('button'), undefined);
    assert.equal(app.calls.length, 0);
  } finally { app.close(); }
});

test('controlled access tabs share exactly one subscription per collection and unsubscribe when authority is removed', async () => {
  const app = await mount();
  try {
    assert.deepEqual(app.w.access.subscriptions.map((s: any) => s.name), ['users', 'accessInvites', 'auditLogs']);
    await app.emit('users', []);
    await app.emit('accessInvites', []);
    await app.emit('auditLogs', []);
    await app.click('Pre-Authorized Invites');
    assert.match(app.text(), /No pre-authorized invites configured/);
    assert.match(app.text(), /Accounts still require administrator approval/);
    await app.click('Audit Log');
    assert.match(app.text(), /No audit events recorded/);
    await app.click('Access Policies');
    assert.match(app.text(), /Draft policy values/);
    await app.click('User Directory');
    assert.equal(app.w.access.subscriptions.length, 3);
    app.w.access.auth.isAdmin = false;
    app.w.access.render();
    await app.wait(() => app.text().includes('Administrator Access Required'));
    // Subscription cleanup runs in the passive effect after the denied UI commits.
    await app.wait(() => app.w.access.subscriptions.every((s: any) => s.closed));
    assert.ok(app.w.access.subscriptions.every((s: any) => s.closed));
    assert.equal(app.calls.length, 0);
  } finally { app.close(); }
});

test('directory filters remain local and user actions preserve the central mutation contracts', async () => {
  const app = await mount();
  try {
    await app.emit('users', [account('self', { role: 'admin' }), account('pending', { status: 'pending' }), account('active'), account('missing', { allowedTenants: undefined })]);
    assert.equal(app.find('select', 'Role for self@example.test').disabled, true);
    assert.match(app.text(), /Not reported/);
    await app.change(app.find('input', 'Search loaded user directory'), 'pending');
    assert.equal(app.all('tbody tr').length, 1);
    await app.click('Approve');
    assert.deepEqual(app.calls.at(-1), { method: 'updateUserStatus', args: ['pending', 'active'] });
    await app.change(app.find('input', 'Search loaded user directory'), 'active');
    await app.change(app.find('select', 'Role for active@example.test'), 'analyst');
    assert.deepEqual(app.calls.at(-1), { method: 'updateUserRole', args: ['active', 'analyst'] });
    await app.click('Suspend');
    assert.deepEqual(app.calls.at(-1), { method: 'updateUserStatus', args: ['active', 'suspended'] });
    await app.click('Edit');
    assert.match(app.text(), /Manage Workspace Scopes/);
    await app.click('Update Client Access');
    assert.deepEqual(JSON.parse(JSON.stringify(app.calls.at(-1))), { method: 'updateUserTenants', args: ['active', ['mtn']] });
    assert.equal(app.w.access.subscriptions.length, 3, 'Local filtering and editors must not subscribe again');
  } finally { app.close(); }
});

test('subscription failures remain unavailable rather than empty or invented data after switching panels', async () => {
  const app = await mount();
  try {
    for (const collection of ['users', 'accessInvites', 'auditLogs']) await app.emit(collection, new Error('Synthetic subscription failure'));
    assert.match(app.text(), /User directory unavailable/);
    assert.doesNotMatch(app.text(), /No users match/);
    await app.click('Pre-Authorized Invites');
    assert.match(app.find('[role="alert"]').textContent, /Invitations unavailable/);
    assert.doesNotMatch(app.text(), /No pre-authorized invites configured/);
    await app.click('Audit Log');
    assert.match(app.find('[role="alert"]').textContent, /Audit log unavailable/);
    assert.doesNotMatch(app.text(), /No audit events recorded/);
  } finally { app.close(); }
});

test('invite editors and revocation call central authority methods and keep failed saves open', async () => {
  const app = await mount();
  try {
    await app.emit('accessInvites', [{ id: 'invite-a', email: 'invited@example.test', role: 'viewer', allowedTenants: ['mtn'], invitedBy: 'self@example.test' }]);
    await app.click('Pre-Authorized Invites');
    await app.click('Revoke');
    assert.deepEqual(app.calls.at(-1), { method: 'deleteInvite', args: ['invite-a'] });
    await app.click('Add Email');
    await app.change(app.find('input[type="email"]'), 'NEW@EXAMPLE.TEST');
    await app.change(app.find('select', 'Pre-assigned role'), 'viewer');
    app.w.access.reject = 'createInvite';
    app.find('form').dispatchEvent(new app.w.Event('submit', { bubbles: true, cancelable: true }));
    await app.wait(() => app.text().includes('Synthetic mutation denied'));
    assert.ok(app.find('input[type="email"]'), 'The failed editor remains open for correction/retry');
    app.w.access.reject = undefined;
    app.find('form').dispatchEvent(new app.w.Event('submit', { bubbles: true, cancelable: true }));
    await app.wait(() => !app.find('input[type="email"]'));
    assert.deepEqual(JSON.parse(JSON.stringify(app.calls.at(-1))), { method: 'createInvite', args: ['new@example.test', 'viewer', ['*']] });
    assert.match(app.text(), /Pre-authorized access invitation saved/);
  } finally { app.close(); }
});

test('policy form preserves draft warning and sends its normalized settings through the page owner', async () => {
  const app = await mount();
  try {
    await app.click('Access Policies');
    assert.match(app.text(), /current saved policy is not loaded here/);
    await app.change(app.find('select', 'Default role'), 'analyst');
    await app.change(app.find('input[type="text"]'), ' EXAMPLE.TEST, partner.test ');
    app.find('form').dispatchEvent(new app.w.Event('submit', { bubbles: true, cancelable: true }));
    await app.wait(() => app.text().includes('Policies updated successfully'));
    assert.deepEqual(JSON.parse(JSON.stringify(app.calls.at(-1))), { method: 'updatePlatformConfig', args: [{ requireApproval: true, defaultRole: 'analyst', allowedDomains: ['example.test', 'partner.test'] }] });
  } finally { app.close(); }
});
