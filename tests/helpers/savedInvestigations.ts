import { SAVED_INVESTIGATION_VERSION, type SavedInvestigationDraft } from '../../contracts/savedAnalysis';
import { savedInvestigationObjectName, type SavedInvestigationBackend, type SavedInvestigationCollection } from '../../server/savedAnalyses/repository';

export const savedDraft = (tenantId = 'tenant_a', name = 'Undialled cohort'): SavedInvestigationDraft => ({
  version: SAVED_INVESTIGATION_VERSION, report: 'investigation', name,
  scope: { tenantId, startDate: '2026-09-01', endDate: '2026-09-30', dateBasis: 'intake_cohort', countingGrain: 'lead', filters: { vendor: { operator: 'equals', value: 'Vendor A' } } },
  investigation: { drill: 'awaiting-first-dial', segmentSource: 'Unrecorded', metric: 'dialRate' },
  release: { mode: 'current_observations', releaseId: null },
});

/** Test-only durable-storage simulator, shared between separate repository/router instances. */
export class TestSavedBackend implements SavedInvestigationBackend {
  data = new Map<string, { collection: SavedInvestigationCollection; generation: string }>();
  reads = 0; writes = 0;
  async read(owner: string, tenant: string) {
    this.reads++;
    const value = this.data.get(savedInvestigationObjectName(owner, tenant));
    return value ? structuredClone(value) : { collection: null, generation: '0' };
  }
  async compareAndSwap(owner: string, tenant: string, generation: string, collection: SavedInvestigationCollection) {
    this.writes++;
    const key = savedInvestigationObjectName(owner, tenant), previous = this.data.get(key);
    if ((previous?.generation || '0') !== generation) return false;
    this.data.set(key, { collection: structuredClone(collection), generation: String(Number(generation) + 1) });
    return true;
  }
}
