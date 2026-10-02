import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock3, ListChecks, PhoneCall, ShieldCheck } from 'lucide-react';
import type { OperatingControlsData } from '../lib/offernetClient';
import { formatPercent, formatTableNumber } from '../lib/formatters';
import { formatOperatingWindow } from '../lib/metricPresentation';

const fmt = (value: number | string | null | undefined) => formatTableNumber(value);
const pct = (value: number | string | null | undefined, decimals = 1) => formatPercent(value, decimals);
const metricNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

function UnavailableControlPanel({ title }: { title: string }) {
  return (
    <section className="cx-command-panel">
      <header>
        <div>
          <span className="cx-command-section-kicker">Unavailable</span>
          <h2>{title}</h2>
          <p>The analytical response did not include the required measured fields for this scope.</p>
        </div>
        <AlertTriangle size={16} className="text-text-mute"/>
      </header>
    </section>
  );
}

export function OperatingControlStrip({ data }: { data: OperatingControlsData }) {
  const s = data?.summary;
  if (!s) return <UnavailableControlPanel title="OfferNet operating controls" />;
  return (
    <section className="cx-command-metrics cx-control-metrics" aria-label="OfferNet operating controls">
      <article className="cx-command-metric">
        <span>Capture → first dial</span>
        <strong>{s.captureToDialMedian || '—'}</strong>
        <div><small>P90 {s.captureToDialP90 || '—'} · {pct(s.captureWithin15mRate)} within 15m</small></div>
      </article>
      <article className="cx-command-metric">
        <span>Awaiting qualified first dial</span>
        <strong>{fmt(s.awaitingFirstDial)}</strong>
        <div><small>Oldest delivered wait {s.oldestDeliveryWait || '—'}</small></div>
      </article>
      <article className="cx-command-metric">
        <span>One-call share</span>
        <strong>{pct(s.singleAttemptSharePct)}</strong>
        <div><small>{fmt(s.oneCallLeads)} leads · share of dialled leads; {fmt(s.dialledUnrecordedCallLeads)} dialled leads have unrecorded call counts</small></div>
      </article>
      <article className="cx-command-metric">
        <span>5+ calls, no RPC</span>
        <strong>{fmt(s.highAttemptNoRpcLeads)}</strong>
        <div><small>Recorded 5+ calls with explicit non-RPC evidence</small></div>
      </article>
      <article className="cx-command-metric">
        <span>Disposition complete</span>
        <strong>{pct(s.dispositionCompletenessPct)}</strong>
        <div><small>Dialled leads with a recorded latest disposition</small></div>
      </article>
      <article className="cx-command-metric">
        <span>Outside operating hours</span>
        <strong>{pct(s.afterHoursSharePct)}</strong>
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
          <p>Exclusive lead populations by the maximum valid recorded HLC call count. Zero calls requires an explicit 0; call count unrecorded is a separate population.</p>
        </div>
        <PhoneCall size={16} className="text-text-mute"/>
      </header>
      <div className="cx-performance-table-wrap">
        <table className="cx-performance-table">
          <thead>
            <tr><th>Call-count bucket</th><th>Leads</th><th>Share</th><th>RPC</th><th>RPC rate</th><th>Sales</th><th>Sale / lead</th></tr>
          </thead>
          <tbody>
            {attemptBuckets.map(row => (
              <tr key={row.bucket}>
                <th>{row.bucket === 'Unrecorded' ? 'Call count unrecorded' : row.bucket === '0 calls' ? 'Zero calls' : row.bucket}</th>
                <td>{fmt(row.leads)}</td>
                <td>{pct(row.sharePct)}</td>
                <td>{fmt(row.contacted)}</td>
                <td>{pct(row.contactRate)}</td>
                <td>{fmt(row.sales)}</td>
                <td>{pct(row.saleRate, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cx-control-note">{fmt(data?.summary?.unrecordedCallLeads)} leads have call count unrecorded, including {fmt(data?.summary?.dialledUnrecordedCallLeads)} dialled leads ({pct(data?.summary?.dialledUnrecordedCallSharePct)} of the dialled denominator). {data?.methodology?.callCount || 'Methodology unavailable for this scope.'}</div>
    </section>
  );
}

export function CaptureTurnaroundPanel({ data }: { data: OperatingControlsData }) {
  const s = data?.summary;
  if (!s) return <UnavailableControlPanel title="Capture → first dial" />;
  const hourlyFlow = data?.hourlyFlow || [];
  const dailyTurnaround = data?.dailyTurnaround || [];
  const maxFlow = Math.max(1, ...hourlyFlow.flatMap(row => [metricNumber(row?.captured), metricNumber(row?.firstDials)]));
  const recent = dailyTurnaround.slice(-14).reverse();

  return (
    <section className="cx-command-panel">
      <header>
        <div>
          <span className="cx-command-section-kicker">Lead-entry turnaround</span>
          <h2>Capture → first dial</h2>
          <p>Lead fetched/API-entry time to first recorded dial, kept separate from delivery → first dial.</p>
        </div>
        <Clock3 size={16} className="text-text-mute"/>
      </header>

      <div className="cx-turnaround-kpis">
        <article><span>Median</span><strong>{s.captureToDialMedian || '—'}</strong><small>Observed dialled leads</small></article>
        <article><span>P90</span><strong>{s.captureToDialP90 || '—'}</strong><small>Tail turnaround</small></article>
        <article><span>≤15 minutes</span><strong>{pct(s.captureWithin15mRate)}</strong><small>All captured leads in scope</small></article>
        <article><span>≤1 hour</span><strong>{pct(s.captureWithin60mRate)}</strong><small>All captured leads in scope</small></article>
        <article><span>Waiting qualified first dial</span><strong>{fmt(s.awaitingFirstDial)}</strong><small>Oldest delivered wait {s.oldestDeliveryWait || '—'}</small></article>
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
                  <i data-series="captured" style={{ width: `${(metricNumber(row.captured) / maxFlow) * 100}%` }} />
                  <i data-series="dialled" style={{ width: `${(metricNumber(row.firstDials) / maxFlow) * 100}%` }} />
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
                    <td>{pct(row.within15mRate)}</td>
                    <td>{pct(row.within60mRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="cx-control-note">{data?.methodology?.captureTurnaround || 'Methodology unavailable for this scope.'}</div>
    </section>
  );
}

export function SlaBandsPanel({ data }: { data: OperatingControlsData }) {
  const slaBands = data?.slaBands || [];
  const max = Math.max(1, ...slaBands.map(row => metricNumber(row?.leads)));
  return (
    <section className="cx-command-panel">
      <header>
        <div>
          <span className="cx-command-section-kicker">Speed</span>
          <h2>First-dial age bands</h2>
          <p>Delivery-to-first-dial populations with downstream RPC and sale yield.</p>
        </div>
        <Clock3 size={16} className="text-text-mute"/>
      </header>
      <div className="cx-control-band-list">
        {slaBands.map(row => (
          <div key={row.band}>
            <div><strong>{row.band}</strong><small>{fmt(row.leads)} leads</small></div>
            <div className="cx-control-track"><i style={{ width: `${(metricNumber(row.leads) / max) * 100}%` }}/></div>
            <dl>
              <div><dt>RPC</dt><dd>{pct(row.contactRate)}</dd></div>
              <div><dt>Sale</dt><dd>{pct(row.saleRate, 2)}</dd></div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OperatingWindowPanel({ data }: { data: OperatingControlsData }) {
  const s = data?.summary;
  if (!s) return <UnavailableControlPanel title="Operating-hours comparison" />;
  const context = data?.operatingContext;
  return (
    <section className="cx-command-panel">
      <header>
        <div>
          <span className="cx-command-section-kicker">Coverage</span>
          <h2>Operating-hours comparison</h2>
          <p>{context ? formatOperatingWindow(context) : 'Operating-hours configuration is unavailable for this scope.'}</p>
        </div>
        <Clock3 size={16} className="text-text-mute"/>
      </header>
      <div className="cx-control-window-grid">
        <article>
          <span>Inside operating hours</span>
          <strong>{pct(s.operatingHoursRpcRate)} RPC</strong>
          <small>{pct(s.operatingHoursSaleRate, 2)} sale / lead</small>
        </article>
        <article>
          <span>Outside operating hours</span>
          <strong>{pct(s.afterHoursRpcRate)} RPC</strong>
          <small>{pct(s.afterHoursSaleRate, 2)} sale / lead · {fmt(s.afterHoursLeads)} leads</small>
        </article>
        <article>
          <span>Weekend capture</span>
          <strong>{pct(s.weekendSharePct)}</strong>
          <small>{fmt(s.weekendLeads)} captured leads</small>
        </article>
      </div>
    </section>
  );
}

export function ActivationAgeingPanel({ data }: { data: OperatingControlsData }) {
  const order = ['0–3d','4–7d','8–14d','15–30d','30d+'];
  const byBucket = new Map((data?.activationAgeing || []).map(row => [String(row?.bucket), metricNumber(row?.leads)]));
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
        <ListChecks size={16} className="text-text-mute"/>
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
        <ShieldCheck size={16} className="text-text-mute"/>
      </header>
      <div className="cx-performance-table-wrap">
        <table className="cx-performance-table cx-vendor-controls-table">
          <thead>
            <tr><th>Vendor</th><th>Leads</th><th>15m SLA</th><th>Median first dial</th><th>One-call share</th><th>Zero calls</th><th>Call count unrecorded</th><th>Dialled with count unrecorded</th><th>5+ no RPC</th><th>Disposition complete</th><th>RPC</th><th>Sale / lead</th></tr>
          </thead>
          <tbody>
            {vendorControls.map(row => (
              <tr key={row.vendor}>
                <th>{row.vendor}</th>
                <td>{fmt(row.leads)}</td>
                <td>{pct(row.sla15Rate)}</td>
                <td>{row.medianFirstDial}</td>
                <td>{pct(row.oneCallSharePct)}</td>
                <td>{fmt(row.zeroCallLeads)}</td>
                <td>{fmt(row.unrecordedCallLeads)}</td>
                <td>{fmt(row.dialledUnrecordedCallLeads)} · {pct(row.dialledUnrecordedCallSharePct)}</td>
                <td>{fmt(row.highAttemptNoRpc)}</td>
                <td>{pct(row.dispositionCompletenessPct)}</td>
                <td>{pct(row.rpcRate)}</td>
                <td>{pct(row.leadToSaleRate, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cx-control-note">{data?.methodology?.vendor || 'Methodology unavailable for this scope.'}</div>
    </section>
  );
}

export function ContactGovernancePanel({
  data,
  highAttemptHref,
  oneCallHref,
  missingDispositionHref,
}: {
  data: OperatingControlsData;
  highAttemptHref?: string;
  oneCallHref?: string;
  missingDispositionHref?: string;
}) {
  const s = data?.summary;
  if (!s) return <UnavailableControlPanel title="Attempt & disposition exceptions" />;
  const c = data?.dataCompleteness;
  const rows = [
    {
      key: 'unrecorded-call-count',
      title: 'Call count unrecorded',
      value: s.unrecordedCallLeads,
      detail: `${fmt(s.dialledUnrecordedCallLeads)} qualified dialled leads lack a valid cumulative counter (${pct(s.dialledUnrecordedCallSharePct)} of the dialled denominator).`,
      severity: 'medium',
    },
    {
      key: 'zero-call-count',
      title: 'Zero calls',
      value: s.zeroCallLeads,
      detail: 'A valid cumulative call counter is explicitly recorded as 0.',
      severity: 'medium',
    },
    {
      key: 'high-attempt-no-rpc',
      title: '5+ recorded calls with no RPC',
      value: s.highAttemptNoRpcLeads,
      detail: 'Recorded call count ≥5 with explicit non-RPC evidence; unknown RPC does not qualify.',
      href: highAttemptHref,
      severity: 'high',
    },
    {
      key: 'one-call-only',
      title: 'Exactly one recorded call',
      value: s.oneCallLeads,
      detail: `${pct(s.singleAttemptSharePct)}: qualified dialled leads with exactly one recorded call / qualified dialled leads. ${fmt(s.dialledUnrecordedCallLeads)} dialled leads have unrecorded call counts.`,
      href: oneCallHref,
      severity: 'medium',
    },
    {
      key: 'missing-disposition',
      title: 'Missing latest dial disposition',
      value: c?.missingDisposition,
      detail: `${pct(s.dispositionCompletenessPct)} disposition completeness across dialled leads.`,
      href: missingDispositionHref,
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
        <AlertTriangle size={16} className="text-text-mute"/>
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
  const c = data?.dataCompleteness;
  if (!c) return <UnavailableControlPanel title="Operational completeness" />;
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
        <AlertTriangle size={16} className="text-text-mute"/>
      </header>
      <div className="cx-control-completeness">
        {items.map(([label, value]) => (
          <article key={label} data-alert={typeof value === 'number' && Number.isFinite(value) && value > 0}>
            <span>{label}</span>
            <strong>{fmt(value)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
