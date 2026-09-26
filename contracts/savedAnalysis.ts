import type { DateBasis, Grouping } from './reporting';

export const SAVED_ANALYSIS_VERSION = 'cx.saved-analysis.1.0.0';
export type AnalysisReleaseMode = 'current_observations' | 'pinned_release';

/** Persistence-neutral contract. No record data or credentials belong in a saved analysis. */
export interface SavedAnalysisDefinition {
  version: typeof SAVED_ANALYSIS_VERSION;
  id: string;
  name: string;
  ownerSubject: string;
  report: 'evidence' | 'vendor_performance' | 'exceptions' | 'commercial_reconciliation' | 'explore' | 'vetting';
  scope: {
    tenantId: string;
    startDate: string;
    endDate: string;
    dateBasis: DateBasis;
    grouping: Grouping;
    filters: { vendor?: string[]; source?: string[]; medium?: string[] };
  };
  metrics: string[];
  presentation: {
    chartType?: string;
    visibleSeries?: string[];
    sort?: { field: string; direction: 'asc' | 'desc' };
    tableDensity?: 'comfortable' | 'compact';
    layout?: string[];
  };
  release: { mode: AnalysisReleaseMode; releaseId: string | null };
}

export interface SavedAnalysisRepository {
  list(ownerSubject: string, tenantId: string): Promise<SavedAnalysisDefinition[]>;
  save(definition: SavedAnalysisDefinition): Promise<void>;
  remove(ownerSubject: string, id: string): Promise<void>;
}

/** Prevent a future adapter from calling a live view a frozen snapshot. */
export function validateSavedAnalysisRelease(definition: SavedAnalysisDefinition): void {
  if (definition.release.mode === 'pinned_release' && !definition.release.releaseId) {
    throw new Error('A pinned analysis requires an immutable release ID.');
  }
  if (definition.release.mode === 'current_observations' && definition.release.releaseId !== null) {
    throw new Error('A current-observation view cannot carry a release ID.');
  }
}
