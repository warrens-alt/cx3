import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  PhoneCall,
  ShieldCheck,
  FileText,
  Filter,
  Search,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  TrendingUp,
  X,
  ExternalLink,
  Download,
  ArrowUpDown,
  BookOpen,
  ArrowUp,
  ArrowDown,
  BarChart3,
  Layers,
} from 'lucide-react';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import { useOperationalData } from '../lib/useOperationalData';
import {
  GroupedOutcomeChart,
  VolumeRateComboChart,
  HorizontalStackedOutcomeChart,
} from '../components/charts/OperationalVisuals';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { useAuth } from '../lib/AuthContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import {
  fetchContactStrategy,
  fetchContactDispositions,
  type ContactStrategyData,
  type ContactDispositionsData,
} from '../lib/offernetClient';
import { formatPercent, formatTableNumber } from '../lib/formatters';
import {
  downloadDispositionExportCsv,
  type DispositionExportMetadata,
} from '../lib/analysisExport';
import {
  APPROVED_DISPOSITION_GROUPS,
  DISPOSITION_REPORT_VERSION,
  type ApprovedDispositionGroup,
  type DispositionReportingMode,
} from '../../contracts/vendorDispositions';

const OUTCOME_GROUPS_ORDER: ApprovedDispositionGroup[] = [
  'REPORTED_SALE',
  'CONTACTED_RPC',
  'CALLBACK_REQUESTED',
  'NOT_INTERESTED',
  'NO_ANSWER',
  'BUSY',
  'VOICEMAIL',
  'INVALID_WRONG_NUMBER',
  'DO_NOT_CONTACT',
  'TECHNICAL_FAILURE',
  'OTHER',
  'UNMAPPED',
  'MISSING_DISPOSITION',
  'CONFLICTING_EVIDENCE',
];

