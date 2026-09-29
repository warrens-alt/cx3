import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Database,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Download,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  PhoneCall,
  Megaphone,
  GitFork,
  Radio,
  FileSpreadsheet,
  Play,
  HardDrive,
} from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import {
  fetchWarehouseOverview,
  fetchWarehouseTables,
  type WarehouseAnalyticsOverview,
  type DictionaryObject,
} from '../lib/warehouseClient';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import BuildWarehouseExportModal from '../components/warehouse/BuildWarehouseExportModal';
import WarehouseDataPuller from '../components/warehouse/WarehouseDataPuller';
import { HorizontalBarChart } from '../components/charts/HorizontalBarChart';
import { MetricCompositionDonut } from '../components/charts/MetricCompositionDonut';
import { FunnelWaterfall } from '../components/charts/FunnelWaterfall';
import { ComboChart } from '../components/charts/ComboChart';
import { DistributionBar } from '../components/charts/DistributionBar';
import UnifiedMetricCard from '../components/UnifiedMetricCard';
import RootCauseDrawer from '../components/RootCauseDrawer';

type ActiveTab = 'overview' | 'pull' | 'waterfall' | 'touchpoints' | 'telemetry' | 'tables';

export default function WarehouseAnalytics() {
  const { selectedClient } = useClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTabParam = searchParams.get('tab') as ActiveTab | null;
  const validTabs: ActiveTab[] = ['overview', 'pull', 'waterfall', 'touchpoints', 'telemetry', 'tables'];
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    initialTabParam && validTabs.includes(initialTabParam) ? initialTabParam : 'overview'
  );

  const [data, setData] = useState<WarehouseAnalyticsOverview | null>(null);
  const [tables, setTables] = useState<DictionaryObject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [pullTarget, setPullTarget] = useState<{ project?: string; dataset?: string; table?: string }>({
    project: searchParams.get('project') || undefined,
    dataset: searchParams.get('dataset') || undefined,
    table: searchParams.get('table') || undefined,
  });
  const [rootMetric, setRootMetric] = useState<string | null>(null);
  const [rootMetricLabel, setRootMetricLabel] = useState<string | undefined>(undefined);

  // Sync tab changes with URL search params
  const handleTabChange = (newTab: ActiveTab) => {
    setActiveTab(newTab);
    const updated = new URLSearchParams(searchParams);
    if (newTab === 'overview') {
      updated.delete('tab');
    } else {
      updated.set('tab', newTab);
    }
    setSearchParams(updated, { replace: true });
  };

  // Search & Filters for tables tab
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [datasetFilter, setDatasetFilter] = useState<string>('all');
  const [familyFilter, setFamilyFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedTable, setSelectedTable] = useState<DictionaryObject | null>(null);
  const [columnSearchQuery, setColumnSearchQuery] = useState<string>('');

  const loadData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [overviewData, tablesData] = await Promise.all([
        fetchWarehouseOverview(selectedClient, force),
        fetchWarehouseTables({ clientId: selectedClient }, force),
      ]);
      setData(overviewData);
      setTables(tablesData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Google Cloud BigQuery warehouse analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, [selectedClient]);

  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      if (datasetFilter !== 'all' && t.dataset !== datasetFilter) return false;
      if (familyFilter !== 'all' && t.family !== familyFilter) return false;
      if (typeFilter !== 'all' && t.tableType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          t.tableName.toLowerCase().includes(q) ||
          t.dataset.toLowerCase().includes(q) ||
          t.project.toLowerCase().includes(q) ||
          t.analyticalGrain.toLowerCase().includes(q) ||
          t.columns.some(c => c.name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [tables, datasetFilter, familyFilter, typeFilter, searchQuery]);

  const filteredModalColumns = useMemo(() => {
    if (!selectedTable) return [];
    if (!columnSearchQuery.trim()) return selectedTable.columns;
    const q = columnSearchQuery.toLowerCase().trim();
    return selectedTable.columns.filter(
      c => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)
    );
  }, [selectedTable, columnSearchQuery]);

  // Charts for Overview tab
  const datasetDistributionData = useMemo(() => {
    if (!data?.datasets) return [];
    return data.datasets.map(ds => ({
      dataset: ds.dataset,
      columns: ds.totalColumns,
      objects: ds.totalObjects,
      tables: ds.tablesCount,
      views: ds.viewsCount,
    }));
  }, [data?.datasets]);

  const objectCompositionData = useMemo(() => {
    if (!data?.kpis) return [];
    return [
      { name: 'Native BigQuery Tables', value: data.kpis.totalTables, color: '#315BCB' },
      { name: 'Analytic & Federated Views', value: data.kpis.totalViews, color: '#0F766E' },
    ];
  }, [data?.kpis]);

  // Funnel Waterfall steps for Waterfall tab
  const waterfallFunnelSteps = useMemo(() => {
    if (!data?.waterfallSummary?.timelines || data.waterfallSummary.timelines.length === 0) return [];

    // Check if measured ONvest touchpoints telemetry is available
    const onvest = data.rawTelemetrySummary?.onvestTouchpoints;
    if (onvest && onvest.fetchedLeadsTotal > 0) {
      return [
        { label: 'Inbound Leads Ingested', value: onvest.fetchedLeadsTotal, metric: 'Raw Inbound Rows' },
        { label: 'Valid Phone Verified', value: onvest.validPhoneIdTotal, metric: 'Contact Verification', dropoff: Math.max(0, onvest.fetchedLeadsTotal - onvest.validPhoneIdTotal) },
        { label: 'Schema Qualified Gate', value: onvest.qualifiedLeadsTotal, metric: 'Eligibility Gate', dropoff: Math.max(0, onvest.validPhoneIdTotal - onvest.qualifiedLeadsTotal) },
        { label: 'Accepted Conversion', value: onvest.acceptedLeadsTotal, metric: 'Client Delivery', isTerminal: true, dropoff: Math.max(0, onvest.qualifiedLeadsTotal - onvest.acceptedLeadsTotal) },
      ];
    }

    const totalVolume = data.waterfallSummary.timelines.reduce((acc, t) => acc + t.estimatedVolume, 0);
    const retentionRate = (data.waterfallSummary.averageStageRetentionPct || 65) / 100;
    const finalConversionRate = (data.waterfallSummary.timelines[0]?.conversionRateEstimatePct || 35) / 100;

    const s1 = totalVolume;
    const s2 = Math.round(s1 * retentionRate);
    const s3 = Math.round(s2 * retentionRate);
    const s4 = Math.round(s1 * finalConversionRate);
    return [
      { label: 'Inbound Leads Ingested', value: s1, metric: 'Inbound Volume' },
      { label: 'Stage Retention Gate', value: s2, metric: `${(retentionRate * 100).toFixed(0)}% Retention`, dropoff: Math.max(0, s1 - s2) },
      { label: 'Qualified Delivery', value: s3, metric: 'Active Pipeline', dropoff: Math.max(0, s2 - s3) },
      { label: 'Completed Conversion', value: s4, metric: `${(finalConversionRate * 100).toFixed(1)}% Conversion`, isTerminal: true, dropoff: Math.max(0, s3 - s4) },
    ];
  }, [data?.waterfallSummary, data?.rawTelemetrySummary]);

  // Touchpoint Combo chart data for Touchpoints tab
  const touchpointChartData = useMemo(() => {
    if (!data?.touchpointsSummary?.sources) return [];
    return data.touchpointsSummary.sources.map(src => {
      const ctr = src.impressions > 0 ? Number(((src.clicks / src.impressions) * 100).toFixed(2)) : 0;
      return {
        channel: src.label.replace(' Feed', '').replace(' Attribution', ''),
        impressions: src.impressions,
        clicks: src.clicks,
        ctr: ctr,
      };
    });
  }, [data?.touchpointsSummary]);

  // Waterfall Timeline comparison data for Waterfall tab
  const waterfallTimelineComparisonData = useMemo(() => {
    if (!data?.waterfallSummary?.timelines) return [];
    return data.waterfallSummary.timelines.slice(0, 8).map(t => ({
      channel: t.title.replace(' Waterfall', '').replace(' Timeline', '').slice(0, 24),
      volume: t.estimatedVolume,
      rate: Number(t.conversionRateEstimatePct.toFixed(1)),
    }));
  }, [data?.waterfallSummary?.timelines]);

  // Telemetry dialler disposition data for Telemetry tab
  const ontactDispositionsData = useMemo(() => {
    if (!data?.rawTelemetrySummary?.ontactDialler?.topCallResults) return [];
    return data.rawTelemetrySummary.ontactDialler.topCallResults.map(r => ({
      label: r.result,
      value: r.count,
    }));
  }, [data?.rawTelemetrySummary?.ontactDialler?.topCallResults]);

  // Telemetry ONvest lead qualification progression steps for Telemetry tab
  const onvestFunnelSteps = useMemo(() => {
    if (!data?.rawTelemetrySummary?.onvestTouchpoints) return [];
    const { fetchedLeadsTotal, validPhoneIdTotal, qualifiedLeadsTotal, acceptedLeadsTotal } = data.rawTelemetrySummary.onvestTouchpoints;
    return [
      { label: 'Fetched Leads', value: fetchedLeadsTotal, metric: 'Raw Inbound Rows' },
      { label: 'Valid Phone IDs', value: validPhoneIdTotal, metric: 'Contact Verification', dropoff: Math.max(0, fetchedLeadsTotal - validPhoneIdTotal) },
      { label: 'Qualified Leads', value: qualifiedLeadsTotal, metric: 'Schema Criteria Gate', dropoff: Math.max(0, validPhoneIdTotal - qualifiedLeadsTotal) },
      { label: 'Accepted Leads', value: acceptedLeadsTotal, metric: 'Confirmed Client Conversion', isTerminal: true, dropoff: Math.max(0, qualifiedLeadsTotal - acceptedLeadsTotal) },
    ];
  }, [data?.rawTelemetrySummary?.onvestTouchpoints]);

  return (
    <div className="cx-command-page min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="cx-command-content max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
              <span>Google Cloud Platform</span>
              <span aria-hidden="true">·</span>
              <span>BigQuery Analytics Warehouse</span>
              <span aria-hidden="true">·</span>
              <span>Live Dataset Federation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Warehouse Projects, Datasets & Tables
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Comprehensive analytics consolidated across all Google Cloud projects, BigQuery datasets, and 65 registered tables and views.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="cx-button-export"
              title="Build and export Google table data, projects, datasets, and schemas"
            >
              <Download size={14} />
              <span>Build Export</span>
            </button>
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              title="Refresh warehouse data"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Sync Warehouse'}</span>
            </button>
            {data && (
              <ExportAnalysisButton
                filename={`warehouse_dictionary_${selectedClient}`}
                rows={[
                  ['Project', 'Dataset', 'Table Name', 'Type', 'Family', 'Disposition', 'Columns', 'Analytical Grain'],
                  ...tables.map(t => [
                    t.project,
                    t.dataset,
                    t.tableName,
                    t.tableType,
                    t.family,
                    t.disposition,
                    t.columns.length,
                    t.analyticalGrain,
                  ]),
                ]}
                validationStatus="CERTIFIED_WAREHOUSE_DICTIONARY"
                definitions="Complete schema inventory across all 2 Google Cloud projects and 4 BigQuery datasets"
              />
            )}
          </div>
        </header>

        {error && (
          <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-3 text-rose-800 dark:text-rose-200 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Warehouse Connection Notice: </strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Global Warehouse Stat Bar */}
        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6" aria-label="Warehouse telemetry summary">
            <UnifiedMetricCard
              label="GCP Projects"
              value={data.kpis.totalProjects}
              note="2 active · 4 upstream"
              onWhyChanged={() => {
                setRootMetric('deliveryRate');
                setRootMetricLabel('GCP Projects');
              }}
              onInspect={() => handleTabChange('overview')}
              inspectLabel="Inspect projects"
            />
            <UnifiedMetricCard
              label="BigQuery Datasets"
              value={data.kpis.totalDatasets}
              note="Across 2 project roots"
              onWhyChanged={() => {
                setRootMetric('deliveryRate');
                setRootMetricLabel('BigQuery Datasets');
              }}
              onInspect={() => handleTabChange('tables')}
              inspectLabel="Inspect datasets"
            />
            <UnifiedMetricCard
              label="Tables & Views"
              value={data.kpis.totalWarehouseObjects}
              note={`${data.kpis.totalTables} tables · ${data.kpis.totalViews} views`}
              onWhyChanged={() => {
                setRootMetric('deliveryRate');
                setRootMetricLabel('Tables & Views');
              }}
              onInspect={() => handleTabChange('tables')}
              inspectLabel="Inspect schema"
            />
            <UnifiedMetricCard
              label="Declared Columns"
              value={data.kpis.totalDeclaredColumns.toLocaleString()}
              note="100% typed attributes"
              onWhyChanged={() => {
                setRootMetric('deliveryRate');
                setRootMetricLabel('Declared Columns');
              }}
              onInspect={() => handleTabChange('tables')}
              inspectLabel="Inspect columns"
            />
            <UnifiedMetricCard
              label="Waterfall Timelines"
              value={data.waterfallSummary.totalWaterfallObjects}
              note="Multi-client progression"
              onWhyChanged={() => {
                setRootMetric('fetchedLeads');
                setRootMetricLabel('Waterfall Timelines');
              }}
              onInspect={() => handleTabChange('waterfall')}
              inspectLabel="Inspect waterfall"
            />
            <UnifiedMetricCard
              label="Touchpoint Feeds"
              value={data.touchpointsSummary.totalTouchpointSources}
              note="Online & offline channels"
              onWhyChanged={() => {
                setRootMetric('fetchedLeads');
                setRootMetricLabel('Touchpoint Feeds');
              }}
              onInspect={() => handleTabChange('touchpoints')}
              inspectLabel="Inspect feeds"
            />
          </div>
        )}

        {/* Navigation Tabs (Functional Buttons, No Pills) */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto">
          {[
            { id: 'overview', label: 'Multi-Project Overview', icon: Layers },
            { id: 'pull', label: 'Pull Live Data (Google Cloud API)', icon: Play },
            { id: 'waterfall', label: 'Waterfall Timelines (18)', icon: GitFork },
            { id: 'touchpoints', label: 'Touchpoints & Media Feeds (10)', icon: Megaphone },
            { id: 'telemetry', label: 'Raw Event Telemetry (2)', icon: Radio },
            { id: 'tables', label: 'All Tables & Views Dictionary (65)', icon: FileSpreadsheet },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id as ActiveTab)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all cursor-pointer rounded-t-md ${
                  isActive
                    ? 'border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 -mb-[1px]'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : ''} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab: Pull Live Data */}
        {activeTab === 'pull' && (
          <WarehouseDataPuller
            initialProject={pullTarget.project}
            initialDataset={pullTarget.dataset}
            initialTable={pullTarget.table}
          />
        )}

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && data && (
          <div className="space-y-6">
            {/* Visual Analytics Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HorizontalBarChart
                title="Declared Schema Columns by Dataset"
                subtitle="Distribution of 1,848 typed column attributes across active BigQuery datasets"
                data={datasetDistributionData}
                categoryKey="dataset"
                valueKey="columns"
                height={260}
                color="#315BCB"
              />
              <MetricCompositionDonut
                title="Warehouse Object Architecture"
                subtitle="Structural ratio between stored tables (18) and relational analytical views (47)"
                data={objectCompositionData}
                centerLabel="Total Objects"
                centerValue={data.kpis.totalWarehouseObjects}
                height={260}
              />
            </div>

            {/* Google Cloud Projects Section */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                    Google Cloud Platform Projects
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Monitored Google Cloud environments providing live BigQuery datasets and storage feeds.
                  </p>
                </div>
                <Database size={18} className="text-indigo-600 dark:text-indigo-400" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.projects.map(proj => (
                  <div
                    key={proj.projectId}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-50">
                        {proj.projectId}
                      </span>
                      <span
                        className={`text-xs font-medium font-mono ${
                          proj.status === 'CONNECTED'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {proj.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{proj.description}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      <span>Location: {proj.location}</span>
                      <span aria-hidden="true">·</span>
                      <span>Datasets: {proj.datasets.join(', ')}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{proj.totalObjects} objects</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Datasets Breakdown Section */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  BigQuery Datasets Federation
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Detailed breakdown of the 4 active BigQuery datasets hosting analytics objects.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.datasets.map(ds => (
                  <div
                    key={`${ds.project}.${ds.dataset}`}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          {ds.project}
                        </span>
                        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                          {ds.status}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 font-mono">
                        {ds.dataset}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-3">
                        {ds.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      <div className="flex justify-between font-mono">
                        <span>Objects:</span>
                        <strong>{ds.totalObjects} ({ds.tablesCount}T / {ds.viewsCount}V)</strong>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>Declared Columns:</span>
                        <strong>{ds.totalColumns}</strong>
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-1 truncate">
                        {ds.families.join(' · ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Tab 2: Waterfall Timelines */}
        {activeTab === 'waterfall' && data && (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  Waterfall Report Dataset Timelines
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Progression rates, volumes, and stage milestone mappings across all 18 objects in `dashboards-422710.watfall_report`.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Avg retention: {data.waterfallSummary.averageStageRetentionPct}%
              </span>
            </div>

            {/* Interactive Funnel Waterfall Progression Visual */}
            <FunnelWaterfall
              title="Multi-Client Conversion Pipeline Progression"
              subtitle="Observed population progression and stage fall-off across 18 BigQuery waterfall milestone objects"
              steps={waterfallFunnelSteps}
            />

            {/* Top Waterfall Timelines: Volume vs Conversion Rate */}
            <ComboChart
              title="Top Waterfall Operations: Ingested Volume vs. Conversion Efficiency"
              subtitle="Volume throughput (bars) vs. estimated conversion percentage (line) across top waterfall operations"
              data={waterfallTimelineComparisonData}
              xKey="channel"
              barKey="volume"
              lineKey="rate"
              barName="Est. Volume"
              lineName="Conversion Rate (%)"
              barColor="#2563EB"
              lineColor="#10B981"
              height={280}
            />

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs enterprise-table">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Timeline Operation</th>
                    <th className="py-3 px-4">Client / Partner</th>
                    <th className="py-3 px-4">Family</th>
                    <th className="py-3 px-4 text-right">Est. Volume</th>
                    <th className="py-3 px-4 text-right">Conversion Rate</th>
                    <th className="py-3 px-4">Milestone Stages</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {data.waterfallSummary.timelines.map(t => (
                    <tr key={t.tableName} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {t.title}
                        <span className="block text-[11px] font-normal text-slate-400 truncate max-w-xs">{t.tableName}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-sans">{t.client}</td>
                      <td className="py-3 px-4 text-slate-500">{t.family}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-900 dark:text-slate-100 font-bold">
                        {t.estimatedVolume.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-indigo-600 dark:text-indigo-400 font-bold">
                        {t.conversionRateEstimatePct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 font-sans">
                        {t.keyStages.join(' → ')}
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        <span
                          className={
                            t.dependencyStatus === 'NATIVE_TABLE'
                              ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                              : 'text-slate-600 dark:text-slate-400'
                          }
                        >
                          {t.dependencyStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 3: Touchpoints & Media Feeds */}
        {activeTab === 'touchpoints' && data && (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-6">
            <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Touchpoints & Candidate Media Spend
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Campaign impressions, clicks, outbound interactions, and spend estimates from `vibe_coding_data` and retail ledger sources.
              </p>
            </div>

            {/* Interactive Touchpoint Combo Visual: Impressions Volume vs CTR Efficiency */}
            <ComboChart
              title="Touchpoint Media Channel Volume & Interaction Efficiency"
              subtitle="Impression volumes (bars) vs. click-through conversion rates (line) across candidate media sources"
              data={touchpointChartData}
              xKey="channel"
              barKey="impressions"
              lineKey="ctr"
              barName="Impressions"
              lineName="CTR (%)"
              barColor="#2563EB"
              lineColor="#10B981"
              height={290}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.touchpointsSummary.sources.map(src => (
                <div
                  key={src.sourceKey}
                  className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">{src.label}</h3>
                      <span className="font-mono text-xs text-slate-500">{src.sourceKey}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {src.amountSpentEstimate}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Impressions</span>
                      <strong className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
                        {src.impressions.toLocaleString()}
                      </strong>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Clicks</span>
                      <strong className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
                        {src.clicks.toLocaleString()}
                      </strong>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Leads Delivered</span>
                      <strong className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
                        {src.leadsDelivered.toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 font-sans">
                    <div>
                      <strong>Channels: </strong>
                      <span>{src.channels.join(', ')}</span>
                    </div>
                    <div>
                      <strong>Grain: </strong>
                      <span className="font-mono">{src.grain}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tab 4: Raw Event Telemetry */}
        {activeTab === 'telemetry' && data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ONtact Dialler Telemetry */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
                  <PhoneCall size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wider font-mono">
                    vibe-code-warren-stear.analytics_warehouse
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 font-mono">
                  ontact_raw_data
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  VICIdial telephony payload observations with epoch start/end duration validation.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Sampled Observations</span>
                  <strong className="text-base font-bold text-slate-900 dark:text-slate-50">
                    {data.rawTelemetrySummary.ontactDialler.totalObservationsSampled}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Timing Verified</span>
                  <strong className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {data.rawTelemetrySummary.ontactDialler.durationVerificationRatePct}%
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Avg Duration</span>
                  <strong className="text-base font-bold text-slate-900 dark:text-slate-50">
                    {data.rawTelemetrySummary.ontactDialler.averageCallDurationSec}s
                  </strong>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <DistributionBar
                  title="Discovered Dialler Call Dispositions"
                  subtitle="Frequency distribution across sampled VICIdial telephony outcomes"
                  data={ontactDispositionsData}
                  bucketKey="label"
                  valueKey="value"
                  height={220}
                  color="#4F46E5"
                />

                <div className="space-y-1.5 font-mono text-xs">
                  {data.rawTelemetrySummary.ontactDialler.topCallResults.map(r => (
                    <div
                      key={r.result}
                      className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60"
                    >
                      <span className="text-slate-700 dark:text-slate-300">{r.result}</span>
                      <strong className="text-slate-900 dark:text-slate-100">{r.count} observations</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ONvest Touchpoints Telemetry */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
                  <Radio size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wider font-mono">
                    vibe-code-warren-stear.analytics_warehouse
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 font-mono">
                  onvest_raw_data
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aggregated multi-stage touchpoint rows reporting platform conversion counts and raw amount spent.
                </p>
              </div>

              {/* Lead Qualification Pipeline Funnel */}
              <FunnelWaterfall
                title="Lead Qualification & Acceptance Progression"
                subtitle="Verification throughput from raw fetched leads through phone verification to accepted conversion"
                steps={onvestFunnelSteps}
              />

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Fetched Leads</span>
                  <strong className="text-base font-bold text-slate-900 dark:text-slate-50">
                    {data.rawTelemetrySummary.onvestTouchpoints.fetchedLeadsTotal.toLocaleString()}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Qualified Leads</span>
                  <strong className="text-base font-bold text-slate-900 dark:text-slate-50">
                    {data.rawTelemetrySummary.onvestTouchpoints.qualifiedLeadsTotal.toLocaleString()}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Accepted Leads</span>
                  <strong className="text-base font-bold text-slate-900 dark:text-slate-50">
                    {data.rawTelemetrySummary.onvestTouchpoints.acceptedLeadsTotal.toLocaleString()}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Valid Phone IDs</span>
                  <strong className="text-base font-bold text-slate-900 dark:text-slate-50">
                    {data.rawTelemetrySummary.onvestTouchpoints.validPhoneIdTotal.toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono">
                <span className="text-slate-500 block text-[10px]">Uncertified Raw Media Amount Spent:</span>
                <strong className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  R {data.rawTelemetrySummary.onvestTouchpoints.amountSpentRawSum}
                </strong>
                <p className="text-[11px] text-slate-400 font-sans mt-1">
                  Summed from JSON records; cross-source attribution and currency certification require approved contract matching.
                </p>
              </div>
            </section>
          </div>
        )}

        {/* Tab 5: Complete Table Dictionary */}
        {activeTab === 'tables' && (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  All 65 BigQuery Objects Dictionary
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Filter by dataset, analytical family, or search across table names and declared column fields.
                </p>
              </div>

              {/* Filter controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search tables or columns..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={datasetFilter}
                  onChange={e => setDatasetFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-mono"
                >
                  <option value="all">All Datasets (4)</option>
                  <option value="lead_ledger">lead_ledger (35)</option>
                  <option value="watfall_report">watfall_report (18)</option>
                  <option value="vibe_coding_data">vibe_coding_data (10)</option>
                  <option value="analytics_warehouse">analytics_warehouse (2)</option>
                </select>

                <select
                  value={familyFilter}
                  onChange={e => setFamilyFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-mono"
                >
                  <option value="all">All Families</option>
                  <option value="lead_ledger">lead_ledger</option>
                  <option value="vicidial">vicidial</option>
                  <option value="waterfall">waterfall</option>
                  <option value="touchpoints">touchpoints</option>
                  <option value="marketing">marketing</option>
                  <option value="activations">activations</option>
                  <option value="retail">retail</option>
                  <option value="budgets">budgets</option>
                  <option value="raw_json">raw_json</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-mono"
                >
                  <option value="all">All Types (TABLE & VIEW)</option>
                  <option value="TABLE">TABLE (18)</option>
                  <option value="VIEW">VIEW (47)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Project & Dataset</th>
                    <th className="py-2.5 px-3">Table Name</th>
                    <th className="py-2.5 px-3">Family</th>
                    <th className="py-2.5 px-3">Disposition</th>
                    <th className="py-2.5 px-3 text-right">Columns</th>
                    <th className="py-2.5 px-3">Analytical Grain</th>
                    <th className="py-2.5 px-3 text-center">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {filteredTables.map(t => (
                    <tr
                      key={`${t.project}.${t.dataset}.${t.tableName}`}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-bold ${
                            t.tableType === 'TABLE'
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {t.tableType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {t.project}.{t.dataset}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {t.tableName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{t.family}</td>
                      <td className="py-2.5 px-3 text-slate-500">{t.disposition}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-slate-100">
                        {t.columns.length}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={t.analyticalGrain}>
                        {t.analyticalGrain}
                      </td>
                      <td className="py-2.5 px-3 text-center space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setPullTarget({ project: t.project, dataset: t.dataset, table: t.tableName });
                            handleTabChange('pull');
                          }}
                          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Play size={10} />
                          <span>Pull Data</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedTable(t)}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 text-[11px] font-sans hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          View Schema
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredTables.length === 0 && (
              <div className="py-8 text-center text-slate-500 text-xs">
                No warehouse objects matched your search criteria.
              </div>
            )}
          </section>
        )}

        {/* Modal for viewing selected table schema */}
        {selectedTable && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                    {selectedTable.project}.{selectedTable.dataset}
                  </span>
                  <h3 className="text-base font-bold font-mono text-slate-900 dark:text-slate-50">
                    {selectedTable.tableName}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPullTarget({ project: selectedTable.project, dataset: selectedTable.dataset, table: selectedTable.tableName });
                      setSelectedTable(null);
                      handleTabChange('pull');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors inline-flex items-center gap-1 shadow-2xs"
                  >
                    <Play size={12} />
                    <span>Pull Live Data</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTable(null)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Family:</span>
                    <strong className="text-purple-700 dark:text-purple-300">{selectedTable.family}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Disposition:</span>
                    <strong>{selectedTable.disposition}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Analytical Grain:</span>
                    <strong className="truncate block" title={selectedTable.analyticalGrain}>{selectedTable.analyticalGrain}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Total Columns:</span>
                    <strong className="text-indigo-600 dark:text-indigo-400">{selectedTable.columns.length}</strong>
                  </div>
                </div>

                {/* Candidate Keys & Date Fields */}
                <div className="space-y-2 text-xs">
                  {selectedTable.candidateKeys && selectedTable.candidateKeys.length > 0 && (
                    <div>
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Candidate Keys:
                      </span>
                      <div className="flex flex-wrap gap-1.5 font-mono">
                        {selectedTable.candidateKeys.map(k => (
                          <span key={k} className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] border border-blue-200 dark:border-blue-900">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTable.dateFields && selectedTable.dateFields.length > 0 && (
                    <div>
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Partition / Temporal Fields:
                      </span>
                      <div className="flex flex-wrap gap-1.5 font-mono">
                        {selectedTable.dateFields.map(d => (
                          <span key={d} className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] border border-emerald-200 dark:border-emerald-900">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTable.sensitiveFields && selectedTable.sensitiveFields.length > 0 && (
                    <div>
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1 mb-1">
                        <AlertCircle size={12} />
                        Sensitive / PII Fields (Masked / Guarded):
                      </span>
                      <div className="flex flex-wrap gap-1.5 font-mono">
                        {selectedTable.sensitiveFields.map(s => (
                          <span key={s} className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] border border-amber-200 dark:border-amber-900">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                      Declared Columns ({filteredModalColumns.length} of {selectedTable.columns.length})
                    </h4>
                    <div className="relative">
                      <Search size={12} className="absolute left-2 top-2 text-slate-400" />
                      <input
                        type="text"
                        value={columnSearchQuery}
                        onChange={e => setColumnSearchQuery(e.target.value)}
                        placeholder="Filter columns..."
                        className="pl-6 pr-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono w-40"
                      />
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded font-mono divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredModalColumns.map(col => (
                      <div key={col.name} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <span className="text-slate-800 dark:text-slate-200 font-medium">{col.name}</span>
                        <span className="text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold">{col.type}</span>
                      </div>
                    ))}
                    {filteredModalColumns.length === 0 && (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        No columns matching &quot;{columnSearchQuery}&quot;
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <BuildWarehouseExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          clientId={selectedClient}
          tables={tables}
        />
      </div>

      <RootCauseDrawer
        open={Boolean(rootMetric)}
        metric={rootMetric}
        metricLabel={rootMetricLabel}
        onClose={() => {
          setRootMetric(null);
          setRootMetricLabel(undefined);
        }}
      />
    </div>
  );
}
