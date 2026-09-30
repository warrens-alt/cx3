import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import type { VendorQualityData } from '../../../lib/offernetClient';
import { formatTableNumber, formatPercent } from '../../../lib/formatters';
import EvidenceBars from '../../../shared/visuals/EvidenceBars';

type Vendor = VendorQualityData['vendors'][number];
const measures = {
  leads: { label: 'Fetched leads', rate: false },
  deliveryRate: { label: 'Delivery rate', rate: true },
  dialRate: { label: 'Dial / delivered', rate: true },
  contactRate: { label: 'RPC / dialled', rate: true },
  saleRate: { label: 'Sale / RPC', rate: true },
  activationRate: { label: 'Activation / sale', rate: true },
} as const;
type Measure = keyof typeof measures;

/** A fixed visual scale, not a target, ranking score or an altered percentage. */
export function rateIntensity(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value >= 0 && value <= 100 ? value / 100 : null;
}

function RateCell({ value }: { value: number | null | undefined }) {
  const intensity = rateIntensity(value);
  return <td className="cx-trust-number"><span className="cx-rate-cell" data-state={value == null ? 'unknown' : value === 0 ? 'zero' : 'observed'}
    style={intensity == null ? undefined : { background: `color-mix(in srgb, var(--cx-action) ${Math.round(intensity * 22)}%, var(--cx-surface))` }}>
    {value == null || !Number.isFinite(value) ? 'Unavailable' : formatPercent(value)}
    {value != null && Number.isFinite(value) && intensity == null && <small>Outside 0–100% scale</small>}
  </span></td>;
}

export default function VendorComparison({ vendors, onSelectVendor, onInspectVendor }: { vendors: Vendor[]; onSelectVendor: (vendor: string) => void; onInspectVendor?: (vendor: Vendor, measure: Measure) => void }) {
  const [search, setSearch] = useState('');
  const [measure, setMeasure] = useState<Measure>('leads');
  const [descending, setDescending] = useState(true);
  const definition = measures[measure];
  const rows = useMemo(() => vendors.map((vendor, index) => ({ vendor, key: String(index) }))
    .filter(({ vendor }) => vendor.vendor.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      const av = a.vendor[measure], bv = b.vendor[measure];
      const aMissing = av == null || !Number.isFinite(av), bMissing = bv == null || !Number.isFinite(bv);
      if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
      return descending ? bv - av : av - bv;
    }), [vendors, search, measure, descending]);
  return <section id="vendor-comparison" aria-labelledby="vendor-comparison-title" className="cx-trust-panel cx-vendor-comparison">
    <header className="cx-trust-heading"><div><h2 id="vendor-comparison-title">Compare vendors on the same measure</h2>
      <p>Choose one measure, compare its returned values, then inspect its evidence or filter to that vendor. Operational rates are not a lead-quality score.</p></div></header>
    <div className="cx-trust-toolbar">
      <label className="cx-trust-search"><Search size={14} aria-hidden="true" /><span className="sr-only">Find a vendor</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a vendor…" />
        {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear vendor search"><X size={14} /></button>}</label>
      <label>Measure <select aria-label="Vendor comparison measure" value={measure} onChange={event => setMeasure(event.target.value as Measure)}>{Object.entries(measures).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
      <button type="button" className="cx-trust-sort" onClick={() => setDescending(value => !value)}>{descending ? 'Highest first' : 'Lowest first'}</button>
      <span className="cx-trust-meta">{rows.length} of {vendors.length} vendors · search affects this view only</span>
    </div>
    <EvidenceBars title={definition.label} description={definition.rate ? 'Fixed 0–100% display scale. Exact returned percentages remain in the table, including any outside this range.' : 'Common count scale across the displayed vendor population.'}
      maximum={definition.rate ? 100 : undefined}
      items={rows.map(({ vendor, key }) => ({ key, label: vendor.vendor, value: vendor[measure], displayValue: definition.rate ? formatPercent(vendor[measure]) : formatTableNumber(vendor[measure]), detail: definition.rate ? `${formatTableNumber(vendor.leads)} fetched leads` : undefined }))}
      onSelect={key => { const selected = rows.find(row => row.key === key); if (selected) { if (onInspectVendor) onInspectVendor(selected.vendor, measure); else onSelectVendor(selected.vendor.vendor); } }}
      scaleNote={onInspectVendor ? "Select a bar to inspect its exact returned measure. Vendor-name controls apply the report filter. Missing is not zero." : "Selecting a bar applies the existing vendor filter to the whole report. Missing measures are not replaced with zero."} />
    <div className="cx-trust-matrix-heading"><h3>Operational performance matrix</h3><span className="cx-trust-meta">Darker blue = higher percentage, not better performance. No target or pass/fail threshold.</span></div>
    <div className="cx-trust-table-scroll" role="region" aria-label="Vendor performance matrix" tabIndex={0}>
      <table className="cx-trust-table cx-vendor-matrix">
        <caption className="sr-only">All returned vendor measures. Text values are available independently of colour.</caption>
        <thead><tr><th scope="col">Vendor</th><th scope="col">Leads</th><th scope="col">Delivery</th><th scope="col">Dial / delivered</th><th scope="col">RPC / dialled</th><th scope="col">Sale / RPC</th><th scope="col">Activation / sale</th><th scope="col">Median first dial</th><th scope="col">Calls / lead</th><th scope="col">Invalid</th>{onInspectVendor && <th scope="col">Evidence</th>}</tr></thead>
        <tbody>{rows.map(({ vendor, key }) => <tr key={key}>
          <th scope="row"><button type="button" className="cx-trust-link" onClick={() => onSelectVendor(vendor.vendor)} aria-label={`Filter to vendor ${vendor.vendor}`}>{vendor.vendor}<ArrowUpRight size={12} aria-hidden="true" /></button></th>
          <td className="cx-trust-number">{formatTableNumber(vendor.leads)}</td>
          <RateCell value={vendor.deliveryRate} /><RateCell value={vendor.dialRate} /><RateCell value={vendor.contactRate} /><RateCell value={vendor.saleRate} /><RateCell value={vendor.activationRate} />
          <td className="cx-trust-number">{vendor.medianFirstDial || 'Unavailable'}</td><td className="cx-trust-number">{formatTableNumber(vendor.callsPerLead)}</td><RateCell value={vendor.invalidRate} />
          {onInspectVendor && <td><button type="button" className="cx-button-secondary" onClick={() => onInspectVendor(vendor, measure)} aria-label={`Inspect ${definition.label} evidence for ${vendor.vendor}`}>Inspect evidence</button></td>}
        </tr>)}</tbody>
      </table>
    </div>
    {!rows.length && <p className="cx-trust-empty">{vendors.length ? 'No vendors match this search. Clear the search to restore the full returned list.' : 'No vendor observations returned for this scope.'}</p>}
  </section>;
}