export default function ContactStrategyIntelligence() {
  const { selectedClient, clientConfig } = useClient();
  const { user, profile, isAdmin } = useAuth();
  const { startDate, endDate, filters } = useFilters();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const modeParam = searchParams.get('mode');
  const vendorParam = searchParams.get('vendor');
  const groupParam = searchParams.get('group');

  const [activeTab, setActiveTab] = useState<'call_counts' | 'vendor_dispositions'>(
    tabParam === 'vendor_dispositions' ? 'vendor_dispositions' : 'call_counts'
  );
  const [dispositionMode, setDispositionMode] = useState<DispositionReportingMode>(
    modeParam === 'call_records' ? 'call_records' : 'lead_status'
  );
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>(vendorParam || 'ALL');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>(groupParam || 'ALL');
  const [selectedVendorDrawer, setSelectedVendorDrawer] = useState<string | null>(
    vendorParam && vendorParam !== 'ALL' ? vendorParam : null
  );
  const [aboutDrawerOpen, setAboutDrawerOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [drawerSearchQuery, setDrawerSearchQuery] = useState<string>('');
  const [drawerGroupFilter, setDrawerGroupFilter] = useState<string>('ALL');
  const [chartViewMode, setChartViewMode] = useState<'count' | 'percent'>('percent');
  const [showAllVendors, setShowAllVendors] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<string>('totalPopulation');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Sync state with URL params
  useEffect(() => {
    if (tabParam === 'vendor_dispositions' && activeTab !== 'vendor_dispositions') {
      setActiveTab('vendor_dispositions');
    } else if (tabParam !== 'vendor_dispositions' && !tabParam && activeTab !== 'call_counts') {
      // Default to call_counts if unset
    }
  }, [tabParam, activeTab]);

  useEffect(() => {
    if (modeParam === 'call_records' && dispositionMode !== 'call_records') {
      setDispositionMode('call_records');
    } else if (modeParam === 'lead_status' && dispositionMode !== 'lead_status') {
      setDispositionMode('lead_status');
    }
  }, [modeParam, dispositionMode]);

  useEffect(() => {
    if (vendorParam && vendorParam !== 'ALL' && vendorParam !== selectedVendorFilter) {
      setSelectedVendorFilter(vendorParam);
      setSelectedVendorDrawer(vendorParam);
    }
  }, [vendorParam, selectedVendorFilter]);

  const updateUrlParams = (updates: Partial<{ tab: string; mode: string; vendor: string; group: string }>) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (updates.tab !== undefined) {
          if (updates.tab === 'call_counts') next.delete('tab');
          else next.set('tab', updates.tab);
        }
        if (updates.mode !== undefined) {
          if (updates.mode === 'lead_status') next.delete('mode');
          else next.set('mode', updates.mode);
        }
        if (updates.vendor !== undefined) {
          if (!updates.vendor || updates.vendor === 'ALL') next.delete('vendor');
          else next.set('vendor', updates.vendor);
        }
        if (updates.group !== undefined) {
          if (!updates.group || updates.group === 'ALL') next.delete('group');
          else next.set('group', updates.group);
        }
        return next;
      },
      { replace: true }
    );
  };

  const handleTabChange = (tab: 'call_counts' | 'vendor_dispositions') => {
    setActiveTab(tab);
    updateUrlParams({ tab });
  };

  const handleModeChange = (mode: DispositionReportingMode) => {
    setDispositionMode(mode);
    updateUrlParams({ mode, vendor: 'ALL', group: 'ALL' });
  };

  const handleSelectVendorForDrawer = (vendor: string | null) => {
    setSelectedVendorDrawer(vendor);
    setDrawerSearchQuery('');
    setDrawerGroupFilter('ALL');
    updateUrlParams({ vendor: vendor || 'ALL' });
  };

  const handleChartDrillDown = (vendor: string, groupCode?: string) => {
    setSelectedVendorFilter(vendor);
    setSelectedVendorDrawer(vendor);
    if (groupCode) {
      setSelectedGroupFilter(groupCode);
      setDrawerGroupFilter(groupCode);
      updateUrlParams({ vendor, group: groupCode });
    } else {
      updateUrlParams({ vendor });
    }
  };

  // Call-count outcomes data (Preserved)
  const {
    data: callCountData,
    loading: callCountLoading,
    error: callCountError,
    loadData: reloadCallCountData,
  } = useOperationalData<
    Omit<ContactStrategyData, 'summary' | 'attemptPerformance'> & {
      attemptPerformance: Array<
        ContactStrategyData['attemptPerformance'][number] & { noRpc?: number; rpcUnrecorded?: number }
      >;
      summary?: ContactStrategyData['summary'] & { oneCallNoRpcLeads?: number; zeroCallNoRpcLeads?: number };
      effortEvidence?: { reason: string };
    }
  >(
    'ContactStrategyIntelligence',
    {
      clientId: selectedClient,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      ...extractOffernetFilters(filters),
    },
    fetchContactStrategy
  );

  // Vendor dispositions data
  const {
    data: dispData,
    loading: dispLoading,
    error: dispError,
    loadData: reloadDispData,
  } = useOperationalData<ContactDispositionsData>(
    `ContactDispositionsIntelligence-${dispositionMode}`,
    {
      clientId: selectedClient,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      mode: dispositionMode,
      ...extractOffernetFilters(filters),
    },
    fetchContactDispositions
  );

  // Drawer accessibility hooks
  const vendorDrawerRef = useDialogAccessibility<HTMLElement>(
    Boolean(selectedVendorDrawer),
    () => handleSelectVendorForDrawer(null)
  );
  const aboutDrawerRef = useDialogAccessibility<HTMLElement>(aboutDrawerOpen, () => setAboutDrawerOpen(false));

  // Unique vendors for filter dropdown
  const vendorOptions = useMemo(() => {
    if (!dispData?.vendorSummaries) return [];
    return dispData.vendorSummaries.map((v) => v.vendor);
  }, [dispData]);

  // Selected vendor summary and breakdown
  const selectedVendorSummary = useMemo(() => {
    if (!selectedVendorDrawer || !dispData?.vendorSummaries) return null;
    return dispData.vendorSummaries.find((v) => v.vendor === selectedVendorDrawer) || null;
  }, [selectedVendorDrawer, dispData]);

  const selectedVendorBreakdown = useMemo(() => {
    if (!selectedVendorDrawer || !dispData?.breakdown) return [];
    return dispData.breakdown.filter((r) => r.vendor === selectedVendorDrawer);
  }, [selectedVendorDrawer, dispData]);

  const filteredDrawerBreakdown = useMemo(() => {
    return selectedVendorBreakdown.filter((row) => {
      if (drawerGroupFilter !== 'ALL' && row.approvedGroup !== drawerGroupFilter) return false;
      if (drawerSearchQuery.trim()) {
        const q = drawerSearchQuery.toLowerCase().trim();
        const matchesCode = row.rawDisposition.toLowerCase().includes(q);
        const matchesDesc = row.rawDescription.toLowerCase().includes(q);
        const matchesGroup = row.approvedGroupLabel.toLowerCase().includes(q);
        if (!matchesCode && !matchesDesc && !matchesGroup) return false;
      }
      return true;
    });
  }, [selectedVendorBreakdown, drawerGroupFilter, drawerSearchQuery]);

  // Group breakdown by vendor + approvedGroup for Horizontal Stacked Bar Chart
  const { chartRows, activeGroups } = useMemo(() => {
    if (!dispData?.vendorSummaries || !dispData?.breakdown) {
      return { chartRows: [], activeGroups: [] };
    }

    const vendorGroupTotals = new Map<string, Map<ApprovedDispositionGroup, number>>();
    const presentGroupsSet = new Set<ApprovedDispositionGroup>();

    for (const row of dispData.breakdown) {
      if (!vendorGroupTotals.has(row.vendor)) {
        vendorGroupTotals.set(row.vendor, new Map());
      }
      const groupMap = vendorGroupTotals.get(row.vendor)!;
      const current = groupMap.get(row.approvedGroup) || 0;
      groupMap.set(row.approvedGroup, current + row.count);
      presentGroupsSet.add(row.approvedGroup);
    }

    const activeGroupsList = OUTCOME_GROUPS_ORDER.filter((g) => presentGroupsSet.has(g));

    const rows = dispData.vendorSummaries.map((v) => {
      const groupMap = vendorGroupTotals.get(v.vendor) || new Map();
      const base = v.dialledCount > 0 ? v.dialledCount : v.totalPopulation;
      const countRow: Record<string, any> = {
        vendor: v.vendor,
        totalPopulation: v.totalPopulation,
        dialledCount: v.dialledCount,
        base,
      };
      const pctRow: Record<string, any> = {
        vendor: v.vendor,
        totalPopulation: v.totalPopulation,
        dialledCount: v.dialledCount,
        base,
      };

      for (const g of activeGroupsList) {
        const cnt = groupMap.get(g) || 0;
        countRow[g] = cnt;
        pctRow[g] = base > 0 ? Number(((cnt / base) * 100).toFixed(1)) : 0;
        pctRow[`${g}_count`] = cnt;
      }

      return { countRow, pctRow, totalVolume: v.dialledCount, vendor: v.vendor };
    });

    return { chartRows: rows, activeGroups: activeGroupsList };
  }, [dispData]);

  // Displayed chart rows with Top-N limit
  const displayedChartRows = useMemo(() => {
    const sorted = [...chartRows].sort((a, b) => b.totalVolume - a.totalVolume);
    const slice = showAllVendors || sorted.length <= 8 ? sorted : sorted.slice(0, 8);
    return slice.map((item) => (chartViewMode === 'percent' ? item.pctRow : item.countRow));
  }, [chartRows, showAllVendors, chartViewMode]);

  // Sortable Vendor Table rows
  const sortedVendorSummaries = useMemo(() => {
    if (!dispData?.vendorSummaries) return [];
    const list = [...dispData.vendorSummaries];
    list.sort((a, b) => {
      let aVal: any = a[sortKey as keyof typeof a];
      let bVal: any = b[sortKey as keyof typeof b];
      if (sortKey === 'vendor') {
        aVal = a.vendor.toLowerCase();
        bVal = b.vendor.toLowerCase();
      }
      if (aVal === null || aVal === undefined) return sortDir === 'asc' ? -1 : 1;
      if (bVal === null || bVal === undefined) return sortDir === 'asc' ? 1 : -1;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [dispData?.vendorSummaries, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // Feedback coverage rates
  const coverageStats = useMemo(() => {
    if (!dispData?.summary) {
      return {
        dialled: 0,
        mapped: 0,
        unmapped: 0,
        missing: 0,
        conflicting: 0,
        zeroCalls: 0,
        unrecorded: 0,
        mappedPct: 0,
        unmappedPct: 0,
        missingPct: 0,
        conflictingPct: 0,
      };
    }
    const s = dispData.summary;
    const dialled = s.dialledEntities || 0;
    const recorded = s.recordedDispositions || 0;
    const unmapped = s.unmappedDispositions || 0;
    const missing = s.missingDispositions || 0;
    const conflicting = s.conflictingEntities || 0;
    const zeroCalls = s.zeroCallEntities || 0;
    const unrecorded = s.unrecordedActivityEntities || 0;
    const mapped = Math.max(recorded - unmapped - conflicting, 0);

    return {
      dialled,
      mapped,
      unmapped,
      missing,
      conflicting,
      zeroCalls,
      unrecorded,
      mappedPct: dialled > 0 ? (mapped / dialled) * 100 : 0,
      unmappedPct: dialled > 0 ? (unmapped / dialled) * 100 : 0,
      missingPct: dialled > 0 ? (missing / dialled) * 100 : 0,
      conflictingPct: dialled > 0 ? (conflicting / dialled) * 100 : 0,
    };
  }, [dispData?.summary]);

  // Export handlers
  const getExportMeta = (isTruncated = false): DispositionExportMetadata => ({
    clientId: selectedClient,
    startDate: startDate || null,
    endDate: endDate || null,
    filters: extractOffernetFilters(filters),
    mode: dispositionMode,
    dateBasis: dispData?.dateBasis || (dispositionMode === 'lead_status' ? 'lead_capture_cohort' : 'call_start_date'),
    countingGrain: dispData?.countingGrain || (dispositionMode === 'lead_status' ? 'lead_vendor_pairs' : 'dialler_records'),
    totalPopulation: dispData?.summary.totalEntities || 0,
    denominatorDefinition:
      dispositionMode === 'lead_status'
        ? 'Dialled lead–vendor pairs (reconciled HLC records)'
        : 'Scoped dialler call records (event level)',
    isTruncated,
    taxonomyVersion: dispData?.reportVersion || DISPOSITION_REPORT_VERSION,
    userRole: profile?.role || (isAdmin ? 'administrator' : 'authenticated'),
    userEmail: user?.email || 'authenticated-user',
    generatedAt: dispData?.evaluatedAt || new Date().toISOString(),
  });

  const handleExportSummaryTable = () => {
    if (!dispData?.vendorSummaries) return;
    const isLeadMode = dispositionMode === 'lead_status';
    const headers = [
      'Vendor',
      'Total Population',
      'Dialled Count',
      ...(isLeadMode ? ['Zero Call Count', 'Unrecorded Activity Count', 'Conflicting Count'] : []),
      'Recorded Dispositions',
      'Missing Dispositions',
      'Unmapped Dispositions',
      'Disposition Coverage %',
      'Mapping Coverage %',
      'Right-Party Contact (RPC)',
      'Reported Sales',
      'Callbacks Requested',
    ];
    const dataRows = [
      headers,
      ...dispData.vendorSummaries.map((v) => [
        v.vendor,
        v.totalPopulation,
        v.dialledCount,
        ...(isLeadMode ? [v.zeroCallCount ?? 0, v.unrecordedActivityCount ?? 0, v.conflictingCount ?? 0] : []),
        v.recordedDispositionCount,
        v.missingDispositionCount,
        v.unmappedDispositionCount,
        v.dispositionCoveragePct !== null ? `${v.dispositionCoveragePct}%` : '—',
        v.mappingCoveragePct !== null ? `${v.mappingCoveragePct}%` : '—',
        v.rpcCount,
        v.saleCount,
        v.callbackCount,
      ]),
    ];
    downloadDispositionExportCsv(
      `vendor_dispositions_summary_${dispositionMode}_${selectedClient}`,
      dataRows,
      getExportMeta(false)
    );
  };

  const handleExportOutcomeComparison = () => {
    if (!dispData?.vendorSummaries || !chartRows.length) return;
    const headers = [
      'Vendor',
      'Total Population',
      'Dialled Base',
      ...activeGroups.map((g) => `${APPROVED_DISPOSITION_GROUPS[g]?.label || g} Count`),
      ...activeGroups.map((g) => `${APPROVED_DISPOSITION_GROUPS[g]?.label || g} %`),
    ];
    const dataRows = [
      headers,
      ...chartRows.map((item) => [
        item.vendor,
        item.countRow.totalPopulation,
        item.countRow.base,
        ...activeGroups.map((g) => item.countRow[g] ?? 0),
        ...activeGroups.map((g) => (item.pctRow[g] !== undefined ? `${item.pctRow[g]}%` : '0%')),
      ]),
    ];
    downloadDispositionExportCsv(
      `vendor_outcomes_comparison_${dispositionMode}_${selectedClient}`,
      dataRows,
      getExportMeta(false)
    );
  };

  const handleExportVendorRawBreakdown = (vendor: string) => {
    const rows = dispData?.breakdown.filter((r) => r.vendor === vendor) || [];
    const isCallMode = dispositionMode === 'call_records';
    const headers = [
      'Vendor',
      'Raw Disposition Code',
      'Raw Description',
      'Approved Outcome Group',
      'Count',
      '% of Vendor Base',
      'Mapping Status',
      'Right-Party Contact (RPC)',
      'Reported Sales',
      'Callbacks Requested',
      ...(isCallMode ? ['Avg Duration (sec)', 'Valid Duration Count', 'Latest Observation'] : []),
    ];
    const dataRows = [
      headers,
      ...rows.map((r) => [
        r.vendor,
        r.rawDisposition,
        r.rawDescription,
        r.approvedGroupLabel,
        r.count,
        r.percentOfBase !== null ? `${r.percentOfBase}%` : '—',
        r.mappingStatus || (r.isUnmapped ? 'UNMAPPED' : 'APPROVED'),
        r.rpcCount,
        r.saleCount,
        r.callbackCount,
        ...(isCallMode ? [r.avgDurationSec ?? '—', r.validDurationCount ?? '—', r.latestObservation ?? '—'] : []),
      ]),
    ];
    downloadDispositionExportCsv(
      `raw_dispositions_${vendor}_${dispositionMode}_${selectedClient}`,
      dataRows,
      getExportMeta(false)
    );
  };

  return (
    <div className="cx-command-page">
      <OffernetFilterBar
        onRefresh={() => {
          if (activeTab === 'call_counts') reloadCallCountData(true);
          else reloadDispData(true);
        }}
      />
      <div className="cx-command-content">
        <header className="cx-command-hero">
          <div>
            <span className="cx-command-eyebrow">Contact Centre</span>
            <h1>{activeTab === 'vendor_dispositions' ? 'Vendor dispositions' : 'Contact performance'}</h1>
            <p>
              {activeTab === 'vendor_dispositions'
                ? dispositionMode === 'lead_status'
                  ? 'Current recorded status of the selected intake cohort, counted by lead–vendor pair.'
                  : 'Outcomes on recorded calls during the selected call-date period, counted by verified call events or explicitly labelled dialler records.'
                : 'Observe contact yield across attempt saturation thresholds, or inspect raw and standardized call dispositions across authorized vendors.'}
            </p>
          </div>
        </header>

        {/* Sub Navigation */}
        <nav aria-label="Contact performance sub sections" className="cx-tabs">
          <button
            type="button"
            onClick={() => handleTabChange('call_counts')}
            data-active={activeTab === 'call_counts'}
            className="cx-tab-item"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Call-count outcomes</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('vendor_dispositions')}
            data-active={activeTab === 'vendor_dispositions'}
            className="cx-tab-item"
          >
            <FileText className="w-4 h-4" />
            <span>Vendor dispositions</span>
          </button>
        </nav>

        {/* SUBTAB 1: Call-count outcomes (Preserved) */}
        {activeTab === 'call_counts' && (
          <>
            {callCountError && (
              <div className="cx-command-error">
                <AlertTriangle size={17} />
                {callCountError}
              </div>
            )}
            {callCountLoading && !callCountData && (
              <div className="cx-command-loading">
                <div className="cx-command-spinner" />
                Loading call outcomes…
              </div>
            )}
            {callCountData && (
              <>
                {callCountData.summary && (
                  <section className="cx-command-metrics cx-contact-metrics" aria-label="Contact governance summary">
                    <article className="cx-command-metric">
                      <span>Zero-call leads</span>
                      <strong>{formatTableNumber(callCountData.summary.zeroCallLeads)}</strong>
                      <div>
                        <small>Explicitly recorded zero calls</small>
                      </div>
                    </article>
                    <article className="cx-command-metric">
                      <span>One-call share</span>
                      <strong>{formatPercent(callCountData.summary.singleAttemptSharePct)}</strong>
                      <div>
                        <small>
                          {formatTableNumber(callCountData.summary.oneCallLeads)} leads · share of dialled leads
                        </small>
                      </div>
                    </article>
                    <article className="cx-command-metric">
                      <span>Multi-call share</span>
                      <strong>{formatPercent(callCountData.summary.multiAttemptSharePct)}</strong>
                      <div>
                        <small>
                          {formatTableNumber(callCountData.summary.multiAttemptLeads)} leads · share of dialled leads
                        </small>
                      </div>
                    </article>
                    <article className="cx-command-metric">
                      <span>5+ calls, no RPC</span>
                      <strong>{formatTableNumber(callCountData.summary.fivePlusNoRpcLeads)}</strong>
                      <div>
                        <small>High effort without contact</small>
                      </div>
                    </article>
                  </section>
                )}
                {callCountData.summary && callCountData.summary.unrecordedCallLeads > 0 && (
                  <div className="cx-control-note">
                    {formatTableNumber(callCountData.summary.unrecordedCallLeads)} leads have unrecorded call counts and
                    are shown separately from zero-call leads.
                  </div>
                )}
                {callCountData.summary && (
                  <p className="cx-control-note">
                    One-call leakage: {formatTableNumber(callCountData.summary.oneCallNoRpcLeads)} leads with explicit no
                    RPC after one recorded call. Zero-call leakage:{' '}
                    {formatTableNumber(callCountData.summary.zeroCallNoRpcLeads)} leads with explicit no RPC and zero
                    recorded calls.
                  </p>
                )}
                <ExportAnalysisButton
                  filename="contact_attempt_outcomes"
                  rows={[
                    [
                      'Bucket',
                      'Leads',
                      'Share %',
                      'RPC',
                      'RPC / dialled %',
                      'Sales',
                      'Sale / lead %',
                      'Activations',
                      'Activation / sale %',
                    ],
                    ...callCountData.attemptPerformance.map((r) => [
                      r.bucket,
                      r.leads,
                      r.sharePct,
                      r.contacted,
                      r.contactRate,
                      r.sales,
                      r.saleRate,
                      r.activations,
                      r.activationRate,
                    ]),
                  ]}
                  definitions={[callCountData.methodology || 'Exclusive observed call-count buckets']}
                />
                {callCountData.effortEvidence && (
                  <p className="cx-control-note">{callCountData.effortEvidence.reason}</p>
                )}
                <div className="cx-analytics-visual-grid">
                  <GroupedOutcomeChart
                    title="Outcomes by total recorded calls"
                    subtitle="Lead, RPC, sale and activation counts by exclusive recorded call-count bucket."
                    data={callCountData.attemptPerformance}
                    xKey="bucket"
                    series={[
                      { key: 'leads', label: 'Leads' },
                      { key: 'contacted', label: 'RPC' },
                      { key: 'sales', label: 'Sales' },
                      { key: 'activations', label: 'Activations' },
                    ]}
                  />
                  <VolumeRateComboChart
                    title="Observed yield by call-count bucket"
                    subtitle="This is descriptive, not a recommended stop-threshold model."
                    data={callCountData.attemptPerformance}
                    xKey="bucket"
                    volumeKey="leads"
                    volumeLabel="Leads"
                    rateSeries={[
                      { key: 'contactRate', label: 'RPC rate' },
                      { key: 'saleRate', label: 'Sale rate' },
                      { key: 'activationRate', label: 'Activation / sale' },
                    ]}
                  />
                </div>
                <section className="cx-command-panel">
                  <header>
                    <div>
                      <span className="cx-command-section-kicker">Observed rates</span>
                      <h2>Contact and sale yield</h2>
                      <p>Use these rates to investigate patterns before changing dial policy.</p>
                    </div>
                  </header>
                  <div className="cx-performance-table-wrap">
                    <table className="cx-performance-table">
                      <thead>
                        <tr>
                          <th>Call-count bucket</th>
                          <th>Leads</th>
                          <th>Share</th>
                          <th>RPC</th>
                          <th>RPC rate</th>
                          <th>Sales</th>
                          <th>Sale rate</th>
                          <th>Activations</th>
                          <th>Activation / sale</th>
                          <th>Explicit no RPC</th>
                          <th>RPC unrecorded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(callCountData.attemptPerformance || []).map((row) => (
                          <tr key={row.bucket}>
                            <th>{row.bucket}</th>
                            <td>{formatTableNumber(row.leads)}</td>
                            <td>{formatPercent(row.sharePct)}</td>
                            <td>{formatTableNumber(row.contacted)}</td>
                            <td>{formatPercent(row.contactRate)}</td>
                            <td>{formatTableNumber(row.sales)}</td>
                            <td>{formatPercent(row.saleRate, 2)}</td>
                            <td>{formatTableNumber(row.activations)}</td>
                            <td>{formatPercent(row.activationRate)}</td>
                            <td>{formatTableNumber(row.noRpc)}</td>
                            <td>{formatTableNumber(row.rpcUnrecorded)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="cx-command-panel">
                  <header>
                    <div>
                      <span className="cx-command-section-kicker">Guardrail</span>
                      <h2>Recommendation status</h2>
                    </div>
                  </header>
                  <div className="cx-command-empty">
                    <ShieldCheck size={18} />
                    <span>
                      {callCountData.noAnswerAnalysis.reason}
                      {callCountData.methodology ? ` ${callCountData.methodology}` : ''}
                    </span>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* SUBTAB 2: Vendor Dispositions (Enhanced Phase 2.1 Workflow) */}
        {activeTab === 'vendor_dispositions' && (
          <>
            {dispError && (
              <div className="cx-command-error mb-4" role="alert">
                <AlertTriangle size={18} className="shrink-0" />
                <div>
                  <strong>Failed to load vendor dispositions</strong>
                  <p className="text-xs mt-0.5">{dispError}</p>
                </div>
              </div>
            )}

            {/* A. Reporting Header and Mode Selector */}
            <div className="cx-command-panel p-4 mb-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Operational Report
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-700 border border-slate-200">
                      {dispData?.reportVersion || DISPOSITION_REPORT_VERSION}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">Vendor dispositions</h2>
                  <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                    {dispositionMode === 'lead_status'
                      ? 'Current recorded status of the selected intake cohort, counted by lead–vendor pair.'
                      : 'Outcomes on recorded calls during the selected call-date period, counted by verified call events or explicitly labelled dialler records.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAboutDrawerOpen(true)}
                    className="cx-button-secondary text-xs inline-flex items-center gap-1.5"
                  >
                    <BookOpen size={14} />
                    <span>About this report</span>
                  </button>

                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => handleModeChange('lead_status')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        dispositionMode === 'lead_status'
                          ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Recorded lead status
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeChange('call_records')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        dispositionMode === 'call_records'
                          ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Call outcomes
                    </button>
                  </div>
                </div>
              </div>

              {/* Concrete Indicators & Denominator Disclosures */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
                <span>
                  <strong className="text-slate-700">Timezone:</strong>{' '}
                  {dispData?.timezone || clientConfig?.timezone || 'Africa/Johannesburg'}
                </span>
                <span>
                  <strong className="text-slate-700">Date basis:</strong>{' '}
                  {dispData?.dateBasis === 'lead_capture_cohort'
                    ? 'Lead capture cohort'
                    : 'Call start date (call_start_date)'}
                </span>
                <span>
                  <strong className="text-slate-700">Counting unit:</strong>{' '}
                  {dispData?.countingGrain === 'lead_vendor_pairs'
                    ? 'Lead–vendor pairs'
                    : 'Dialler records'}
                </span>
                <span>
                  <strong className="text-slate-700">Evaluated:</strong>{' '}
                  {dispData?.evaluatedAt ? new Date(dispData.evaluatedAt).toLocaleTimeString() : 'Current'}
                </span>
                <span className="text-slate-400 italic">
                  {dispositionMode === 'lead_status'
                    ? 'Denominator: Dialled lead–vendor pairs. Multi-vendor leads count once per vendor.'
                    : 'Denominator: Dialler events during call window. Cross-group unique leads non-additive.'}
                </span>
              </div>
            </div>

            {/* Mode Unavailable Dependency Banner */}
            {dispData?.unavailableReason && (
              <div className="p-4 mb-5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-700 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <strong className="text-amber-950 font-semibold text-sm">Mode unavailable for this workspace</strong>
                  <p className="mt-1">{dispData.unavailableReason}</p>
                  <p className="mt-1 text-amber-800">
                    No synthetic fallback data has been generated. Switch to Recorded lead status to inspect available vendor feedback.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleModeChange('lead_status')}
                    className="mt-2 px-3 py-1 bg-white border border-amber-300 rounded text-amber-900 hover:bg-amber-100 font-medium transition"
                  >
                    Switch to Recorded lead status
                  </button>
                </div>
              </div>
            )}

            {dispLoading && !dispData && (
              <div className="cx-command-loading">
                <div className="cx-command-spinner" />
                Loading vendor dispositions…
              </div>
            )}

            {dispData && !dispData.unavailableReason && (
              <>
                {/* C. Summary Strip */}
                <section
                  className="cx-command-metrics grid grid-cols-2 md:grid-cols-5 gap-3 mb-6"
                  aria-label="Vendor dispositions summary strip"
                >
                  <article className="cx-command-metric">
                    <span>{dispositionMode === 'lead_status' ? 'Reporting population' : 'Total dialler records'}</span>
                    <strong>{formatTableNumber(dispData.summary.totalEntities)}</strong>
                    <div>
                      <small>
                        {dispositionMode === 'lead_status'
                          ? 'Lead–vendor pairs'
                          : 'Recorded call events'}
                      </small>
                    </div>
                  </article>

                  <article className="cx-command-metric">
                    <span>Observed call activity</span>
                    <strong>{formatTableNumber(dispData.summary.dialledEntities)}</strong>
                    <div>
                      <small>
                        {dispData.summary.totalEntities > 0
                          ? formatPercent((dispData.summary.dialledEntities / dispData.summary.totalEntities) * 100)
                          : '—'}{' '}
                        of population dialled
                      </small>
                    </div>
                  </article>

                  <article className="cx-command-metric">
                    <span>Disposition coverage</span>
                    <strong>{formatPercent(dispData.summary.dispositionCoveragePct)}</strong>
                    <div>
                      <small>
                        {formatTableNumber(dispData.summary.recordedDispositions)} / {formatTableNumber(dispData.summary.dialledEntities)} dialled
                      </small>
                    </div>
                  </article>

                  <article className="cx-command-metric">
                    <span>Missing dispositions</span>
                    <strong className={dispData.summary.missingDispositions > 0 ? 'text-amber-700' : ''}>
                      {formatTableNumber(dispData.summary.missingDispositions)}
                    </strong>
                    <div>
                      <small>
                        {dispData.summary.dialledEntities > 0
                          ? formatPercent((dispData.summary.missingDispositions / dispData.summary.dialledEntities) * 100)
                          : '—'}{' '}
                        dialled with blank status
                      </small>
                    </div>
                  </article>

                  <article className="cx-command-metric">
                    <span>Unmapped dispositions</span>
                    <strong className={dispData.summary.unmappedDispositions > 0 ? 'text-purple-700' : ''}>
                      {formatTableNumber(dispData.summary.unmappedDispositions)}
                    </strong>
                    <div>
                      <small>
                        {dispData.summary.recordedDispositions > 0
                          ? formatPercent((dispData.summary.unmappedDispositions / dispData.summary.recordedDispositions) * 100)
                          : '—'}{' '}
                        of recorded unclassified
                      </small>
                    </div>
                  </article>
                </section>

                {/* Rates Bar: Right-Party Contact, Sales, Callbacks */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                  <div className="p-3.5 rounded-lg border border-sky-100 bg-sky-50/50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-sky-900 uppercase tracking-wide">
                        Right-Party Contact (RPC)
                      </div>
                      <div className="text-xl font-bold text-sky-950 mt-1">
                        {formatTableNumber(dispData.summary.rpcCount)}{' '}
                        <span className="text-xs font-medium text-sky-700">
                          (
                          {dispData.summary.dialledEntities > 0
                            ? formatPercent((dispData.summary.rpcCount / dispData.summary.dialledEntities) * 100)
                            : '—'}
                          )
                        </span>
                      </div>
                      <div className="text-[11px] text-sky-700 mt-0.5">
                        Verified human contact with lead
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-emerald-100 bg-emerald-50/50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">
                        Reported Sales
                      </div>
                      <div className="text-xl font-bold text-emerald-950 mt-1">
                        {formatTableNumber(dispData.summary.saleCount)}{' '}
                        <span className="text-xs font-medium text-emerald-700">
                          (
                          {dispData.summary.dialledEntities > 0
                            ? formatPercent((dispData.summary.saleCount / dispData.summary.dialledEntities) * 100, 2)
                            : '—'}
                          )
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-700 mt-0.5">
                        Sale recorded on disposition
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-purple-100 bg-purple-50/50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-purple-900 uppercase tracking-wide">
                        Callbacks Requested
                      </div>
                      <div className="text-xl font-bold text-purple-950 mt-1">
                        {formatTableNumber(dispData.summary.callbackCount)}{' '}
                        <span className="text-xs font-medium text-purple-700">
                          (
                          {dispData.summary.dialledEntities > 0
                            ? formatPercent((dispData.summary.callbackCount / dispData.summary.dialledEntities) * 100, 1)
                            : '—'}
                          )
                        </span>
                      </div>
                      <div className="text-[11px] text-purple-700 mt-0.5">
                        Consumer or agent follow-up booked
                      </div>
                    </div>
                  </div>
                </div>

                {/* D. Outcome Comparison (Horizontal Stacked Bar Chart) */}
                <section className="cx-command-panel p-4 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <span className="cx-command-section-kicker">Outcome comparison</span>
                      <h3 className="text-base font-bold text-slate-900">Outcomes by vendor</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Horizontal stacked distribution across approved comparison groups. Multiple raw codes in the same group are aggregated.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Count vs Percent View Mode */}
                      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setChartViewMode('percent')}
                          className={`px-2.5 py-1 font-medium rounded transition ${
                            chartViewMode === 'percent'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Percentage (%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setChartViewMode('count')}
                          className={`px-2.5 py-1 font-medium rounded transition ${
                            chartViewMode === 'count'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Count (Volume)
                        </button>
                      </div>

                      {/* Top-N Toggle */}
                      {chartRows.length > 8 && (
                        <button
                          type="button"
                          onClick={() => setShowAllVendors((prev) => !prev)}
                          className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        >
                          {showAllVendors ? 'Show top 8 vendors' : `Show all ${chartRows.length} vendors`}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleExportOutcomeComparison}
                        className="cx-button-secondary text-xs inline-flex items-center gap-1.5"
                      >
                        <Download size={13} />
                        <span>Export comparison</span>
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Stacked Bar Chart */}
                  <HorizontalStackedOutcomeChart
                    data={displayedChartRows}
                    categoryKey="vendor"
                    series={activeGroups.map((groupCode) => {
                      const groupCfg = APPROVED_DISPOSITION_GROUPS[groupCode];
                      return {
                        key: groupCode,
                        label: groupCfg?.label || groupCode,
                        color: groupCfg?.color || '#94a3b8',
                      };
                    })}
                    isPercent={chartViewMode === 'percent'}
                    onSelect={(vendor, groupCode) => handleChartDrillDown(vendor, groupCode)}
                    tooltipBaseLabel={dispositionMode === 'lead_status' ? 'dialled pairs' : 'dialler records'}
                  />
                </section>

                {/* E. Feedback Coverage */}
                <section className="cx-command-panel p-4 mb-6">
                  <div className="mb-3">
                    <span className="cx-command-section-kicker">Data completeness</span>
                    <h3 className="text-base font-bold text-slate-900">Feedback coverage & integrity</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Proportional breakdown of recorded mapped feedback, unmapped codes, missing status, and conflicting evidence over dialled records.
                    </p>
                  </div>

                  {/* Compact Proportional Segmented Bar */}
                  {coverageStats.dialled > 0 ? (
                    <div className="mb-4">
                      <div className="h-5 w-full rounded-md overflow-hidden flex bg-slate-100 border border-slate-200 shadow-inner">
                        {coverageStats.mappedPct > 0 && (
                          <div
                            style={{ width: `${coverageStats.mappedPct}%`, backgroundColor: '#0284c7' }}
                            title={`Mapped Feedback: ${formatTableNumber(coverageStats.mapped)} (${coverageStats.mappedPct.toFixed(1)}%)`}
                            className="transition-all"
                          />
                        )}
                        {coverageStats.unmappedPct > 0 && (
                          <div
                            style={{ width: `${coverageStats.unmappedPct}%`, backgroundColor: '#a855f7' }}
                            title={`Unmapped Feedback: ${formatTableNumber(coverageStats.unmapped)} (${coverageStats.unmappedPct.toFixed(1)}%)`}
                            className="transition-all"
                          />
                        )}
                        {coverageStats.conflictingPct > 0 && (
                          <div
                            style={{ width: `${coverageStats.conflictingPct}%`, backgroundColor: '#fbbf24' }}
                            title={`Conflicting Evidence: ${formatTableNumber(coverageStats.conflicting)} (${coverageStats.conflictingPct.toFixed(1)}%)`}
                            className="transition-all"
                          />
                        )}
                        {coverageStats.missingPct > 0 && (
                          <div
                            style={{ width: `${coverageStats.missingPct}%`, backgroundColor: '#f87171' }}
                            title={`Missing Feedback: ${formatTableNumber(coverageStats.missing)} (${coverageStats.missingPct.toFixed(1)}%)`}
                            className="transition-all"
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#0284c7' }} />
                          <span>Mapped feedback: {coverageStats.mappedPct.toFixed(1)}%</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#a855f7' }} />
                          <span>Unmapped feedback: {coverageStats.unmappedPct.toFixed(1)}%</span>
                        </span>
                        {coverageStats.conflictingPct > 0 && (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#fbbf24' }} />
                            <span>Conflicting evidence: {coverageStats.conflictingPct.toFixed(1)}%</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#f87171' }} />
                          <span>Missing feedback: {coverageStats.missingPct.toFixed(1)}%</span>
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* Coverage Breakdown Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                      <div className="text-xs text-slate-500 font-medium">Mapped Feedback</div>
                      <div className="text-lg font-bold text-slate-900 mt-1">
                        {formatTableNumber(coverageStats.mapped)}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {coverageStats.mappedPct.toFixed(1)}% of dialled
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50">
                      <div className="text-xs text-purple-700 font-medium">Unmapped Feedback</div>
                      <div className="text-lg font-bold text-purple-950 mt-1">
                        {formatTableNumber(coverageStats.unmapped)}
                      </div>
                      <div className="text-xs text-purple-700 mt-0.5">
                        {coverageStats.unmappedPct.toFixed(1)}% of dialled (Part of recorded)
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/50">
                      <div className="text-xs text-rose-700 font-medium">Missing Feedback</div>
                      <div className="text-lg font-bold text-rose-950 mt-1">
                        {formatTableNumber(coverageStats.missing)}
                      </div>
                      <div className="text-xs text-rose-700 mt-0.5">
                        {coverageStats.missingPct.toFixed(1)}% of dialled
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                      <div className="text-xs text-amber-700 font-medium">Conflicting Evidence</div>
                      <div className="text-lg font-bold text-amber-950 mt-1">
                        {formatTableNumber(coverageStats.conflicting)}
                      </div>
                      <div className="text-xs text-amber-700 mt-0.5">
                        {coverageStats.conflictingPct.toFixed(1)}% of dialled
                      </div>
                    </div>
                  </div>

                  {/* Activity States Box (Separated from call outcomes) */}
                  {dispositionMode === 'lead_status' && (
                    <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <Layers size={15} className="text-slate-500" />
                        <div>
                          <strong className="text-slate-800">Activity states (Outside dialled base):</strong>{' '}
                          <span className="text-slate-600">
                            Explicit zero-call pairs and unrecorded activity are activity states, not call dispositions.
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 font-medium text-slate-700">
                        <span>
                          Explicit 0 calls:{' '}
                          <strong className="text-slate-900">{formatTableNumber(coverageStats.zeroCalls)}</strong>
                        </span>
                        <span>
                          Unrecorded activity:{' '}
                          <strong className="text-slate-900">{formatTableNumber(coverageStats.unrecorded)}</strong>
                        </span>
                      </div>
                    </div>
                  )}
                </section>

                {/* F. Sortable Vendor Table */}
                <section className="cx-command-panel mb-6">
                  <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-100">
                    <div>
                      <span className="cx-command-section-kicker">Vendor governance</span>
                      <h3 className="text-base font-bold text-slate-900">Vendor disposition summary</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Sortable vendor performance showing population, activity, coverage completeness, and commercial outcomes. Click any vendor to open detail breakdown.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportSummaryTable}
                        className="cx-button-secondary text-xs inline-flex items-center gap-1.5"
                      >
                        <Download size={13} />
                        <span>Export summary table</span>
                      </button>
                    </div>
                  </header>

                  <div className="cx-performance-table-wrap">
                    <table className="cx-performance-table">
                      <thead>
                        <tr>
                          <th
                            className="cursor-pointer hover:bg-slate-100 transition select-none"
                            onClick={() => handleSort('vendor')}
                          >
                            <span className="flex items-center gap-1">
                              Vendor
                              {sortKey === 'vendor' ? (
                                sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                              ) : (
                                <ArrowUpDown size={11} className="text-slate-400" />
                              )}
                            </span>
                          </th>
                          <th
                            className="cursor-pointer hover:bg-slate-100 transition select-none"
                            onClick={() => handleSort('totalPopulation')}
                          >
                            <span className="flex items-center gap-1">
                              Population ({dispositionMode === 'lead_status' ? 'Pairs' : 'Records'})
                              {sortKey === 'totalPopulation' ? (
                                sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                              ) : (
                                <ArrowUpDown size={11} className="text-slate-400" />
                              )}
                            </span>
                          </th>
                          <th
                            className="cursor-pointer hover:bg-slate-100 transition select-none"
                            onClick={() => handleSort('dialledCount')}
                          >
                            <span className="flex items-center gap-1">
                              Dialled Activity
                              {sortKey === 'dialledCount' ? (
                                sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                              ) : (
                                <ArrowUpDown size={11} className="text-slate-400" />
                              )}
                            </span>
                          </th>
                          {dispositionMode === 'lead_status' && (
                            <th
                              className="cursor-pointer hover:bg-slate-100 transition select-none"
                              onClick={() => handleSort('zeroCallCount')}
                            >
                              <span className="flex items-center gap-1">
                                Zero Calls
                                {sortKey === 'zeroCallCount' ? (
                                  sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                ) : (
                                  <ArrowUpDown size={11} className="text-slate-400" />
                                )}
                              </span>
                            </th>
                          )}
                          <th
                            className="cursor-pointer hover:bg-slate-100 transition select-none"
                            onClick={() => handleSort('dispositionCoveragePct')}
                          >
                            <span className="flex items-center gap-1">
                              Disp Coverage %
                              {sortKey === 'dispositionCoveragePct' ? (
                                sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                              ) : (
                                <ArrowUpDown size={11} className="text-slate-400" />
                              )}
                            </span>
                          </th>
                          <th
                            className="cursor-pointer hover:bg-slate-100 transition select-none"
                            onClick={() => handleSort('missingDispositionCount')}
                          >
                            <span className="flex items-center gap-1">
                              Missing Disp
                              {sortKey === 'missingDispositionCount' ? (
                                sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                              ) : (
                                <ArrowUpDown size={11} className="text-slate-400" />
                              )}
                            </span>
                          </th>
                          <th
                            className="cursor-pointer hover:bg-slate-100 transition select-none"
                            onClick={() => handleSort('unmappedDispositionCount')}
                          >
                            <span className="flex items-center gap-1">
                              Unmapped
                              {sortKey === 'unmappedDispositionCount' ? (
                                sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                              ) : (
                                <ArrowUpDown size={11} className="text-slate-400" />
                              )}
                            </span>
                          </th>
                          <th
                            className="cursor-pointer hover:bg-slate-100 transition select-none"
                            onClick={() => handleSort('saleCount')}
                          >
                            <span className="flex items-center gap-1">
                              Reported Sales
                              {sortKey === 'saleCount' ? (
                                sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                              ) : (
                                <ArrowUpDown size={11} className="text-slate-400" />
                              )}
                            </span>
                          </th>
                          <th
                            className="cursor-pointer hover:bg-slate-100 transition select-none"
                            onClick={() => handleSort('callbackCount')}
                          >
                            <span className="flex items-center gap-1">
                              Callbacks
                              {sortKey === 'callbackCount' ? (
                                sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                              ) : (
                                <ArrowUpDown size={11} className="text-slate-400" />
                              )}
                            </span>
                          </th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedVendorSummaries.map((v) => {
                          const saleRate =
                            v.dialledCount > 0 ? formatPercent((v.saleCount / v.dialledCount) * 100, 2) : '—';
                          const isSelected = selectedVendorDrawer === v.vendor;

                          return (
                            <tr
                              key={v.vendor}
                              className={isSelected ? 'bg-sky-50/70 font-medium' : 'hover:bg-slate-50 transition'}
                            >
                              <th>{v.vendor}</th>
                              <td>{formatTableNumber(v.totalPopulation)}</td>
                              <td>{formatTableNumber(v.dialledCount)}</td>
                              {dispositionMode === 'lead_status' && (
                                <td>{formatTableNumber(v.zeroCallCount ?? 0)}</td>
                              )}
                              <td>{formatPercent(v.dispositionCoveragePct)}</td>
                              <td>
                                {v.missingDispositionCount > 0 ? (
                                  <span className="text-amber-700 font-medium">
                                    {formatTableNumber(v.missingDispositionCount)}
                                  </span>
                                ) : (
                                  '0'
                                )}
                              </td>
                              <td>
                                {v.unmappedDispositionCount > 0 ? (
                                  <span className="text-purple-700 font-medium">
                                    {formatTableNumber(v.unmappedDispositionCount)}
                                  </span>
                                ) : (
                                  '0'
                                )}
                              </td>
                              <td>
                                <span className="font-semibold text-emerald-700">
                                  {formatTableNumber(v.saleCount)}
                                </span>{' '}
                                <span className="text-xs text-slate-500 font-normal">({saleRate})</span>
                              </td>
                              <td>{formatTableNumber(v.callbackCount)}</td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => handleSelectVendorForDrawer(v.vendor)}
                                  className="text-xs text-sky-700 hover:text-sky-900 font-medium underline inline-flex items-center gap-1"
                                >
                                  <span>Inspect details</span>
                                  <ChevronRight size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* G. Selected-Vendor Detail Drawer */}
            {selectedVendorDrawer && selectedVendorSummary && (
              <>
                <div
                  className="fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-xs transition-opacity"
                  onClick={() => handleSelectVendorForDrawer(null)}
                />
                <aside
                  ref={vendorDrawerRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="vendor-drawer-title"
                  className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 overflow-y-auto flex flex-col border-l border-slate-200"
                >
                  {/* Drawer Header */}
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase text-slate-500">Vendor Inspection</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-medium border border-sky-100">
                          {dispositionMode === 'lead_status' ? 'Lead–Vendor Pairs' : 'Dialler Records'}
                        </span>
                      </div>
                      <h2 id="vendor-drawer-title" className="text-lg font-bold text-slate-900 mt-0.5">
                        {selectedVendorSummary.vendor}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectVendorForDrawer(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      aria-label="Close vendor details"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Drawer Content */}
                  <div className="p-5 space-y-6 flex-1">
                    {/* Summary KPI Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-500">Total Population</div>
                        <div className="text-lg font-bold text-slate-900 mt-1">
                          {formatTableNumber(selectedVendorSummary.totalPopulation)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-500">Dialled Activity</div>
                        <div className="text-lg font-bold text-slate-900 mt-1">
                          {formatTableNumber(selectedVendorSummary.dialledCount)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-500">Disp Coverage %</div>
                        <div className="text-lg font-bold text-slate-900 mt-1">
                          {formatPercent(selectedVendorSummary.dispositionCoveragePct)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-500">Mapping Coverage %</div>
                        <div className="text-lg font-bold text-slate-900 mt-1">
                          {formatPercent(selectedVendorSummary.mappingCoveragePct)}
                        </div>
                      </div>
                    </div>

                    {/* Commercial Measures */}
                    <div className="grid grid-cols-3 gap-3 p-3 bg-sky-50/50 rounded-lg border border-sky-100 text-xs">
                      <div>
                        <span className="text-slate-500">RPC:</span>{' '}
                        <strong className="text-sky-900 font-bold">
                          {formatTableNumber(selectedVendorSummary.rpcCount)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Sales:</span>{' '}
                        <strong className="text-emerald-700 font-bold">
                          {formatTableNumber(selectedVendorSummary.saleCount)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Callbacks:</span>{' '}
                        <strong className="text-purple-700 font-bold">
                          {formatTableNumber(selectedVendorSummary.callbackCount)}
                        </strong>
                      </div>
                    </div>

                    {/* Grouped Outcomes Pills */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">
                        Outcome Groups (Click group to filter raw codes)
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setDrawerGroupFilter('ALL')}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition ${
                            drawerGroupFilter === 'ALL'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          All Groups ({selectedVendorBreakdown.length} codes)
                        </button>
                        {Array.from(new Set(selectedVendorBreakdown.map((r) => r.approvedGroup))).map((grp) => {
                          const grpCfg = APPROVED_DISPOSITION_GROUPS[grp];
                          const totalForGrp = selectedVendorBreakdown
                            .filter((r) => r.approvedGroup === grp)
                            .reduce((sum, r) => sum + r.count, 0);
                          const isGrpActive = drawerGroupFilter === grp;
                          return (
                            <button
                              key={grp}
                              type="button"
                              onClick={() => setDrawerGroupFilter(isGrpActive ? 'ALL' : grp)}
                              className="px-2.5 py-1 rounded text-xs font-medium border transition flex items-center gap-1.5"
                              style={{
                                backgroundColor: isGrpActive ? grpCfg?.color || '#334155' : '#ffffff',
                                color: isGrpActive ? '#ffffff' : grpCfg?.color || '#334155',
                                borderColor: `${grpCfg?.color || '#cbd5e1'}60`,
                              }}
                            >
                              <span>{grpCfg?.label || grp}</span>
                              <span className="opacity-80">({formatTableNumber(totalForGrp)})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Raw Code Table & Filter Bar */}
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                        <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                          Raw Disposition Breakdown ({filteredDrawerBreakdown.length} items)
                        </h4>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleExportVendorRawBreakdown(selectedVendorSummary.vendor)}
                            className="cx-button-secondary text-xs inline-flex items-center gap-1 py-1 px-2"
                          >
                            <Download size={12} />
                            <span>Export raw codes</span>
                          </button>
                        </div>
                      </div>

                      <div className="relative mb-3">
                        <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search raw code or description…"
                          value={drawerSearchQuery}
                          onChange={(e) => setDrawerSearchQuery(e.target.value)}
                          className="text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-slate-800 w-full"
                        />
                      </div>

                      <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                            <tr>
                              <th className="p-2">Raw Code</th>
                              <th className="p-2">Description</th>
                              <th className="p-2">Group</th>
                              <th className="p-2 text-right">Count</th>
                              <th className="p-2 text-right">% of Base</th>
                              <th className="p-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredDrawerBreakdown.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="text-center py-6 text-slate-500 text-xs">
                                  No raw codes match active filters.
                                </td>
                              </tr>
                            ) : (
                              filteredDrawerBreakdown.map((row, idx) => {
                                const grpCfg = APPROVED_DISPOSITION_GROUPS[row.approvedGroup];
                                const isMissing = row.approvedGroup === 'MISSING_DISPOSITION';
                                const isUnmapped = row.isUnmapped || row.approvedGroup === 'UNMAPPED';
                                const isConflicting = row.approvedGroup === 'CONFLICTING_EVIDENCE';

                                return (
                                  <tr key={`${row.rawDisposition}-${idx}`} className="hover:bg-slate-50">
                                    <td className="p-2">
                                      <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-900 border border-slate-200 text-[11px]">
                                        {row.rawDisposition}
                                      </code>
                                    </td>
                                    <td className="p-2 text-slate-700 max-w-[140px] truncate" title={row.rawDescription}>
                                      {row.rawDescription}
                                    </td>
                                    <td className="p-2">
                                      <span
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                                        style={{
                                          backgroundColor: `${grpCfg?.color || '#cbd5e1'}20`,
                                          color: grpCfg?.color || '#334155',
                                        }}
                                      >
                                        {row.approvedGroupLabel}
                                      </span>
                                    </td>
                                    <td className="p-2 text-right font-mono font-medium text-slate-900">
                                      {formatTableNumber(row.count)}
                                    </td>
                                    <td className="p-2 text-right font-mono text-slate-600">
                                      {formatPercent(row.percentOfBase)}
                                    </td>
                                    <td className="p-2">
                                      {isMissing ? (
                                        <span className="text-[10px] text-rose-700 font-medium inline-flex items-center gap-1">
                                          <AlertCircle size={10} /> Missing
                                        </span>
                                      ) : isConflicting ? (
                                        <span className="text-[10px] text-amber-700 font-medium inline-flex items-center gap-1">
                                          <AlertTriangle size={10} /> Conflict
                                        </span>
                                      ) : isUnmapped ? (
                                        <span className="text-[10px] text-purple-700 font-medium inline-flex items-center gap-1">
                                          <HelpCircle size={10} /> Unmapped
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-emerald-700 inline-flex items-center gap-1">
                                          <CheckCircle2 size={10} /> Approved
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Authorised Record Drill-Down Action */}
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-sky-700" />
                        <span>Supporting record evidence</span>
                      </div>

                      {dispositionMode === 'lead_status' ? (
                        isAdmin ? (
                          <div>
                            <p className="text-slate-600 mb-2">
                              Inspect the individual lead records supporting {selectedVendorSummary.vendor} in Lead Explorer, preserving the current reporting period and workspace scope.
                            </p>
                            <Link
                              to={`/lead-explorer?vendor=${encodeURIComponent(selectedVendorSummary.vendor)}`}
                              className="cx-button-primary inline-flex items-center gap-1.5 text-xs py-1.5 px-3"
                            >
                              <ExternalLink size={13} />
                              <span>Inspect records in Lead Explorer</span>
                            </Link>
                          </div>
                        ) : (
                          <p className="text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200">
                            Lead-level record inspection requires Administrator authority. Aggregate results above reflect certified workspace counts.
                          </p>
                        )
                      ) : (
                        <p className="text-slate-600 bg-white p-2.5 rounded border border-slate-200">
                          Dialler call events are tracked at switch log grain. Record-level inspection in Lead Explorer is available in Recorded lead status mode.
                        </p>
                      )}
                    </div>
                  </div>
                </aside>
              </>
            )}

            {/* H. About This Report Drawer */}
            {aboutDrawerOpen && (
              <>
                <div
                  className="fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-xs transition-opacity"
                  onClick={() => setAboutDrawerOpen(false)}
                />
                <aside
                  ref={aboutDrawerRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="about-drawer-title"
                  className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl z-50 overflow-y-auto flex flex-col border-l border-slate-200"
                >
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <BookOpen size={16} className="text-sky-700" />
                      <h2 id="about-drawer-title" className="text-base font-bold text-slate-900">
                        About Vendor Dispositions
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAboutDrawerOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      aria-label="Close methodology details"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="p-5 space-y-5 text-xs text-slate-600 flex-1">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm mb-1">Purpose & Primary Questions</h4>
                      <p>
                        Vendor dispositions provides operational transparency into vendor feedback. It answers:
                      </p>
                      <ul className="list-disc pl-5 mt-1 space-y-0.5 text-slate-700">
                        <li>What outcomes are recorded for each vendor?</li>
                        <li>How much feedback is missing, unmapped or ambiguous?</li>
                        <li>Which raw codes contribute to those outcomes?</li>
                        <li>Which authorized records support a selected result?</li>
                      </ul>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                      <h4 className="font-semibold text-slate-900">Reporting Modes & Denominators</h4>
                      <p>
                        <strong className="text-slate-800">1. Recorded Lead Status (Mode A):</strong> Evaluates the current recorded status for leads captured during the intake cohort period. The denominator is lead–vendor pairs with observed call activity. Repeated HLC entries are reconciled deterministically per lead-vendor pair.
                      </p>
                      <p>
                        <strong className="text-slate-800">Multi-Vendor Leads:</strong> A lead routed to two vendors contributes once to each applicable vendor. Consequently, cross-vendor pair totals may exceed distinct lead counts.
                      </p>
                      <p>
                        <strong className="text-slate-800">2. Call Outcomes (Mode B):</strong> Evaluates outcomes on recorded calls made during the selected date window (using <code>call_start_date</code>). Counted by verified call events or explicitly labeled dialler records.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">Status Recency & Conflict Resolution</h4>
                      <p>
                        <code>first_call_date</code> identifies the first contact attempt, not necessarily the latest status change. Where multiple contradictory status entries exist without a proven update timestamp, they are resolved to an explicit <code>CONFLICTING_EVIDENCE</code> category rather than arbitrarily picking a favorable outcome.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">Activity State vs. Call Outcomes</h4>
                      <p>
                        Not dialled is an activity state, not a call disposition. Missing feedback does not prove zero calls. Explicit zero-call pairs (where <code>total_calls = 0</code>) and unrecorded activity are tracked as separate activity populations and are not conflated with call outcomes.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">Commercial Flags Separation</h4>
                      <p>
                        A reported sale disposition is not an audited financial revenue event or guaranteed activation. Similarly, requested callbacks do not prove completed callbacks. Commercial flags are tracked as independent dimensions.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-[11px] text-slate-400">
                        Taxonomy Contract Version: {dispData?.reportVersion || DISPOSITION_REPORT_VERSION} · Approved Comparison Groups: 16
                      </span>
                    </div>
                  </div>
                </aside>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
