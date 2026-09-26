import React, { useEffect, useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import { useFilters } from '../lib/FilterContext';
import { fetchMarketingRootCause, type MarketingRootCauseData } from '../lib/offernetClient';

type MetricId = NonNullable<MarketingRootCauseData['metric']>['id'];

const formatMetric = (value: number | null | undefined, unit: string) => {
  if (value == null || !Number.isFinite(value)) return '—';
  if (unit === 'currency') return `R ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (unit === 'pp') return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export default function MarketingRootCauseDrawer({
  open,
  metric,
  onClose,
}: {
  open: boolean;
  metric: MetricId | null;
  onClose: () => void;
}) {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<MarketingRootCauseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState('channel');

  useEffect(() => {
    if (!open || !metric || !selectedClient || !startDate || !endDate) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    const campaignFilter = filters.campaign;
    const campaign = campaignFilter?.operator === 'in'
      ? String(campaignFilter.values?.[0] || '')
      : campaignFilter?.operator === 'equals'
        ? String(campaignFilter.value || '')
        : '';

    fetchMarketingRootCause({
      clientId: selectedClient,
      startDate,
      endDate,
      metric,
      campaign: campaign || undefined,
    })
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) setError(err?.message || 'Failed to explain media change'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, metric, selectedClient, startDate, endDate, filters]);

  if (!open) return null;

  return (
    <div className="cx-rootcause-backdrop" onMouseDown={event => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <aside className="cx-rootcause-drawer" role="dialog" aria-modal="true" aria-label="Why did this media metric change?">
        <header>
          <div>
            <span>Media diagnostics</span>
            <h2>Why did this change?</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close media root-cause analysis"><X size={18} /></button>
        </header>

        {!startDate || !endDate ? (
          <div className="cx-rootcause-state">Choose an explicit start and end date to run matched-period media diagnostics.</div>
        ) : loading ? (
          <div className="cx-rootcause-state">Calculating channel, campaign and adset changes…</div>
        ) : error ? (
          <div className="cx-rootcause-state is-error">{error}</div>
        ) : data?.metric ? (
          <div className="cx-rootcause-body">
            <section className="cx-rootcause-summary">
              <span>{data.metric.label}</span>
              <div>
                <strong>{formatMetric(data.metric.currentValue, data.metric.unit)}</strong>
                <small>Current</small>
                <span>→</span>
                <strong>{formatMetric(data.metric.previousValue, data.metric.unit)}</strong>
                <small>Previous</small>
              </div>
              <p>
                Change: {data.metric.delta != null && data.metric.delta > 0 ? '+' : ''}
                {formatMetric(data.metric.delta, data.metric.unit)}
              </p>
            </section>

            <section className="cx-rootcause-callout">
              <BarChart3 size={17} />
              <div>
                <strong>Largest observed segment changes</strong>
                <p>These are deterministic matched-period changes, not causal attribution scores.</p>
              </div>
            </section>

            <section className="cx-rootcause-drivers">
              <h3>Largest segment deltas</h3>
              {data.drivers.slice(0, 8).map((driver, index) => (
                <div key={`${driver.dimension}-${driver.name}-${index}`}>
                  <span>{driver.dimensionLabel}</span>
                  <strong>{driver.name}</strong>
                  <b className={(driver.delta || 0) >= 0 ? 'positive' : 'negative'}>
                    {driver.delta != null && driver.delta > 0 ? '+' : ''}{formatMetric(driver.delta, data.metric!.unit)}
                  </b>
                  <span />
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
                      <small>{dimension.segments.length} segments</small>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {isOpen && (
                      <div className="cx-rootcause-segments">
                        <div className="cx-rootcause-segment-head">
                          <span>Segment</span><span>Current</span><span>Previous</span><span>Delta</span><span />
                        </div>
                        {dimension.segments.map(segment => (
                          <div key={segment.name}>
                            <strong>{segment.name}</strong>
                            <span>{formatMetric(segment.currentValue, data.metric!.unit)}</span>
                            <span>{formatMetric(segment.previousValue, data.metric!.unit)}</span>
                            <b className={(segment.delta || 0) >= 0 ? 'positive' : 'negative'}>
                              {segment.delta != null && segment.delta > 0 ? '+' : ''}{formatMetric(segment.delta, data.metric!.unit)}
                            </b>
                            <span />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            <footer>
              <span>{data.validationStatus || data.status}</span>
              <p>{data.methodology}</p>
            </footer>
          </div>
        ) : (
          <div className="cx-rootcause-state">{data?.reason || 'Media root-cause analysis is unavailable for this scope.'}</div>
        )}
      </aside>
    </div>
  );
}
