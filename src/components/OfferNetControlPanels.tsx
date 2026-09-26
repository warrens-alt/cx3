import React from 'react';
import { AlertTriangle, Clock3, ListChecks, PhoneCall, ShieldCheck } from 'lucide-react';
import type { OperatingControlsData } from '../lib/offernetClient';

const fmt = (value: number) => value.toLocaleString();

export function OperatingControlStrip({ data }: { data: OperatingControlsData }) {
  const s = data.summary;
  return (
    <section className="cx-command-metrics cx-control-metrics" aria-label="OfferNet operating controls">
      <article className="cx-command-metric">
        <span>One-call share</span>
        <strong>{s.singleAttemptSharePct}%</strong>
        <div><small>{fmt(s.oneCallLeads)} leads with one recorded call-count</small></div>
      </article>
      <article className="cx-command-metric">
        <span>5+ calls, no RPC</span>
        <strong>{fmt(s.highAttemptNoRpcLeads)}</strong>
        <div><small>High-effort leads with no recorded right-party contact</small></div>
      </article>
      <article className="cx-command-metric">
        <span>Disposition complete</span>
        <strong>{s.dispositionCompletenessPct}%</strong>
        <div><small>Dialled leads with a recorded latest disposition</small></div>
      </article>
      <article className="cx-command-metric">
        <span>Outside operating hours</span>
        <strong>{s.afterHoursSharePct}%</strong>
        <div><small>{fmt(s.afterHoursLeads)} captured outside configured coverage</small></div>
      </article>
      <article className="cx-command-metric">
        <span>Activation backlog &gt;14d</span>
        <strong>{fmt(s.activationBacklog14d)}</strong>
        <div><small>Recorded sales still without activation</small></div>
      </article>
    </section>
  );
}

