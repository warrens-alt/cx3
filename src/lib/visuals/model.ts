export type VisualKind = 'column' | 'bar' | 'line' | 'area' | 'donut' | 'scatter' | 'heatmap';

export interface Measure {
  id?: string;
  key?: string;
  label: string;
  unit?: string;
  currency?: string;
}

export interface Dimension {
  key: string;
  label: string;
  ordered?: boolean;
}

export interface VisualDataset {
  id: string;
  title: string;
  rows: Record<string, any>[];
  dimensions: Dimension[];
  measures: Measure[];
  note: string;
  defaultDimension?: string;
  defaultMeasure?: string;
}

export interface VisualPoint {
  key: string;
  label: string;
  value: number | null;
  exact: string | null;
  comparison?: number | null;
  compareExact?: string | null;
  categoryKey?: string;
  metadata?: Record<string, any>;
}

export function decimal(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : null;
  if (typeof val === 'string' && /^-?\d+(?:\.\d+)?$/.test(val.trim())) {
    return val.trim();
  }
  return null;
}

export function exactLabel(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Unavailable';
  return String(value);
}
