import React from 'react';
import { analyticalParameterJson, analyticalParameterText, type AnalyticalParameter, type AnalyticalRow } from './analyticalParameters';

export default function AnalyticalParameterValue({ row, field }: { row: AnalyticalRow; field: AnalyticalParameter }) {
  const value = row[field.key];
  const structured = value !== null && typeof value === 'object';
  const detail = field.kind === 'reason' && structured && !Array.isArray(value) && typeof (value as Record<string, unknown>).detail === 'string' ? String((value as Record<string, unknown>).detail) : null;
  return <div className="cx-analytical-parameter-value"><span>{analyticalParameterText(row, field)}</span>{detail && <small>{detail}</small>}{structured && <details className="cx-analytical-parameter-json"><summary>Returned details</summary>{!Array.isArray(value) && <dl>{Object.entries(value).map(([key, entry]) => <div key={key}><dt>{key}</dt><dd>{entry == null ? 'Unavailable' : typeof entry === 'object' ? Array.isArray(entry) ? `${entry.length} returned items` : `${Object.keys(entry).length} returned fields` : String(entry)}</dd></div>)}</dl>}<details><summary>Raw returned JSON</summary><pre>{analyticalParameterJson(value)}</pre></details></details>}</div>;
}
