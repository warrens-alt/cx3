import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import type { VendorQualityData } from '../../../lib/offernetClient';
import { formatTableNumber, formatPercent } from '../../../lib/formatters';
import { lifecyclePresentation } from '../../../shared/visuals/lifecyclePresentation';
import ChartFrame from '../../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../../shared/reporting/ReportingScopeSummary';
import EvidenceBars from '../../../shared/visuals/EvidenceBars';

type Vendor = VendorQualityData['vendors'][number];
const measures = {
  leads: { label: 'Fetched leads', rate: false, color: lifecyclePresentation.fetched.color },
  deliveryRate: { label: 'Delivery rate', rate: true, color: lifecyclePresentation.delivered.color },
  dialRate: { label: 'Dial / delivered', rate: true, color: lifecyclePresentation.dialled.color },
  contactRate: { label: 'RPC / dialled', rate: true, color: lifecyclePresentation.rpc.color },
  saleRate: { label: 'Sale / RPC', rate: true, color: lifecyclePresentation.sales.color },
  activationRate: { label: 'Activation / sale', rate: true, color: lifecyclePresentation.activated.color },
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
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [measure, setMeasure] = useState<Measure>('leads');
  const [descending, setDescending] = useState(true);
  const [selectedVendorKey, setSelectedKey] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const selected = vendors.find(vendor => vendor.vendor === selectedVendorKey);
  const selectedKey = selected?.vendor ?? null;
  const highlightedKey = hovered ?? selectedKey;
  const rowState = (key: string) => ({
    className: selectedKey === key ? 'cx-selected-state' : undefined,
    'data-selected': selectedKey === key || undefined,
    'data-highlighted': highlightedKey === key || undefined,
    'data-dimmed': Boolean(highlightedKey && highlightedKey !== key) || undefined,
    onMouseEnter: () => setHovered(key), onMouseLeave: () => setHovered(null),
  });
  const definition = measures[measure];
  const rows = useMemo(() => vendors.map(vendor => ({ vendor, key: vendor.vendor }))
    .filter(({ vendor }) => vendor.vendor.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      const av = a.vendor[measure], bv = b.vendor[measure];
      const aMissing = av == null || !Number.isFinite(av), bMissing = bv == null || !Number.isFinite(bv);
      if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
      return descending ? bv - av : av - bv;
    }), [vendors, search, measure, descending]);
  return <div id="vendor-comparison"><ChartFrame title="Compare vendors on the same measure" subtitle="Select a vendor to align matrix, bars and exact evidence." className="cx-vendor-comparison" scope={<ReportingScopeSummary />}>
    <div className="cx-trust-toolbar">
      <label className="cx-trust-search"><Search size={14} aria-hidden="true" /><span className="sr-only">Find a vendor</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a vendor…" />
        {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear vendor search"><X size={14} /></button>}</label>
      <label>Measure <select aria-label="Vendor comparison measure" value={measure} onChange={event => setMeasure(event.target.value as Measure)}>{Object.entries(measures).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
      <button type="button" className="cx-trust-sort" onClick={() => setDescending(value => !value)}>{descending ? 'Highest first' : 'Lowest first'}</button>
      <span className="cx-trust-meta">{rows.length} of {vendors.length} vendors</span>
    </div>
    <div className="cx-trust-matrix-heading"><h3>Lifecycle performance matrix</h3><span className="cx-trust-meta">Returned rates · independent denominators</span></div>
    <div className="cx-vendor-lifecycle-scroll" role="region" aria-label="Vendor lifecycle performance matrix" tabIndex={0}>
      <table className="cx-vendor-lifecycle-matrix"><caption>Rates are independent; unavailable is not zero. Operational rates are not a lead-quality score.</caption>
        <thead><tr><th scope="col">Vendor</th><th scope="col">Fetched leads</th>{[
          { key: 'delivered', label: 'Delivery' }, { key: 'dialled', label: 'Dial / delivered' }, { key: 'rpc', label: 'RPC / dialled' }, { key: 'sales', label: 'Sale / RPC' }, { key: 'activated', label: 'Activation / sale' },
        ].map(column => { const stage = lifecyclePresentation[column.key as keyof typeof lifecyclePresentation]; return <th scope="col" key={column.key}><span><stage.Icon size={15} aria-hidden="true" style={{ color: stage.color }} />{column.label}</span></th>; })}</tr></thead>
        <tbody>{(showAll ? rows : rows.slice(0, 12)).map(({ vendor, key }) => <tr key={key} {...rowState(key)}>
          <th scope="row"><button type="button" className="cx-trust-link" onClick={() => setSelectedKey(key)} aria-pressed={selectedKey === key} aria-label={`Select vendor ${vendor.vendor}`} onFocus={() => setHovered(key)} onBlur={() => setHovered(null)}>{vendor.vendor}</button></th>
          <td>{formatTableNumber(vendor.leads)}</td>
          <LifecycleRate value={vendor.deliveryRate} color={lifecyclePresentation.delivered.color} />
          <LifecycleRate value={vendor.dialRate} color={lifecyclePresentation.dialled.color} />
          <LifecycleRate value={vendor.contactRate} color={lifecyclePresentation.rpc.color} />
          <LifecycleRate value={vendor.saleRate} color={lifecyclePresentation.sales.color} />
          <LifecycleRate value={vendor.activationRate} color={lifecyclePresentation.activated.color} />
        </tr>)}</tbody>
      </table>
    </div>
    {rows.length > 12 && <button type="button" className="cx-button-secondary" onClick={() => setShowAll(value => !value)}>{showAll ? 'Show top 12' : `Show all ${rows.length} vendors`}</button>}
    <EvidenceBars title={definition.label} description={definition.rate ? 'Fixed 0–100% display scale. Exact returned percentages remain in the table, including any outside this range.' : 'Common count scale across the displayed vendor population.'}
      maximum={definition.rate ? 100 : undefined}
      items={(showAll ? rows : rows.slice(0, 12)).map(({ vendor, key }) => ({ key, label: vendor.vendor, value: vendor[measure], color: definition.color, displayValue: definition.rate ? formatPercent(vendor[measure]) : formatTableNumber(vendor[measure]), detail: definition.rate ? `${formatTableNumber(vendor.leads)} fetched leads` : undefined }))}
      onSelect={setSelectedKey} selectedKey={selectedKey} highlightedKey={hovered} onHighlight={setHovered} selectionLabel="Select"
      scaleNote="Selection is local. Use Filter to vendor to change the report scope." />
    {selected && <div className="cx-selected-state cx-outcome-selection" role="status">
      <div><span>Selected · Vendor</span><strong>{selected.vendor}</strong><small>{definition.label}: {selected[measure] == null ? 'Unavailable' : definition.rate ? formatPercent(selected[measure]) : formatTableNumber(selected[measure])}</small></div>
      {onInspectVendor && <button type="button" className="cx-button-secondary" onClick={() => onInspectVendor(selected, measure)}>Inspect selected vendor</button>}
      <button type="button" className="cx-button-secondary" onClick={() => onSelectVendor(selected.vendor)}>Filter to vendor <ArrowUpRight size={12} aria-hidden="true" /></button>
      <button type="button" className="cx-button-quiet" onClick={() => setSelectedKey(null)}>Clear selection</button>
    </div>}
    <details className="cx-evidence-disclosure"><summary>View exact vendor evidence</summary>
    <div className="cx-trust-table-scroll" role="region" aria-label="Vendor performance matrix" tabIndex={0}>
      <table className="cx-trust-table cx-vendor-matrix">
        <caption className="sr-only">All returned vendor measures. Text values are available independently of colour.</caption>
        <thead><tr><th scope="col">Vendor</th><th scope="col">Leads</th><th scope="col">Delivery</th><th scope="col">Dial / delivered</th><th scope="col">RPC / dialled</th><th scope="col">Sale / RPC</th><th scope="col">Activation / sale</th><th scope="col">Median first dial</th><th scope="col">Calls / lead</th><th scope="col">Invalid</th><th scope="col">Actions</th></tr></thead>
        <tbody>{rows.map(({ vendor, key }) => <tr key={key} {...rowState(key)}>
          <th scope="row"><button type="button" className="cx-trust-link" onClick={() => setSelectedKey(key)} aria-pressed={selectedKey === key} aria-label={`Select vendor ${vendor.vendor}`} onFocus={() => setHovered(key)} onBlur={() => setHovered(null)}>{vendor.vendor}</button></th>
          <td className="cx-trust-number">{formatTableNumber(vendor.leads)}</td>
          <RateCell value={vendor.deliveryRate} /><RateCell value={vendor.dialRate} /><RateCell value={vendor.contactRate} /><RateCell value={vendor.saleRate} /><RateCell value={vendor.activationRate} />
          <td className="cx-trust-number">{vendor.medianFirstDial || 'Unavailable'}</td><td className="cx-trust-number">{formatTableNumber(vendor.callsPerLead)}</td><RateCell value={vendor.invalidRate} />
          <td><div className="cx-vendor-row-actions">{onInspectVendor && <button type="button" className="cx-button-quiet" onClick={() => onInspectVendor(vendor, measure)} aria-label={`Inspect ${definition.label} evidence for ${vendor.vendor}`}>Inspect</button>}<button type="button" className="cx-button-quiet" onClick={() => onSelectVendor(vendor.vendor)} aria-label={`Filter to vendor ${vendor.vendor}`}>Filter to vendor <ArrowUpRight size={12} aria-hidden="true" /></button></div></td>
        </tr>)}</tbody>
      </table>
    </div>
    </details>
    {!rows.length && <p className="cx-trust-empty">{vendors.length ? 'No vendors match this search. Clear the search to restore the full returned list.' : 'No vendor observations returned for this scope.'}</p>}
  </ChartFrame></div>;
}

function LifecycleRate({ value, color }: { value: number | null | undefined; color: string }) {
  const intensity = rateIntensity(value);
  const missing = value == null || !Number.isFinite(value);
  return <td><div className="cx-vendor-stage-cell" data-state={missing ? 'unknown' : value === 0 ? 'zero' : intensity == null ? 'outside-scale' : 'observed'} title={missing ? 'Unavailable' : `${formatPercent(value)} returned rate`}>
    <span>{missing ? 'Unavailable' : formatPercent(value)}</span>
    <i aria-hidden="true">{intensity != null && <b style={{ width: `${intensity * 100}%`, background: color }} />}</i>
    {!missing && intensity == null && <small>Outside 0–100% scale</small>}
  </div></td>;
}
