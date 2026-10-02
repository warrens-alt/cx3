import { createHash } from 'node:crypto';
import { METRICS, METRIC_VERSION, MODEL_VERSION } from '../../contracts/reporting';

/** Stable JSON for bounded, validated public contracts. Array order is significant. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const fingerprint = (value: unknown): string => createHash('sha256').update(canonicalJson(value)).digest('hex');
export const REPORT_DEFINITION_HASH = fingerprint({ metricVersion: METRIC_VERSION, modelVersion: MODEL_VERSION, metrics: METRICS });
