import { formatTableNumber } from '../lib/formatters';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useClient } from '../lib/ClientContext';
import { useAuth } from '../lib/AuthContext';
import { defaultDateRange, extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import { fetchMarketingRootCause, fetchRootCause, type MarketingRootCauseData, type RootCauseData } from '../lib/offernetClient';

const MARKETING_METRICS = new Set(['spend', 'cpc', 'cpm', 'cpl', 'ctr', 'leads']);

const OPERATIONAL_METRIC_MAP: Record<string, string> = {
  fetched: 'fetchedLeads',
  fetchedLeads: 'fetchedLeads',
  leads: 'fetchedLeads',
  captured: 'fetchedLeads',
  acquiredDemand: 'fetchedLeads',
  totalConsumers: 'fetchedLeads',
  includedLeads: 'fetchedLeads',
  classRecorded: 'fetchedLeads',
  namedColour: 'fetchedLeads',
  bothRecorded: 'fetchedLeads',

  delivery: 'deliveryRate',
  deliveryRate: 'deliveryRate',
  delivered: 'deliveryRate',
  delivered_episodes: 'deliveryRate',
  total_routed_leads: 'deliveryRate',
  routed_leads: 'deliveryRate',
  avg_routing_depth: 'deliveryRate',
  multi_route_leads: 'deliveryRate',
  handoff_rate: 'deliveryRate',
  totalNodes: 'deliveryRate',
  mappedCount: 'deliveryRate',
  dependencyBlockedCount: 'deliveryRate',
  mappingRequiredCount: 'deliveryRate',
  activeExceptions: 'deliveryRate',
  awaitingFirstDial: 'deliveryRate',
  sla15m: 'deliveryRate',
  firstDial: 'deliveryRate',
  medianFirstDialSec: 'deliveryRate',

  dial: 'dialRate',
  dialRate: 'dialRate',
  dialled: 'dialRate',
  callCoverage: 'dialRate',
  call_coverage: 'dialRate',
  totalCalls: 'dialRate',
  zeroCallLeads: 'dialRate',
  oneCallShare: 'dialRate',
  multiAttemptShare: 'dialRate',
  carrierAsr: 'dialRate',
  asr: 'dialRate',
  distinctLeads: 'dialRate',

  contact: 'contactRate',
  contactRate: 'contactRate',
  contacted: 'contactRate',
  rpc: 'contactRate',
  rpcRate: 'contactRate',
  fivePlusNoRpc: 'contactRate',

  sale: 'leadToSaleRate',
  sales: 'leadToSaleRate',
  leadToSaleRate: 'leadToSaleRate',
  saleRate: 'leadToSaleRate',
  sale_events: 'leadToSaleRate',
  totalSales: 'leadToSaleRate',
  single_billable_sale_rate_pct: 'leadToSaleRate',
  repeat_billable_sale_rate_pct: 'leadToSaleRate',
  revenue: 'leadToSaleRate',
  collected_value: 'leadToSaleRate',
  invoiced_value: 'leadToSaleRate',
  approved_value: 'leadToSaleRate',
  expected_value: 'leadToSaleRate',
  total_revenue: 'leadToSaleRate',
  unactivated: 'leadToSaleRate',

  activation: 'activationRate',
  activations: 'activationRate',
  activationRate: 'activationRate',
  totalActivations: 'activationRate',
  sale_activation_rate: 'activationRate',
  activation_events: 'activationRate',
};

export default function RootCauseDrawer({
  open,
  metric,
  metricLabel,
  onClose,
}: {
  open: boolean;
  metric: string | null;
  metricLabel?: string;
  onClose: () => void;
}) {
  const { selectedClient } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters } = useFilters();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<RootCauseData | null>(null);
  const [marketingData, setMarketingData] = useState<MarketingRootCauseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string>('vendor');
  const dialogRef = useDialogAccessibility<HTMLElement>(open, onClose);

  // Compute effective date window
  const effectiveWindow = useMemo(() => {
    if (startDate && endDate) return { startDate, endDate };
    const def = defaultDateRange();
    return { startDate: def.start, endDate: def.end };
  }, [startDate, endDate]);

  const isMarketing = metric ? MARKETING_METRICS.has(metric) : false;
  const targetMetric = metric ? (isMarketing ? metric : OPERATIONAL_METRIC_MAP[metric] || 'leadToSaleRate') : null;

  useEffect(() => {
    if (!open || !targetMetric || !selectedClient) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setMarketingData(null);

    if (isMarketing) {
      fetchMarketingRootCause({
        clientId: selectedClient,
        startDate: effectiveWindow.startDate,
        endDate: effectiveWindow.endDate,
        metric: targetMetric as any,
        ...extractOffernetFilters(filters),
      })
        .then(result => {
          if (cancelled) return;
          if (result.status === 'UNAVAILABLE') {
            setError(result.reason || 'Marketing root-cause analysis is unavailable for this scope.');
          } else {
            setMarketingData(result);
          }
        })
        .catch(err => {
          if (!cancelled) setError(err?.message || 'Failed to explain media metric change');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      fetchRootCause({
        clientId: selectedClient,
        startDate: effectiveWindow.startDate,
        endDate: effectiveWindow.endDate,
        metric: targetMetric as any,
        ...extractOffernetFilters(filters),
      })
        .then(result => {
          if (!cancelled) setData(result);
        })
        .catch(err => {
          if (!cancelled) setError(err?.message || 'Failed to explain this change');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    return () => { cancelled = true; };
  }, [open, targetMetric, isMarketing, selectedClient, effectiveWindow, filters]);

  const exploreLink = (dimension: string, name: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    next.delete('search');
    next.delete('drill');
    next.delete('drillValue');
    if (dimension === 'vendor' || dimension === 'source' || dimension === 'grade') {
      if (!name.trim() || (dimension === 'vendor' && name === 'Unknown')) {
        next.delete(dimension);
        next.set('drill', `missing-${dimension}`);
      } else {
        next.set(dimension, name);
      }
    } else if (dimension === 'leadAge') {
      next.set('drill', 'delivery-age');
      next.set('drillValue', name);
    }
    return `/lead-explorer?${next.toString()}`;
  };

  const headline = useMemo(() => {
    if (data) {
      const top = data.drivers[0];
      if (!top || data.metric.delta === null) return null;
      return {
        direction: (data.metric.delta ?? 0) > 0 ? 'increased' : data.metric.delta < 0 ? 'decreased' : 'did not change',
        topName: top.name,
        topDimension: top.dimensionLabel,
        contribution: top.contribution,
        deltaUnit: data.metric.deltaUnit,
      };
    }
    if (marketingData?.drivers?.[0] && marketingData.metric?.delta !== null) {
      const top = marketingData.drivers[0];
      return {
        direction: (marketingData.metric?.delta ?? 0) > 0 ? 'increased' : (marketingData.metric?.delta ?? 0) < 0 ? 'decreased' : 'did not change',
        topName: top.name,
        topDimension: top.dimensionLabel,
        contribution: top.delta,
        deltaUnit: marketingData.metric?.unit === 'currency' ? 'R' : marketingData.metric?.unit === 'pp' ? '%' : '',
      };
    }
    return null;
  }, [data, marketingData]);

  if (!open) return null;

  const displayTitle = metricLabel || data?.metric.label || marketingData?.metric?.label || (metric ? metric.replace(/([A-Z])/g, ' $1').toLowerCase() : 'Metric');

  return (
    <div
      className="cx-rootcause-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        ref={dialogRef}
        tabIndex={-1}
        className="cx-rootcause-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Why did ${displayTitle} change?`}
      >
        <header>
          <div>
            <span>Root-cause analysis</span>
            <h2>Why did {displayTitle.toLowerCase()} change?</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close root-cause analysis">
            <X size={18} />
          </button>
        </header>

        {loading && !data && !marketingData ? (
          <div className="cx-rootcause-state">Calculating matched-period drivers…</div>
        ) : error ? (
          <div className="cx-rootcause-state is-error">{error}</div>
        ) : data ? (
          <div className="cx-rootcause-body">
            <section className="cx-rootcause-summary">
              <span>{data.metric.label}</span>
              <div>
                <strong>
                  {formatTableNumber(data.metric.currentValue)}
                  {data.metric.kind === 'rate' ? '%' : ''}
                </strong>
                <small>Current</small>
                <ArrowRight size={16} />
                <strong>
                  {formatTableNumber(data.metric.previousValue)}
                  {data.metric.kind === 'rate' ? '%' : ''}
                </strong>
                <small>Previous</small>
              </div>
              <p>
                {(data.metric.delta ?? 0) > 0 ? '+' : ''}
                {formatTableNumber(data.metric.delta)} {data.metric.deltaUnit}{' '}
                vs {data.previousWindow.startDate} → {data.previousWindow.endDate}
              </p>
            </section>

            {headline && (
              <section className="cx-rootcause-callout">
                <BarChart3 size={17} />
                <div>
                  <strong>{data.metric.label} {headline.direction}.</strong>
                  <p>
                    The largest contributor is {headline.topDimension}: <b>{headline.topName}</b>
                    {' '}({(headline.contribution ?? 0) > 0 ? '+' : ''}
                    {formatTableNumber(headline.contribution)} {headline.deltaUnit}).
                  </p>
                </div>
              </section>
            )}

            <section className="cx-rootcause-drivers">
              <h3>Largest contributions</h3>
              {data.drivers.slice(0, 6).map((driver, index) => (
                <div key={`${driver.dimension}-${driver.name}-${index}`}>
                  <span>{driver.dimensionLabel}</span>
                  <strong>{driver.name}</strong>
                  <b className={(driver.contribution ?? 0) >= 0 ? 'positive' : 'negative'}>
                    {(driver.contribution ?? 0) > 0 ? '+' : ''}
                    {formatTableNumber(driver.contribution)} {data.metric.deltaUnit}
                  </b>
                  {isAdmin && (
                    <Link to={exploreLink(driver.dimension, driver.name)} onClick={onClose}>
                      Inspect <ExternalLink size={12} />
                    </Link>
                  )}
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
                      <small>
                        {dimension.segments.length} segments · {dimension.reconciliationStatus || 'NOT_VERIFIED'}
                      </small>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {isOpen && (
                      <div className="cx-rootcause-segments">
                        <div className="cx-rootcause-segment-head">
                          <span>Segment</span>
                          <span>Current</span>
                          <span>Previous</span>
                          <span>Contribution</span>
                          <span />
                        </div>
                        {dimension.segments.map(segment => (
                          <div key={segment.name}>
                            <strong>{segment.name}</strong>
                            <span>
                              {formatTableNumber(segment.currentValue)}
                              {data.metric.kind === 'rate' ? '%' : ''}
                            </span>
                            <span>
                              {formatTableNumber(segment.previousValue)}
                              {data.metric.kind === 'rate' ? '%' : ''}
                            </span>
                            <b className={(segment.contribution ?? 0) >= 0 ? 'positive' : 'negative'}>
                              {(segment.contribution ?? 0) > 0 ? '+' : ''}
                              {formatTableNumber(segment.contribution)} {data.metric.deltaUnit}
                            </b>
                            {isAdmin ? (
                              <Link to={exploreLink(dimension.key, segment.name)} onClick={onClose}>
                                Records <ArrowRight size={11} />
                              </Link>
                            ) : (
                              <span />
                            )}
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
        ) : marketingData?.metric ? (
          <div className="cx-rootcause-body">
            <section className="cx-rootcause-summary">
              <span>{marketingData.metric.label}</span>
              <div>
                <strong>
                  {marketingData.metric.unit === 'currency' ? 'R ' : ''}
                  {formatTableNumber(marketingData.metric.currentValue)}
                  {marketingData.metric.unit === 'pp' ? '%' : ''}
                </strong>
                <small>Current</small>
                <ArrowRight size={16} />
                <strong>
                  {marketingData.metric.unit === 'currency' ? 'R ' : ''}
                  {formatTableNumber(marketingData.metric.previousValue)}
                  {marketingData.metric.unit === 'pp' ? '%' : ''}
                </strong>
                <small>Previous</small>
              </div>
              <p>
                {(marketingData.metric.delta ?? 0) > 0 ? '+' : ''}
                {marketingData.metric.unit === 'currency' ? 'R ' : ''}
                {formatTableNumber(marketingData.metric.delta)}
                {marketingData.metric.unit === 'pp' ? '%' : ''}{' '}
                vs {marketingData.previousWindow?.startDate} → {marketingData.previousWindow?.endDate}
              </p>
            </section>

            {headline && (
              <section className="cx-rootcause-callout">
                <BarChart3 size={17} />
                <div>
                  <strong>{marketingData.metric.label} {headline.direction}.</strong>
                  <p>
                    The largest contributor is {headline.topDimension}: <b>{headline.topName}</b>
                    {' '}({(headline.contribution ?? 0) > 0 ? '+' : ''}
                    {headline.deltaUnit} {formatTableNumber(headline.contribution)}).
                  </p>
                </div>
              </section>
            )}

            <section className="cx-rootcause-drivers">
              <h3>Channel & Campaign Drivers</h3>
              {marketingData.drivers.slice(0, 6).map((driver, index) => (
                <div key={`${driver.dimension}-${driver.name}-${index}`}>
                  <span>{driver.dimensionLabel}</span>
                  <strong>{driver.name}</strong>
                  <b className={(driver.delta ?? 0) >= 0 ? 'positive' : 'negative'}>
                    {(driver.delta ?? 0) > 0 ? '+' : ''}
                    {formatTableNumber(driver.delta)}
                  </b>
                  <Link to="/campaigns" onClick={onClose}>
                    Campaigns <ExternalLink size={12} />
                  </Link>
                </div>
              ))}
            </section>

            <section className="cx-rootcause-dimensions">
              {marketingData.dimensions.map(dimension => {
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
                          <span>Segment</span>
                          <span>Current</span>
                          <span>Previous</span>
                          <span>Delta</span>
                        </div>
                        {dimension.segments.map(segment => (
                          <div key={segment.name}>
                            <strong>{segment.name}</strong>
                            <span>{formatTableNumber(segment.currentValue)}</span>
                            <span>{formatTableNumber(segment.previousValue)}</span>
                            <b className={(segment.delta ?? 0) >= 0 ? 'positive' : 'negative'}>
                              {(segment.delta ?? 0) > 0 ? '+' : ''}
                              {formatTableNumber(segment.delta)}
                            </b>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

