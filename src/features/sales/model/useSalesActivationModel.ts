import { useState, useMemo, useEffect } from 'react';
import { useOperationalData } from '../../../lib/useOperationalData';
import { useFilters, extractOffernetFilters } from '../../../lib/FilterContext';
import { useClient } from '../../../lib/ClientContext';
import { fetchSalesActivation, type SalesActivationData } from '../../../lib/offernetClient';
import { useOperatingControls } from '../../../hooks/useOperatingControls';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';
import {
  adaptSalesActivationData,
  type AdaptedSalesActivation,
  type SegmentDimension,
  type AdaptedSegmentRow,
  type AdaptedAgeingBucket,
  formatWorkspaceCurrency,
} from './salesActivationAdapter';
import {
  exportSegmentAnalysis,
  exportAgeingAnalysis,
  exportSalesActivationWorkbook,
  type SalesExportScope,
} from './salesActivationExport';

export function useSalesActivationModel() {
  const { selectedClient, clientConfig } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const scoped = useScopedNavigationTarget();

  const [activeDimension, setActiveDimension] = useState<SegmentDimension>('vendor');
  const [segmentSearch, setSegmentSearch] = useState('');
  const [showAllSegments, setShowAllSegments] = useState(false);
  const [operatingControlsExpanded, setOperatingControlsExpanded] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [inspectorContent, setInspectorContent] = useState<InspectorContent | null>(null);

  // Invalidate contextual inspection whenever reporting scope changes
  useEffect(() => {
    setInspectorContent(null);
  }, [selectedClient, startDate, endDate, filters]);

  const scope = useMemo(() => ({
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
  }), [selectedClient, startDate, endDate, filters]);

  const salesQuery = useOperationalData<SalesActivationData>('SalesActivationPage', scope, fetchSalesActivation);

  // Load operating controls only on-demand when expanded by user
  const controls = useOperatingControls(operatingControlsExpanded);

  const rawData = salesQuery.data;
  const loading = salesQuery.loading;
  const error = salesQuery.error;

  const model: AdaptedSalesActivation | null = useMemo(() => {
    return adaptSalesActivationData(rawData, clientConfig?.currency);
  }, [rawData, clientConfig?.currency]);

  const exportScope: SalesExportScope = useMemo(() => ({
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    filters: filters || {},
    timezone: model?.methodology.timezone || clientConfig?.timezone,
    currency: model?.summary.currency || clientConfig?.currency,
  }), [selectedClient, startDate, endDate, filters, model?.methodology.timezone, model?.summary.currency, clientConfig]);

  const refreshAll = async () => {
    const refreshTasks: Promise<any>[] = [salesQuery.loadData(true)];
    if (operatingControlsExpanded) {
      refreshTasks.push(controls.refetch());
    }
    const results = await Promise.allSettled(refreshTasks);
    for (const res of results) {
      if (res.status === 'rejected') {
        console.error('Sales & activation refresh failed:', res.reason);
      }
    }
  };

  const handleInspectSummaryMetric = (metricKey: 'sales' | 'activations' | 'activationRatio' | 'unactivated' | 'revenue') => {
    if (!model) return;

    switch (metricKey) {
      case 'activationRatio':
        setInspectorContent({ type: 'metric', metricId: 'activation_rate', title: 'Activations / recorded sales', value: model.summary.activationRatio === null ? '—' : `${model.summary.activationRatio.toFixed(1)}%`, numeratorCount: model.summary.totalActivations, numeratorLabel: 'Recorded activations', denominatorCount: model.summary.totalSales, denominatorLabel: 'Recorded sales', definition: { meaning: 'Independent recorded activation population divided by the recorded sale population in the selected intake cohort.', calculation: 'Recorded activations / recorded sales × 100', limitations: ['This is an independent-count ratio, not a conditional sale-to-activation transition.'] }, scope: { clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined, filters }, reportPath: '/sales-activation', detailLimitation: 'No linked record population is inferred from this ratio. Use each outcome count to inspect its existing stage population.' });
        break;
      case 'sales':
        setInspectorContent({
          type: 'metric',
          title: 'Recorded sales',
          subtitle: 'Observed sale events in the selected intake cohort.',
          value: model.summary.totalSales.toLocaleString(),
          unit: 'sales',
          reportPath: '/sales-activation',
          reportLabel: 'Current sales & activation workspace',
          recordDrill: {
            drill: 'funnel-stage',
            drillValue: 'sales',
            label: 'Inspect recorded sales in Lead Explorer',
          },
          details: 'Counts distinct leads where is_sale = TRUE within the selected operational intake cohort. Does not assume every sale generates immediate revenue or has been invoiced.',
          scope: {
            clientId: selectedClient,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            filters,
          },
        });
        break;

      case 'activations':
        setInspectorContent({
          type: 'metric',
          title: 'Recorded activations',
          subtitle: 'Independent count of recorded activation timestamps in the selected cohort.',
          value: model.summary.totalActivations.toLocaleString(),
          unit: 'activations',
          reportPath: '/sales-activation',
          reportLabel: 'Current sales & activation workspace',
          recordDrill: {
            drill: 'funnel-stage',
            drillValue: 'activated',
            label: 'Inspect activated leads in Lead Explorer',
          },
          details: `Independent activation count: ${model.summary.totalActivations.toLocaleString()}. Current activation / sale ratio is ${model.summary.activationRatio !== null ? model.summary.activationRatio.toFixed(1) + '%' : '—'}. Note: activations are counted independently of sales; this is an independent-count ratio, not a conditional conversion claim.`,
          scope: {
            clientId: selectedClient,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            filters,
          },
        });
        break;

      case 'unactivated':
        setInspectorContent({
          type: 'metric',
          title: 'Sales without recorded activation',
          subtitle: 'Observed sale records that have no recorded activation timestamp.',
          value: model.summary.salesWithoutActivation !== null ? model.summary.salesWithoutActivation.toLocaleString() : '—',
          unit: 'unactivated sales',
          reportPath: '/sales-activation',
          reportLabel: 'Current sales & activation workspace',
          recordDrill: {
            drill: 'unactivated-sales',
            label: 'Inspect unactivated sales (>14 days) in Lead Explorer',
          },
          details: `Population: is_sale AND NOT is_activated. Valid pending ageing queue: ${model.summary.validPendingActivation?.toLocaleString() ?? '—'} leads. Invalid future sale timestamps: ${model.summary.invalidFutureSales.toLocaleString()} leads. Missing data is reported as unavailable, never assumed to be zero backlog.`,
          scope: {
            clientId: selectedClient,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            filters,
          },
        });
        break;

      case 'revenue':
        setInspectorContent({
          type: 'metric',
          title: 'Source-recorded revenue',
          subtitle: 'Sum of available source-system revenue values.',
          value: formatWorkspaceCurrency(model.summary.realizedRevenue, model.summary.currency),
          unit: model.summary.currency || 'revenue',
          reportPath: '/commercial',
          reportLabel: 'Open Spend & commercial workspace',
          details: `Revenue completeness context: ${model.summary.salesWithRecordedRevenue?.toLocaleString() ?? '—'} sales with recorded revenue; ${model.summary.unbilledSales.toLocaleString()} sales with recorded real zero; ${model.summary.unrecordedRevenueSales.toLocaleString()} sales missing revenue data. Source-recorded revenue does not certify billable, invoiced, collected, or earned revenue.`,
          scope: {
            clientId: selectedClient,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            filters,
          },
        });
        break;
    }
  };

  const handleInspectAgeingBucket = (bucket: AdaptedAgeingBucket) => {
    setInspectorContent({
      type: 'custom',
      title: `Age cohort: ${bucket.bucket}`,
      subtitle: bucket.description,
      value: `${bucket.sales.toLocaleString()} sales`,
      unit: 'unactivated sales',
      reportPath: '/sales-activation',
      reportLabel: 'Current sales & activation workspace',
      recordDrill: bucket.drillSupported && bucket.sales > 0 && bucket.drill ? {
        drill: bucket.drill,
        drillValue: bucket.drillValue,
        label: `Inspect ${bucket.bucket} unactivated sales in Lead Explorer`,
      } : undefined,
      detailLimitation: !bucket.drillSupported
        ? `Individual record drill is not supported for bucket "${bucket.bucket}". The Lead Explorer supports unactivated sales with age > 14 days and full funnel dropoff.`
        : undefined,
      details: bucket.isInvalidFuture
        ? 'Warning: These records have sale timestamps in the future relative to the evaluation cutoff. This indicates timestamp corruption or clock skew in the intake source.'
        : `Non-overlapping completed-day age bucket from recorded sale timestamp. Represents ${bucket.shareOfUnactivated !== null ? bucket.shareOfUnactivated.toFixed(1) + '%' : '—'} of observed unactivated sales.`,
      scope: {
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        filters,
      },
    });
  };

  const handleInspectSegmentRow = (row: AdaptedSegmentRow) => {
    const dimTitle = row.dimension.charAt(0).toUpperCase() + row.dimension.slice(1);
    const drillKey = `lifecycle-${row.dimension}`;

    setInspectorContent({
      type: 'segment',
      title: `${dimTitle}: ${row.name}`,
      subtitle: `Recorded outcomes for ${row.name} in selected operational intake cohort.`,
      value: `${row.sales.toLocaleString()} sales`,
      unit: 'outcomes',
      reportPath: '/sales-activation',
      reportLabel: 'Current sales & activation workspace',
      recordDrill: {
        drill: drillKey,
        drillValue: row.name,
        label: `Inspect leads for ${dimTitle} "${row.name}" in Lead Explorer`,
      },
      details: `Recorded sales: ${row.sales.toLocaleString()} • Recorded activations: ${row.activations.toLocaleString()} • Activation / sale ratio: ${row.activationRatio !== null ? row.activationRatio.toFixed(1) + '%' : '—'} • Source-recorded revenue: ${formatWorkspaceCurrency(row.revenue, model?.summary.currency)} • Revenue per sale: ${formatWorkspaceCurrency(row.revenuePerSale, model?.summary.currency)} • Sales missing revenue: ${row.unrecordedRevenueSales.toLocaleString()}.`,
      scope: {
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        filters,
      },
    });
  };

  const handleExportActiveSegments = () => {
    if (!model) return;
    exportSegmentAnalysis(
      activeDimension,
      model.segments[activeDimension],
      exportScope,
      model.methodology.segmentMethodology
    );
  };

  const handleExportAgeing = () => {
    if (!model) return;
    exportAgeingAnalysis(model, exportScope);
  };

  const handleExportCompleteWorkbook = () => {
    if (!model) return;
    exportSalesActivationWorkbook(model, activeDimension, exportScope);
  };

  return {
    model,
    rawData,
    loading,
    error,
    refreshAll,
    scope,
    exportScope,
    filters,
    scoped,
    activeDimension,
    setActiveDimension,
    segmentSearch,
    setSegmentSearch,
    showAllSegments,
    setShowAllSegments,
    operatingControlsExpanded,
    setOperatingControlsExpanded,
    aboutOpen,
    setAboutOpen,
    inspectorContent,
    setInspectorContent,
    controls,
    handleInspectSummaryMetric,
    handleInspectAgeingBucket,
    handleInspectSegmentRow,
    handleExportActiveSegments,
    handleExportAgeing,
    handleExportCompleteWorkbook,
  };
}
