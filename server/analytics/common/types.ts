export interface OffernetQueryParams {
  clientId: string;
  startDate?: string;
  endDate?: string;
  period?: 'today' | 'wtd' | 'mtd' | 'wow' | 'mom' | 'matched_mom' | 'custom';
  vendor?: string;
  source?: string;
  medium?: string;
  grade?: string;
  agent?: string;
  campaign?: string;
  channel?: string;
  adset?: string;
  cli?: string;
  search?: string;
  drill?: string;
  drillValue?: string;
  metric?: string;
  limit?: number;
  offset?: number;
}

// Format seconds into human readable duration
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}
