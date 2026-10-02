import React, { useState } from 'react';
import { SearchCheck } from 'lucide-react';
import type { DataIntegrityData } from '../../../lib/offernetClient';
import { formatTableNumber } from '../../../lib/formatters';
import EvidenceBars from '../../../shared/visuals/EvidenceBars';
import { EvidenceStatus } from './SourceEvidenceMatrix';

type Check = DataIntegrityData['checks'][number];

export default function IntegrityCheckComparison({ checks, onViewDetails }: { checks: Check[]; onViewDetails?: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  // Sort presentation only. Stable original indices distinguish similarly named checks.
  const ordered = checks.map((check, index) => ({ check, key: String(index) }))
    .sort((a, b) => (b.check.discrepancyCount ?? -1) - (a.check.discrepancyCount ?? -1));
  const current = ordered.find(item => item.key === selected) || ordered[0];
  return <section id="integrity-comparison" aria-label="Discrepancy comparison" className="cx-trust-comparison">
    <EvidenceBars title="Measured discrepancy counts" description="Select a check to read its exact definition. A missing count is not a measured zero."
      items={ordered.map(({ check, key }) => ({ key, label: check.checkName, detail: check.category,
        value: check.discrepancyCount, color: current?.key === key ? 'var(--cx-action)' : 'var(--cx-text-secondary)' }))}
      onSelect={setSelected} scaleNote="Bar length compares returned discrepancy counts only. Populations can overlap; these are not additive losses." />
    <aside className="cx-trust-panel cx-check-explanation" aria-label="Selected check evidence" aria-live="polite">
      {current ? <><header className="cx-trust-heading"><SearchCheck size={18} aria-hidden="true" /><EvidenceStatus status={current.check.status} /></header>
        <span className="cx-trust-meta">Selected check · {current.check.category}</span>
        <h3>{current.check.checkName}</h3>
        <strong className="cx-trust-big-number">{current.check.discrepancyCount == null ? 'Unavailable' : formatTableNumber(current.check.discrepancyCount)}</strong>
        <p className="cx-trust-meta">Reported discrepancy count</p>
        <dl className="cx-trust-definition"><div><dt>Evidence reference</dt><dd>{current.check.evidence || 'Not supplied'}</dd></div>
          <div><dt>Definition & interpretation</dt><dd>{current.check.detail}</dd></div></dl>
        {onViewDetails ? <button type="button" onClick={onViewDetails} className="cx-trust-link">View all check details and export</button> : <a href="#integrity-checks" className="cx-trust-link">View all check details and export</a>}
      </> : <p className="cx-trust-empty">No discrepancy checks were returned.</p>}
    </aside>
  </section>;
}
