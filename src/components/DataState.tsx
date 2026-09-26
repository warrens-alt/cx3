import React from 'react';
export function DataState({ loading, error, empty, retry }: { loading?: boolean; error?: string | null; empty?: boolean; retry?: () => void }) {
  if (loading) return <div role="status" className="enterprise-card p-6">Loading data…</div>;
  if (error) return <div role="alert" className="enterprise-card p-6 space-y-3"><h2 className="font-semibold">Data could not be loaded</h2><p>{error}</p>{retry && <button type="button" className="underline" onClick={retry}>Retry request</button>}</div>;
  if (empty) return <div role="status" className="enterprise-card p-6">No matching records were returned for this selection.</div>;
  return null;
}
export function EvidenceNotice({ children }: { children?: React.ReactNode }) {
  return <div role="note" className="enterprise-card p-4 text-sm"><strong>Validation not completed.</strong> {children || 'These are modelled warehouse results, not independently reconciled financial or operational records.'}</div>;
}
export const displayNumber = (value: unknown, digits = 0): string => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? 'Unavailable' : Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
