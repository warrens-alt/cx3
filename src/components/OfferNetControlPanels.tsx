import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock3, ListChecks, PhoneCall, ShieldCheck } from 'lucide-react';
import type { OperatingControlsData } from '../lib/offernetClient';

const fmt = (value: number | null | undefined) => (value == null || Number.isNaN(Number(value)) ? '0' : Number(value).toLocaleString());

export function OperatingControlStrip({ data }: { data: OperatingControlsData }) {
  const s = data?.summary || ({} as any);
  return (
    <section className="cx-command-metrics cx-control-metrics" aria-label="OfferNet operating controls">
      <article className="cx-command-metric">
        <span>Capture → first dial</span>
        <strong>{s.captureToDialMedian || '—'}</strong>
        <div><small>P90 {s.captureToDialP90 || '—'} · {s.captureWithin15mRate ?? 0}% within 15m</small></div>
      </article>
      <article className="cx-command-metric">
        <span>Awaiting first dial</span>
        <strong>{fmt(s.awaitingFirstDial)}</strong>
        <div><small>Oldest delivered wait {s.oldestDeliveryWait || '—'}</small></div>
      </article>
      <article className="cx-command-metric">
        <span>One-call share</span>
        <strong>{s.singleAttemptSharePct ?? 0}%</strong>
        <div><small>{fmt(s.oneCallLeads)} leads with one recorded call-count</small></div>
      </article>
      <article className="cx-command-metric">
        <span>5+ calls, no RPC</span>
        <strong>{fmt(s.highAttemptNoRpcLeads)}</strong>
        <div><small>High-effort leads with no recorded right-party contact</small></div>
      </article>
      <article className="cx-command-metric">
        <span>Disposition complete</span>
        <strong>{s.dispositionCompletenessPct ?? 0}%</strong>
        <div><small>Dialled leads with a recorded latest disposition</small></div>
      </article>
      <article className="cx-command-metric">
        <span>Outside operating hours</span>
        <strong>{s.afterHoursSharePct ?? 0}%</strong>
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
  const attemptBuckets = data?.attemptBuckets || [];
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
            {attemptBuckets.map(row => (
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
      <div className="cx-control-note">{data?.methodology?.callCount || ''}</div>
    </section>
  );
}

export function CaptureTurnaroundPanel({ data }: { data: OperatingControlsData }) {
  const s = data?.summary || ({} as any);
  const hourlyFlow = data?.hourlyFlow || [];
  const dailyTurnaround = data?.dailyTurnaround || [];
  const maxFlow = Math.max(1, ...hourlyFlow.flatMap(row => [row?.captured || 0, row?.firstDials || 0]));
  const recent = dailyTurnaround.slice(-14).reverse();

  return (
    <section className="cx-command-panel">
      <header>
        <div>
          <span className="cx-command-section-kicker">Lead-entry turnaround</span>
          <h2>Capture → first dial</h2>
          <p>Lead fetched/API-entry time to first recorded dial, kept separate from delivery → first dial.</p>
        </div>
        <Clock3 size={16} className="text-slate-400"/>
      </header>

      <div className="cx-turnaround-kpis">
        <article><span>Median</span><strong>{s.captureToDialMedian || '—'}</strong><small>Observed dialled leads</small></article>
        <article><span>P90</span><strong>{s.captureToDialP90 || '—'}</strong><small>Tail turnaround</small></article>
        <article><span>≤15 minutes</span><strong>{s.captureWithin15mRate ?? 0}%</strong><small>All captured leads in scope</small></article>
        <article><span>≤1 hour</span><strong>{s.captureWithin60mRate ?? 0}%</strong><small>All captured leads in scope</small></article>
        <article><span>Waiting first dial</span><strong>{fmt(s.awaitingFirstDial)}</strong><small>Oldest delivered wait {s.oldestDeliveryWait || '—'}</small></article>
      </div>

      <div className="cx-command-grid cx-turnaround-grid">
        <div className="cx-turnaround-flow">
          <h3>Lead-in vs first-dial flow by hour</h3>
          <p>Tenant-local clock. This compares throughput timing, not one-to-one hourly cohort attribution.</p>
          <div className="cx-hour-flow-list">
            {hourlyFlow.map(row => (
              <div key={row.hour}>
                <span>{String(row.hour).padStart(2, '0')}:00</span>
                <div className="cx-hour-flow-bars">
                  <i data-series="captured" style={{ width: `${((row.captured || 0) / maxFlow) * 100}%` }} />
                  <i data-series="dialled" style={{ width: `${((row.firstDials || 0) / maxFlow) * 100}%` }} />
                </div>
                <small>{fmt(row.captured)} in · {fmt(row.firstDials)} first dials</small>
              </div>
            ))}
          </div>
        </div>

        <div className="cx-turnaround-days">
          <h3>Recent turnaround</h3>
          <p>Daily capture cohorts in the selected period.</p>
          <div className="cx-performance-table-wrap">
            <table className="cx-performance-table">
              <thead><tr><th>Date</th><th>Leads</th><th>Median</th><th>P90</th><th>≤15m</th><th>≤1h</th></tr></thead>
              <tbody>
                {recent.map(row => (
                  <tr key={row.date}>
                    <th>{row.date}</th>
                    <td>{fmt(row.leads)}</td>
                    <td>{row.median || '—'}</td>
                    <td>{row.p90 || '—'}</td>
                    <td>{row.within15mRate}%</td>
                    <td>{row.within60mRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="cx-control-note">{data?.methodology?.captureTurnaround || ''}</div>
    </section>
  );
}

export function SlaBandsPanel({ data }: { data: OperatingControlsData }) {
  const slaBands = data?.slaBands || [];
  const max = Math.max(1, ...slaBands.map(row => row?.leads || 0));
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
        {slaBands.map(row => (
          <div key={row.band}>
            <div><strong>{row.band}</strong><small>{fmt(row.leads)} leads</small></div>
            <div className="cx-control-track"><i style={{ width: `${((row.leads || 0) / max) * 100}%` }}/></div>
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
  const s = data?.summary || ({} as any);
  const context = data?.operatingContext || { start: '08:00', end: '17:30', timezone: 'Africa/Johannesburg' };
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
          <strong>{s.operatingHoursRpcRate ?? 0}% RPC</strong>
          <small>{s.operatingHoursSaleRate ?? 0}% sale / lead</small>
        </article>
        <article>
          <span>Outside operating hours</span>
          <strong>{s.afterHoursRpcRate ?? 0}% RPC</strong>
          <small>{s.afterHoursSaleRate ?? 0}% sale / lead · {fmt(s.afterHoursLeads)} leads</small>
        </article>
        <article>
          <span>Weekend capture</span>
          <strong>{s.weekendSharePct ?? 0}%</strong>
          <small>{fmt(s.weekendLeads)} captured leads</small>
        </article>
      </div>
    </section>
  );
}

export function ActivationAgeingPanel({ data }: { data: OperatingControlsData }) {
  const order = ['0–3d','4–7d','8–14d','15–30d','30d+'];
  const byBucket = new Map((data?.activationAgeing || []).map(row => [String(row?.bucket), Number(row?.leads || 0)]));
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
  const vendorControls = data?.vendorControls || [];
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
            {vendorControls.map(row => (
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
      <div className="cx-control-note">{data?.methodology?.vendor || ''}</div>
    </section>
  );
}

export function ContactGovernancePanel({
  data,
  highAttemptHref,
  oneCallHref,
}: {
  data: OperatingControlsData;
  highAttemptHref?: string;
  oneCallHref?: string;
}) {
  const s = data?.summary || ({} as any);
  const c = data?.dataCompleteness || ({} as any);
  const rows = [
    {
      key: 'high-attempt-no-rpc',
      title: '5+ recorded calls with no RPC',
      value: s.highAttemptNoRpcLeads,
      detail: 'High-effort leads that still have no recorded right-party contact.',
      href: highAttemptHref,
      severity: 'high',
    },
    {
      key: 'one-call-only',
      title: 'Exactly one recorded call',
      value: s.oneCallLeads,
      detail: `${s.singleAttemptSharePct ?? 0}% of dialled leads have exactly one recorded call-count.`,
      href: oneCallHref,
      severity: 'medium',
    },
    {
      key: 'missing-disposition',
      title: 'Missing latest dial disposition',
      value: c.missingDisposition,
      detail: `${s.dispositionCompletenessPct ?? 0}% disposition completeness across dialled leads.`,
      severity: 'medium',
    },
  ];

  return (
    <section className="cx-command-panel">
      <header>
        <div>
          <span className="cx-command-section-kicker">Contact governance</span>
          <h2>Attempt & disposition exceptions</h2>
          <p>Populations repeatedly raised in OfferNet reviews: insufficient follow-up, excessive repeat effort and incomplete disposition evidence.</p>
        </div>
        <AlertTriangle size={16} className="text-slate-400"/>
      </header>
      <div className="cx-attention-list">
        {rows.map(row => {
          const body = (
            <>
              <span className="cx-attention-dot" />
              <div><strong>{row.title}</strong><small>{row.detail}</small></div>
              <b>{fmt(row.value)}</b>
            </>
          );
          return row.href ? (
            <Link key={row.key} to={row.href} className="cx-attention-item" data-severity={row.severity}>{body}</Link>
          ) : (
            <div key={row.key} className="cx-attention-item" data-severity={row.severity}>{body}</div>
          );
        })}
      </div>
    </section>
  );
}

export function DataCompletenessPanel({ data }: { data: OperatingControlsData }) {
  const c = data?.dataCompleteness || ({} as any);
  const items = [
    ['Missing source', c.missingSource],
    ['Missing grade', c.missingGrade],
    ['Missing vendor', c.missingVendor],
    ['Missing dial disposition', c.missingDisposition],
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
          <article key={label} data-alert={Number(value || 0) > 0}>
            <span>{label}</span>
            <strong>{fmt(value)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
