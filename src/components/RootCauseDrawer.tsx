import { formatTableNumber } from '../lib/formatters';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useClient } from '../lib/ClientContext';
import { useAuth } from '../lib/AuthContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import { fetchRootCause, type RootCauseData } from '../lib/offernetClient';

type RootCauseMetric = RootCauseData['metric']['id'];

export default function RootCauseDrawer({
  open,
  metric,
  onClose,
}: {
  open: boolean;
  metric: RootCauseMetric | null;
  onClose: () => void;
}) {
  const { selectedClient } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters } = useFilters();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<RootCauseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string>('vendor');
  const dialogRef = useDialogAccessibility<HTMLElement>(open, onClose);

  useEffect(() => {
    if (!open || !metric || !selectedClient || !startDate || !endDate) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetchRootCause({
      clientId: selectedClient,
      startDate,
      endDate,
      metric,
      ...extractOffernetFilters(filters),
    })
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) setError(err?.message || 'Failed to explain this change'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, metric, selectedClient, startDate, endDate, filters]);

  const exploreLink = (dimension: string, name: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    next.delete('search');
    next.delete('drill');
    next.delete('drillValue');
    if (dimension === 'vendor' || dimension === 'source' || dimension === 'grade') {
      if (!name.trim() || (dimension === 'vendor' && name === 'Unknown')) { next.delete(dimension); next.set('drill', `missing-${dimension}`); }
      else next.set(dimension, name);
    } else if (dimension === 'leadAge') {
      next.set('drill', 'delivery-age');
      next.set('drillValue', name);
    }
    return `/lead-explorer?${next.toString()}`;
  };

  const headline = useMemo(() => {
    if (!data) return null;
    const top = data.drivers[0];
    if (!top || data.metric.delta === null) return null;
    return {
      direction: (data.metric.delta ?? 0) > 0 ? 'increased' : data.metric.delta < 0 ? 'decreased' : 'did not change',
      top,
    };
  }, [data]);

  if (!open) return null;

  return (
    <div className="cx-rootcause-backdrop" role="presentation" onMouseDown={event => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <aside ref={dialogRef} tabIndex={-1} className="cx-rootcause-drawer" role="dialog" aria-modal="true" aria-label="Why did this change?">
        <header>
          <div>
            <span>Root-cause analysis</span>
            <h2>Why did this change?</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close root-cause analysis"><X size={18} /></button>
        </header>

        {!startDate || !endDate ? (
          <div className="cx-rootcause-state">
            Select an explicit date period to compare it with the immediately preceding matched period.
          </div>
        ) : loading && !data ? (
          <div className="cx-rootcause-state">Calculating matched-period drivers…</div>
        ) : error ? (
          <div className="cx-rootcause-state is-error">{error}</div>
        ) : data ? (
          <div className="cx-rootcause-body">
            <section className="cx-rootcause-summary">
              <span>{data.metric.label}</span>
              <div>
                <strong>{formatTableNumber(data.metric.currentValue)}{data.metric.kind === 'rate' ? '%' : ''}</strong>
                <small>Current</small>
                <ArrowRight size={16} />
                <strong>{formatTableNumber(data.metric.previousValue)}{data.metric.kind === 'rate' ? '%' : ''}</strong>
                <small>Previous</small>
              </div>
              <p>
                {(data.metric.delta ?? 0) > 0 ? '+' : ''}{formatTableNumber(data.metric.delta)} {data.metric.deltaUnit}
                {' '}vs {data.previousWindow.startDate} → {data.previousWindow.endDate}
              </p>
            </section>

            {headline && (
              <section className="cx-rootcause-callout">
                <BarChart3 size={17} />
                <div>
                  <strong>{data.metric.label} {headline.direction}.</strong>
                  <p>
                    The largest vendor contribution is {headline.top.dimensionLabel}: <b>{headline.top.name}</b>
                    {' '}({(headline.top.contribution ?? 0) > 0 ? '+' : ''}{formatTableNumber(headline.top.contribution)} {data.metric.deltaUnit}).
                  </p>
                </div>
              </section>
            )}

            <section className="cx-rootcause-drivers">
              <h3>Largest vendor contributions</h3>
              {data.drivers.slice(0, 6).map((driver, index) => (
                <div key={`${driver.dimension}-${driver.name}-${index}`}>
                  <span>{driver.dimensionLabel}</span>
                  <strong>{driver.name}</strong>
                  <b className={(driver.contribution ?? 0) >= 0 ? 'positive' : 'negative'}>
                    {(driver.contribution ?? 0) > 0 ? '+' : ''}{formatTableNumber(driver.contribution)} {data.metric.deltaUnit}
                  </b>
                  {isAdmin && <Link to={exploreLink(driver.dimension, driver.name)} onClick={onClose}>
                    Inspect <ExternalLink size={12} />
                  </Link>}
                </div>
              ))}
            </section>

            <section className="cx-rootcause-dimensions">
              {data.dimensions.map(dimension => {
                const isOpen = expanded === dimension.key;
                return (
                  <div key={dimension.key}>
                    <button type="button" onClick={() => setExpanded(isOpen ? '' : dimension.key)}>
                      <span>{dimension.label}</span>
                      <small>{dimension.segments.length} segments · {dimension.reconciliationStatus || 'NOT_VERIFIED'}</small>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {isOpen && (
                      <div className="cx-rootcause-segments">
                        <div className="cx-rootcause-segment-head">
                          <span>Segment</span><span>Current</span><span>Previous</span><span>Contribution</span><span />
                        </div>
                        {dimension.segments.map(segment => (
                          <div key={segment.name}>
                            <strong>{segment.name}</strong>
                            <span>{formatTableNumber(segment.currentValue)}{data.metric.kind === 'rate' ? '%' : ''}</span>
                            <span>{formatTableNumber(segment.previousValue)}{data.metric.kind === 'rate' ? '%' : ''}</span>
                            <b className={(segment.contribution ?? 0) >= 0 ? 'positive' : 'negative'}>
                              {(segment.contribution ?? 0) > 0 ? '+' : ''}{formatTableNumber(segment.contribution)} {data.metric.deltaUnit}
                            </b>
                            {isAdmin ? <Link to={exploreLink(dimension.key, segment.name)} onClick={onClose}>Records <ArrowRight size={11} /></Link> : <span />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            <footer>
              <span>{data.validationStatus}</span>
              <p>{data.methodology}</p>
            </footer>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
