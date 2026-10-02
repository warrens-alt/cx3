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
  return <div className="cx-audit-preference"><strong>Audit mode</strong><p>Show metric grain, date basis and evidence states alongside the report. Open Audit evidence for the visual trace and calculation.</p><div role="group" aria-label="Audit mode">
    <button type="button" className="cx-button-secondary" aria-pressed={!enabled} onClick={() => setEnabled(false)}>Off</button>
    <button type="button" className="cx-button-secondary" aria-pressed={enabled} onClick={() => setEnabled(true)}>On</button>
  </div></div>;
}
export function AuditMetadata({ metricId, grain, dateBasis, validationStatus, definitionVersion, generatedAt, source }: { metricId?: string; grain?: string; dateBasis?: string; validationStatus?: string; definitionVersion?: string; generatedAt?: string; source?: string }) {
  const { enabled } = useAuditMode();
  const definition = metricId ? AUTHORITATIVE_METRICS[metricId] : undefined;
  const parts = [
    { label: 'Metric ID', value: metricId, technical: true },
    { label: 'Grain', value: grain || definition?.countingGrain },
    { label: 'Date basis', value: dateBasis || definition?.dateBasis },
    { label: 'Validation', value: metricId || validationStatus ? validationStatus || 'NOT_VERIFIED' : undefined, technical: true },
    { label: 'Definition', value: definitionVersion, technical: true },
    { label: 'Response generated', value: generatedAt, technical: true },
    { label: 'Source', value: source, technical: true },
  ].filter(part => part.value);
  return enabled && parts.length ? <dl className="cx-audit-metadata" aria-label="Audit metadata">{parts.map(part => <div key={part.label}><dt>{part.label}</dt><dd className={part.technical ? 'cx-tech-label' : undefined}>{part.value}</dd></div>)}{generatedAt && <small>Response timing does not establish source freshness.</small>}</dl> : null;
}
