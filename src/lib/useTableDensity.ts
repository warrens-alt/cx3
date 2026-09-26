import { useSyncExternalStore } from 'react';
import { DENSITY_KEY, safeDensity, type TableDensity } from './presentation';

function storedDensity(fallback: TableDensity = 'comfortable'): TableDensity {
  try { return safeDensity(window.localStorage.getItem(DENSITY_KEY)); }
  catch { return fallback; }
}

let density = storedDensity();
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };
const snapshot = () => density;
const serverSnapshot = (): TableDensity => 'comfortable';

function receiveStorage(event: StorageEvent) {
  if (event.key !== DENSITY_KEY && event.key !== null) return;
  const next = safeDensity(event.newValue);
  if (next !== density) { density = next; notify(); }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const stored = storedDensity(density);
    if (stored !== density) { density = stored; notify(); }
    window.addEventListener('storage', receiveStorage);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage', receiveStorage);
  };
}

function setDensity(value: TableDensity) {
  const next = safeDensity(value);
  if (next === density) return;
  density = next;
  try { window.localStorage.setItem(DENSITY_KEY, next); } catch { /* Keep the shared in-memory preference usable. */ }
  notify();
}

function toggleDensity() { setDensity(density === 'comfortable' ? 'compact' : 'comfortable'); }

/** One preference for the toolbar and Settings, including same-tab and cross-tab updates. */
export function useTableDensity() {
  return { density: useSyncExternalStore(subscribe, snapshot, serverSnapshot), setDensity, toggleDensity };
}
