import type { RawLeadsData } from '../../lib/offernetClient';
import type { LedgerLead, LedgerReplicaReport } from '../../../contracts/leadLedgerReplica';
import type { InvestigationLead } from '../investigation/InvestigationRecordList';
export interface LeadEvidenceSelection {
  boundary: string; leadId: string | null; sourceKey?: string; origin: 'population' | 'source';
  row?: InvestigationLead; result?: RawLeadsData;
  sourceLead?: LedgerLead; sourceReport?: LedgerReplicaReport;
}
export interface SourceFocus { leadId: string; fields: string[] }
