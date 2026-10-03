import React, { useMemo } from 'react';
import { buildLedgerTimeline } from '../leadLedger/timeline';
import { ledgerCalls } from '../../lib/leadLedgerValues';
import { evidenceText, outcomeText, type InvestigationLead } from './InvestigationRecordList';
import { formatAnalyticalRevenue } from './analyticalParameters';
import LeadEvidenceSummary from './LeadEvidenceSummary';

/** A concise reading of the loaded analytical row. The existing timeline owns durations. */
export default function LeadDossierSummary({ row, validation }: { row: InvestigationLead; validation: string }) {
  const timeline = useMemo(() => buildLedgerTimeline(row), [row]);
  const deliveryToDial = timeline.transitions.find(transition => transition.fromId === 'delivery' && transition.toId === 'call');
  const groups: Array<{ title: string; fields: Array<[string, unknown]> }> = [
    { title: 'Identity', fields: [['Lead ID', row.lead_id], ['Consumer ID', row.consumer_id], ['Representative vendor', row.vendor], ['Source', row.source]] },
    { title: 'Current state', fields: [['Furthest recorded stage', timeline.currentStage?.title], ['Evidence state', validation]] },
    { title: 'Qualification', fields: [['Grade', row.grade], ['Vetting', row.vetting]] },
    { title: 'Contact', fields: [['Recorded calls', ledgerCalls(row.total_calls)], ['RPC', outcomeText(row.contacted)], ['Latest disposition', row.last_dialer_status]] },
    { title: 'Outcomes', fields: [['Recorded sale', outcomeText(row.sale)], ['Recorded activation', outcomeText(row.activated)], ['Recorded revenue', formatAnalyticalRevenue(row)]] },
    { title: 'Timing', fields: [['Captured', row.fetched], ['Delivered', row.delivered_time], ['First dial', row.first_call_time], ['Delivery → first dial', deliveryToDial?.label || 'Time unavailable']] },
  ];
  return <div className="cx-dossier-summary">
    <LeadEvidenceSummary row={row} compact />
    <div className="cx-dossier-summary-groups">{groups.map(group => <section key={group.title} className="cx-dossier-summary-group" data-summary-group={group.title.toLowerCase()} aria-label={group.title}>
      <h3>{group.title}</h3><dl>{group.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{evidenceText(value)}</dd></div>)}</dl>
    </section>)}</div>
    <p className="cx-dossier-note">Furthest stage is a lifecycle position, not a confirmed latest event. Recorded revenue does not establish collected cash.</p>
  </div>;
}
