import { lazy, Suspense, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { BookOpen, ShieldCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { definitionsForDomain } from '../../contracts/analyticsLineage';
import { AUTHORITATIVE_METRICS, METRIC_REGISTRY_VERSION } from '../../contracts/metricRegistry';

const MetricLineageDrawer = lazy(() => import('./MetricLineageDrawer'));

const DOMAIN_TO_AUTHORITATIVE_MAP: Record<string, string> = {
  fetchedLeads: 'fetched_leads',
  deliveredLeads: 'delivered_leads',
  dialledLeads: 'dialled_leads',
  contactedLeads: 'rpc_leads',
  saleLeads: 'sale_leads',
  activatedLeads: 'activated_leads',
  deliveryRate: 'delivery_rate',
  dialRate: 'dial_rate',
  contactRate: 'rpc_rate',
  leadToSaleRate: 'sales_per_fetched_rate',
  contactToSaleRate: 'sales_per_rpc_rate',
  activationRate: 'activation_rate',
  sla15Rate: 'sla_15m_rate',
};

export default function AnalyticsDefinitions() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const definitions = definitionsForDomain(pathname.split('/')[1] || 'overview');
  const [selected, setSelected] = useState('leadToSaleRate');
  const definition = definitions.find(metric => metric.id === selected) || definitions[0];

  const authMetricKey = DOMAIN_TO_AUTHORITATIVE_MAP[definition.id];
  const authMetric = authMetricKey ? AUTHORITATIVE_METRICS[authMetricKey] : undefined;

  return <>
    <button type="button" className="cx-button-secondary" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <BookOpen size={14} aria-hidden="true" /> Metric definitions
    </button>
    {open && <ErrorBoundary fallback={<span role="alert" className="text-sm">Metric definitions could not load. Reload the page to try again. <button type="button" className="cx-button-secondary" onClick={() => setOpen(false)}>Dismiss definitions error</button></span>}>
      <Suspense fallback={<span role="status">Loading metric definitions…</span>}>
        <MetricLineageDrawer
          isOpen
          onClose={() => setOpen(false)}
          title={definition.label}
          lineage={{
            definition: definition.population,
            numerator: definition.numerator,
            denominator: definition.denominator || 'Count or sum; no denominator',
            source: definition.source,
            grain: definition.grain,
            dateBasis: definition.dateBasis,
            nullMeaning: definition.nullMeaning,
            filterCompatibility: definition.filterCompatibility,
            canonicalName: authMetric?.technicalLabel,
            metric: authMetric?.businessLabel,
          }}
          metadata={{ validationStatus: authMetric ? `${authMetric.reconciliationStatus} (${METRIC_REGISTRY_VERSION})` : definition.validationState }}
          additionalContent={
            <div className="space-y-4">
              <label className="block text-sm">Choose a metric
                <select className="block w-full mt-2 p-2 border rounded bg-surface text-text-main border-border-subtle" value={definition.id} onChange={event => setSelected(event.target.value)}>
                  {definitions.map(metric => <option key={metric.id} value={metric.id}>{metric.label}</option>)}
                </select>
              </label>

              {authMetric && (
                <div className="p-3 bg-brand-primary/5 rounded border border-brand-primary/20 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold text-brand-primary">
                    <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> Authoritative Contract</span>
                    <span className="font-mono text-[10px]">{METRIC_REGISTRY_VERSION}</span>
                  </div>
                  <p className="text-text-sec">{authMetric.plainDefinition}</p>
                  <dl className="grid grid-cols-2 gap-2 pt-1 border-t border-brand-primary/10">
                    <div>
                      <dt className="text-text-mute font-medium">Counting Grain</dt>
                      <dd className="font-semibold text-text-main">{authMetric.countingGrain}</dd>
                    </div>
                    <div>
                      <dt className="text-text-mute font-medium">Treatment of Unknown</dt>
                      <dd className="font-semibold text-text-main">{authMetric.treatmentOfUnknown.replace(/_/g, ' ')}</dd>
                    </div>
                    {authMetric.observationCutoff && (
                      <div className="col-span-2">
                        <dt className="text-text-mute font-medium">Observation Horizon</dt>
                        <dd className="text-text-main">{authMetric.observationCutoff}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              <dl className="space-y-3 text-xs">
                <div><dt className="font-semibold text-text-sec">Grain</dt><dd className="text-text-main">{definition.grain}</dd></div>
                <div><dt className="font-semibold text-text-sec">Date basis</dt><dd className="text-text-main">{definition.dateBasis}</dd></div>
                <div><dt className="font-semibold text-text-sec">Filter compatibility</dt><dd className="text-text-main">{definition.filterCompatibility}</dd></div>
                <div><dt className="font-semibold text-text-sec">Unavailable values</dt><dd className="text-text-main">{definition.nullMeaning}</dd></div>
              </dl>
            </div>
          }
        />
      </Suspense>
    </ErrorBoundary>}
  </>;
}
