import TablePreview from '../../../shared/reporting/TablePreview';
import React, { useState } from 'react';
import type { DataIntegrityData } from '../../../lib/offernetClient';
import InspectorHost, { type InspectorContent } from '../../../shared/evidence/InspectorHost';
import { formatTableNumber } from '../../../lib/formatters';
import { EvidenceStatus } from './SourceEvidenceMatrix';
import { groupIntegrityChecks, type IntegrityCheck } from '../integrityAuditPresentation';

export default function IntegrityAuditChecks({ data, scope }: {
  data: DataIntegrityData;
  scope: NonNullable<InspectorContent['scope']>;
}) {
  const [selected, setSelected] = useState<IntegrityCheck | null>(null);
  const groups = groupIntegrityChecks(data.checks);
  // A replaced response cannot leave a previously selected result in the inspector.
  const check = selected && data.checks.includes(selected) ? selected : null;
  const content: InspectorContent | null = check ? {
    type: 'custom',
    title: check.checkName,
    subtitle: check.category,
    value: check.discrepancyCount,
    unit: 'observed gaps',
    relatedValue: { label: 'Returned check status', value: check.status },
    scope,
    definition: {
      meaning: check.detail || 'No check definition was supplied.',
      calculation: 'The observed gap count is returned by this check. No separate numerator or denominator is supplied.',
      nullMeaning: 'Unavailable means this check could not supply a measured gap count. It is not zero.',
      limitations: [data.reason].filter(Boolean),
    },
    provenance: { validationStatus: data.validationStatus },
    detailLimitation: 'Record drill is not available for this check. This response supplies aggregate evidence without an affected-record filter.',
    details: <div className="cx-integrity-inspector-detail">
      <h3>Returned evidence</h3>
      <dl>
        <div><dt>Check status</dt><dd><EvidenceStatus status={check.status} /></dd></div>
        <div><dt>Evidence state</dt><dd><EvidenceStatus status={check.evidence} /></dd></div>
        <div><dt>Definition and counting grain</dt><dd>{check.detail || 'No check definition was supplied.'}</dd></div>
        <div><dt>Report validation</dt><dd><EvidenceStatus status={data.validationStatus} />{data.reason && <p>{data.reason}</p>}</dd></div>
      </dl>
      <p>Source observations below describe the workspace sources. This response does not identify which source object supports this individual check.</p>
    </div>,
  } : null;
  return <>
    {[
      { id: 'measured-discrepancies', title: 'Measured discrepancies', description: 'Returned gap counts, including measured zero. A zero gap count does not certify the report or establish a complete source.', checks: groups.measured },
      { id: 'evidence-limitations', title: 'Evidence limitations', description: 'Checks with unavailable counts or an explicitly unverified evidence state. Any supplied count is retained below; missing values remain unavailable.', checks: groups.limitations },
    ].map(group => <section className="cx-integrity-audit-group" id={group.id} key={group.id} aria-labelledby={`${group.id}-heading`}>
      <header><h3 id={`${group.id}-heading`}>{group.title}</h3><p>{group.description}</p></header>
      {!group.checks.length ? <p className="cx-admin-empty">No checks in this group were returned.</p> :
        <TablePreview rows={group.checks} label={group.title.toLowerCase()}>{visibleRows => <div className="cx-performance-table-wrap" role="region" aria-label={group.title} tabIndex={0}>
          <table className="cx-performance-table cx-integrity-table">
            <thead><tr><th scope="col">Check</th><th scope="col">Status</th><th scope="col">Observed gaps</th><th scope="col">Evidence / definition</th><th scope="col">Audit</th></tr></thead>
            <tbody>{visibleRows.map((item, index) => <tr key={`${item.checkName}-${index}`}>
              <th scope="row">{item.checkName}<small>{item.category}</small></th>
              <td><EvidenceStatus status={item.status} /></td>
              <td>{item.discrepancyCount == null ? 'Unavailable' : formatTableNumber(item.discrepancyCount)}</td>
              <td><EvidenceStatus status={item.evidence} /><p>{item.detail || 'No check definition was supplied.'}</p></td>
              <td><button type="button" className="cx-admin-text-button" aria-label={`Inspect evidence for ${item.checkName}`} onClick={() => setSelected(item)}>Inspect</button><small>Record drill is not available for this check.</small></td>
            </tr>)}</tbody>
          </table>
        </div>}</TablePreview>}
    </section>)}
    <InspectorHost open={Boolean(content)} content={content} onClose={() => setSelected(null)} />
  </>;
}
