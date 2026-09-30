import React, { useSyncExternalStore } from 'react';
import { AUTHORITATIVE_METRICS } from '../../../contracts/metricRegistry';
const KEY = 'cx.presentation.audit-mode.v1';
const read = () => { try { return window.localStorage.getItem(KEY) === 'on'; } catch { return false; } };
let enabled = read();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const receive = (event: StorageEvent) => { if (event.key === KEY || event.key === null) { enabled = read(); notify(); } };
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) { enabled = read(); window.addEventListener('storage', receive); }
  return () => { listeners.delete(listener); if (!listeners.size) window.removeEventListener('storage', receive); };
};
export function useAuditMode() {
  return { enabled: useSyncExternalStore(subscribe, () => enabled, () => false), setEnabled(value: boolean) {
    enabled = value;
    try { window.localStorage.setItem(KEY, value ? 'on' : 'off'); } catch { /* Local preference remains usable in memory. */ }
    notify();
  } };
}
export function AuditModeControl() {
  const { enabled, setEnabled } = useAuditMode();
  return <div className="cx-audit-preference"><strong>Audit mode</strong><p>Show available metric metadata. Access permissions stay the same.</p><div role="group" aria-label="Audit mode">
    <button type="button" className="cx-button-secondary" aria-pressed={!enabled} onClick={() => setEnabled(false)}>Off</button>
    <button type="button" className="cx-button-secondary" aria-pressed={enabled} onClick={() => setEnabled(true)}>On</button>
  </div></div>;
}
export function AuditMetadata({ metricId, grain, dateBasis, validationStatus }: { metricId?: string; grain?: string; dateBasis?: string; validationStatus?: string }) {
  const { enabled } = useAuditMode();
  const definition = metricId ? AUTHORITATIVE_METRICS[metricId] : undefined;
  const parts = [metricId, grain || definition?.countingGrain, dateBasis || definition?.dateBasis, validationStatus || definition?.reconciliationStatus].filter(Boolean);
  return enabled && parts.length ? <div className="cx-audit-metadata" aria-label="Audit metadata">{parts.map((part, index) => <span key={index}>{part}</span>)}</div> : null;
}