export function AttemptCoveragePanel({ data }: { data: OperatingControlsData }) {
  return (
    <section className="cx-command-panel">
      <header>
        <div>
          <span className="cx-command-section-kicker">Contact governance</span>
          <h2>Recorded call-count coverage</h2>
          <p>Exclusive lead populations by the maximum recorded HLC call count, with eventual RPC and sale outcomes.</p>
        </div>
        <PhoneCall size={16} className="text-slate-400"/>
      </header>
      <div className="cx-performance-table-wrap">
        <table className="cx-performance-table">
          <thead>
            <tr><th>Call-count bucket</th><th>Leads</th><th>Share</th><th>RPC</th><th>RPC rate</th><th>Sales</th><th>Sale / lead</th></tr>
          </thead>
          <tbody>
            {data.attemptBuckets.map(row => (
              <tr key={row.bucket}>
                <th>{row.bucket}</th>
                <td>{fmt(row.leads)}</td>
                <td>{row.sharePct}%</td>
                <td>{fmt(row.contacted)}</td>
                <td>{row.contactRate}%</td>
                <td>{fmt(row.sales)}</td>
                <td>{row.saleRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cx-control-note">{data.methodology.callCount}</div>
    </section>
  );
}

export function SlaBandsPanel({ data }: { data: OperatingControlsData }) {
  const max = Math.max(1, ...data.slaBands.map(row => row.leads));
  return (
    <section className="cx-command-panel">
      <header>
        <div>
          <span className="cx-command-section-kicker">Speed</span>
          <h2>First-dial age bands</h2>
          <p>Delivery-to-first-dial populations with downstream RPC and sale yield.</p>
        </div>
        <Clock3 size={16} className="text-slate-400"/>
      </header>
      <div className="cx-control-band-list">
        {data.slaBands.map(row => (
          <div key={row.band}>
            <div><strong>{row.band}</strong><small>{fmt(row.leads)} leads</small></div>
            <div className="cx-control-track"><i style={{ width: `${(row.leads / max) * 100}%` }}/></div>
            <dl>
              <div><dt>RPC</dt><dd>{row.contactRate}%</dd></div>
              <div><dt>Sale</dt><dd>{row.saleRate}%</dd></div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OperatingWindowPanel({ data }: { data: OperatingControlsData }) {
  const s = data.summary;
  const context = data.operatingContext;
  return (
    <section className="cx-command-panel">
      <header>
        <div>
          <span className="cx-command-section-kicker">Coverage</span>
          <h2>Operating-hours comparison</h2>
          <p>{context.start}–{context.end} in {context.timezone}; configured working days only.</p>
        </div>
        <Clock3 size={16} className="text-slate-400"/>
      </header>
      <div className="cx-control-window-grid">
        <article>
          <span>Inside operating hours</span>
          <strong>{s.operatingHoursRpcRate}% RPC</strong>
          <small>{s.operatingHoursSaleRate}% sale / lead</small>
        </article>
        <article>
          <span>Outside operating hours</span>
          <strong>{s.afterHoursRpcRate}% RPC</strong>
          <small>{s.afterHoursSaleRate}% sale / lead · {fmt(s.afterHoursLeads)} leads</small>
        </article>
        <article>
          <span>Weekend capture</span>
          <strong>{s.weekendSharePct}%</strong>
          <small>{fmt(s.weekendLeads)} captured leads</small>
        </article>
      </div>
    </section>
  );
}

export function ActivationAgeingPanel({ data }: { data: OperatingControlsData }) {
  const order = ['0–3d','4–7d','8–14d','15–30d','30d+'];
  const byBucket = new Map(data.activationAgeing.map(row => [String(row.bucket), Number(row.leads || 0)]));
  const rows = order.map(bucket => ({ bucket, leads: byBucket.get(bucket) || 0 }));
  const max = Math.max(1, ...rows.map(row => row.leads));
  return (
    <section className="cx-command-panel">
      <header>
        <div>
          <span className="cx-command-section-kicker">Fulfilment</span>
          <h2>Unactivated sale ageing</h2>
          <p>Recorded sales without an activation timestamp, grouped by age since sale.</p>
        </div>
        <ListChecks size={16} className="text-slate-400"/>
      </header>
      <div className="cx-control-ageing">
        {rows.map(row => (
          <div key={row.bucket}>
            <span>{row.bucket}</span>
            <div className="cx-control-track"><i style={{ width: `${(row.leads / max) * 100}%` }}/></div>
            <strong>{fmt(row.leads)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function VendorControlsPanel({ data }: { data: OperatingControlsData }) {
  return (
    <section className="cx-command-panel">
      <header>
        <div>
          <span className="cx-command-section-kicker">Execution controls</span>
          <h2>Vendor contact governance</h2>
          <p>Speed, disposition completeness, call-count coverage and conversion by first recorded delivered vendor.</p>
        </div>
        <ShieldCheck size={16} className="text-slate-400"/>
      </header>
      <div className="cx-performance-table-wrap">
        <table className="cx-performance-table cx-vendor-controls-table">
          <thead>
            <tr><th>Vendor</th><th>Leads</th><th>15m SLA</th><th>Median first dial</th><th>One-call share</th><th>5+ no RPC</th><th>Disposition complete</th><th>RPC</th><th>Sale / lead</th></tr>
          </thead>
          <tbody>
            {data.vendorControls.map(row => (
              <tr key={row.vendor}>
                <th>{row.vendor}</th>
                <td>{fmt(row.leads)}</td>
                <td>{row.sla15Rate}%</td>
                <td>{row.medianFirstDial}</td>
                <td>{row.oneCallSharePct}%</td>
                <td>{fmt(row.highAttemptNoRpc)}</td>
                <td>{row.dispositionCompletenessPct}%</td>
                <td>{row.rpcRate}%</td>
                <td>{row.leadToSaleRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cx-control-note">{data.methodology.vendor}</div>
    </section>
  );
}

export function DataCompletenessPanel({ data }: { data: OperatingControlsData }) {
  const items = [
    ['Missing source', data.dataCompleteness.missingSource],
    ['Missing grade', data.dataCompleteness.missingGrade],
    ['Missing vendor', data.dataCompleteness.missingVendor],
    ['Missing dial disposition', data.dataCompleteness.missingDisposition],
  ] as const;
  return (
    <section className="cx-command-panel">
      <header>
        <div>
          <span className="cx-command-section-kicker">Data control</span>
          <h2>Operational completeness</h2>
          <p>Concrete missing-field populations that affect routing, segmentation and performance interpretation.</p>
        </div>
        <AlertTriangle size={16} className="text-slate-400"/>
      </header>
      <div className="cx-control-completeness">
        {items.map(([label, value]) => (
          <article key={label} data-alert={value > 0}>
            <span>{label}</span>
            <strong>{fmt(value)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
