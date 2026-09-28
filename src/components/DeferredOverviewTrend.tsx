import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import type { OverviewData } from '../lib/offernetClient';
import { OperationalEmpty } from './OperationalState';
import { formatTableNumber } from '../lib/formatters';

// An optional chart must never reload or replace the already-loaded report.
const OverviewTrendChart = lazy(() => import('./OverviewTrendChart'));

export default function DeferredOverviewTrend({ data }: { data: OverviewData['dailyTrends'] }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!container.current || visible || !data.length) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '160px' });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [visible, data.length]);

  if (!data.length) return <OperationalEmpty title="No daily trend available">Daily lead and sale counts will appear when records are available for this selection.</OperationalEmpty>;
  const fallback = <div className="cx-trend-placeholder" role="status"><span>Loading daily trend…</span></div>;
  return <>
    <div className="cx-chart-legend" aria-label="Chart series"><span><i />Fetched leads</span><span><i />Sales</span></div>
    <div ref={container} className="cx-command-chart" aria-label="Daily lead and sale trend">
      {visible ? <ErrorBoundary fallback={<OperationalEmpty title="Chart unavailable">The overview is still available. Open “View daily values” below to read the exact counts.</OperationalEmpty>}><Suspense fallback={fallback}><OverviewTrendChart data={data} /></Suspense></ErrorBoundary> : <div className="cx-trend-placeholder" aria-hidden="true" />}
    </div>
    <details className="cx-trend-data"><summary>View daily values</summary>
      <div className="cx-performance-table-wrap" tabIndex={0} role="region" aria-label="Daily trend values">
        <table className="cx-performance-table"><caption className="sr-only">Daily counts for the selected reporting scope</caption><thead><tr><th scope="col">Date</th><th scope="col">Fetched leads</th><th scope="col">Sales</th></tr></thead>
          <tbody>{data.map(row => <tr key={row.date}><th scope="row">{row.date}</th><td>{formatTableNumber(row.leads)}</td><td>{formatTableNumber(row.sales)}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </>;
}
