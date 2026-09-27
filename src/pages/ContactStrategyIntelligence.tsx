import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import ExportAnalysisButton from '../components/ExportAnalysisButton';
import { useOperationalData } from '../lib/useOperationalData';
import { GroupedOutcomeChart, VolumeRateComboChart } from '../components/charts/OperationalVisuals';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import {
  fetchContactStrategy,
  fetchContactDispositions,
  type ContactStrategyData,
  type ContactDispositionsData,
} from '../lib/offernetClient';
import { formatPercent, formatTableNumber } from '../lib/formatters';
import {
  APPROVED_DISPOSITION_GROUPS,
  type ApprovedDispositionGroup,
  type DispositionReportingMode,
} from '../../contracts/vendorDispositions';

export default function ContactStrategyIntelligence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();

  const [activeTab, setActiveTab] = useState<'call_counts' | 'vendor_dispositions'>('call_counts');
  const [dispositionMode, setDispositionMode] = useState<DispositionReportingMode>('lead_status');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('ALL');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Call-count outcomes data
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

  // Filtered detailed breakdown rows
  const filteredBreakdown = useMemo(() => {
    if (!dispData?.breakdown) return [];
    return dispData.breakdown.filter((row) => {
      if (selectedVendorFilter !== 'ALL' && row.vendor !== selectedVendorFilter) return false;
      if (selectedGroupFilter !== 'ALL' && row.approvedGroup !== selectedGroupFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = row.rawDisposition.toLowerCase().includes(q);
        const matchesDesc = row.rawDescription.toLowerCase().includes(q);
        const matchesGroup = row.approvedGroupLabel.toLowerCase().includes(q);
        const matchesVendor = row.vendor.toLowerCase().includes(q);
        if (!matchesCode && !matchesDesc && !matchesGroup && !matchesVendor) return false;
      }
      return true;
    });
  }, [dispData, selectedVendorFilter, selectedGroupFilter, searchQuery]);

  // Unique vendors for filter dropdown
  const vendorOptions = useMemo(() => {
    if (!dispData?.vendorSummaries) return [];
    return dispData.vendorSummaries.map((v) => v.vendor);
  }, [dispData]);

  // Chart data for dispositions by vendor
  const vendorChartData = useMemo(() => {
    if (!dispData?.vendorSummaries) return [];
    return dispData.vendorSummaries.map((v) => {
      const rpcRate = v.dialledCount > 0 ? (v.rpcCount / v.dialledCount) * 100 : 0;
      const saleRate = v.dialledCount > 0 ? (v.saleCount / v.dialledCount) * 100 : 0;
      const coverageRate = v.dispositionCoveragePct || 0;
      return {
        vendor: v.vendor,
        population: v.totalPopulation,
        dialled: v.dialledCount,
        recorded: v.recordedDispositionCount,
        missing: v.missingDispositionCount,
        unmapped: v.unmappedDispositionCount,
        rpc: v.rpcCount,
        sales: v.saleCount,
        callbacks: v.callbackCount,
        rpcRate: Number(rpcRate.toFixed(1)),
        saleRate: Number(saleRate.toFixed(1)),
        coverageRate: Number(coverageRate.toFixed(1)),
      };
    });
  }, [dispData]);

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
            <span className="cx-command-eyebrow">Contact</span>
            <h1>Contact performance</h1>
            <p>
              Observe contact yield across attempt saturation thresholds, or inspect raw and standardized call
              dispositions across authorized vendors.
            </p>
          </div>
        </header>

        {/* Sub Navigation */}
        <nav aria-label="Contact performance sub sections" className="cx-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('call_counts')}
            data-active={activeTab === 'call_counts'}
            className="cx-tab-item"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Call-count outcomes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vendor_dispositions')}
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

        {/* SUBTAB 2: Vendor Dispositions (New Report) */}
        {activeTab === 'vendor_dispositions' && (
          <>
            {dispError && (
              <div className="cx-command-error">
                <AlertTriangle size={17} />
                {dispError}
              </div>
            )}
            {dispLoading && !dispData && (
              <div className="cx-command-loading">
                <div className="cx-command-spinner" />
                Loading vendor dispositions…
              </div>
            )}

            {/* Mode Selector and Context Header */}
            <div className="cx-command-panel p-4 mb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Reporting Mode
                  </div>
                  <h3 className="text-base font-medium text-slate-900 mt-0.5">
                    {dispData?.modeHeading || 'Vendor Dispositions'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                    {dispData?.modeDescription}
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 self-start md:self-center">
                  <button
                    type="button"
                    onClick={() => setDispositionMode('lead_status')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      dispositionMode === 'lead_status'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Recorded lead status (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispositionMode('call_records')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      dispositionMode === 'call_records'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Call dispositions (Event grain)
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
                <span>
                  <strong className="text-slate-700">Date basis:</strong>{' '}
                  {dispData?.dateBasis === 'lead_capture_cohort'
                    ? 'Lead capture cohort'
                    : 'Call start date (call_start_date)'}
                </span>
                <span>
                  <strong className="text-slate-700">Counting grain:</strong>{' '}
                  {dispData?.countingGrain === 'lead_vendor_pairs'
                    ? 'Lead–vendor pairs (reconciled)'
                    : 'Dialler records (event level)'}
                </span>
                <span>
                  <strong className="text-slate-700">Contract version:</strong>{' '}
                  {dispData?.reportVersion || 'cx.dispositions.1.1.0'}
                </span>
              </div>
            </div>

            {dispData && (
              <>
                {/* Governance Summary KPI Strip */}
                <section
                  className="cx-command-metrics grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6"
                  aria-label="Vendor dispositions governance summary"
                >
                  <article className="cx-command-metric">
                    <span>
                      {dispositionMode === 'lead_status' ? 'Lead–vendor pairs' : 'Dialler records'}
                    </span>
                    <strong>{formatTableNumber(dispData.summary.totalEntities)}</strong>
                    <div>
                      <small>
                        {dispositionMode === 'lead_status' ? 'Total reconciled pairs' : 'Total call events'}
                      </small>
                    </div>
                  </article>

                  <article className="cx-command-metric">
                    <span>Dialled population</span>
                    <strong>{formatTableNumber(dispData.summary.dialledEntities)}</strong>
                    <div>
                      <small>
                        {dispData.summary.totalEntities > 0
                          ? formatPercent((dispData.summary.dialledEntities / dispData.summary.totalEntities) * 100)
                          : '—'}{' '}
                        of total
                      </small>
                    </div>
                  </article>

                  {dispositionMode === 'lead_status' && (
                    <article className="cx-command-metric">
                      <span>Zero-call pairs</span>
                      <strong>
                        {formatTableNumber(
                          dispData.vendorSummaries.reduce((acc, v) => acc + (v.zeroCallCount || 0), 0)
                        )}
                      </strong>
                      <div>
                        <small>Explicitly 0 calls (Activity state)</small>
                      </div>
                    </article>
                  )}

                  <article className="cx-command-metric">
                    <span>Recorded dispositions</span>
                    <strong>{formatTableNumber(dispData.summary.recordedDispositions)}</strong>
                    <div>
                      <small>
                        {formatPercent(dispData.summary.dispositionCoveragePct)} coverage of dialled
                      </small>
                    </div>
                  </article>

                  <article className="cx-command-metric">
                    <span>Missing dispositions</span>
                    <strong>{formatTableNumber(dispData.summary.missingDispositions)}</strong>
                    <div>
                      <small>Dialled with blank status</small>
                    </div>
                  </article>

                  <article className="cx-command-metric">
                    <span>Unmapped dispositions</span>
                    <strong>{formatTableNumber(dispData.summary.unmappedDispositions)}</strong>
                    <div>
                      <small>Nonblank code not classified</small>
                    </div>
                  </article>
                </section>

                {/* Rates Bar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                  <div className="p-3 rounded-lg border border-sky-100 bg-sky-50/50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-sky-800">Right-Party Contact (RPC)</div>
                      <div className="text-lg font-bold text-sky-950 mt-0.5">
                        {formatTableNumber(dispData.summary.rpcCount)}{' '}
                        <span className="text-xs font-normal text-sky-700">
                          (
                          {dispData.summary.dialledEntities > 0
                            ? formatPercent((dispData.summary.rpcCount / dispData.summary.dialledEntities) * 100)
                            : '—'}
                          )
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-sky-600 text-right">Human contact</div>
                  </div>

                  <div className="p-3 rounded-lg border border-emerald-100 bg-emerald-50/50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-emerald-800">Reported Sales</div>
                      <div className="text-lg font-bold text-emerald-950 mt-0.5">
                        {formatTableNumber(dispData.summary.saleCount)}{' '}
                        <span className="text-xs font-normal text-emerald-700">
                          (
                          {dispData.summary.dialledEntities > 0
                            ? formatPercent((dispData.summary.saleCount / dispData.summary.dialledEntities) * 100, 2)
                            : '—'}
                          )
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-emerald-600 text-right">Sale on disposition</div>
                  </div>

                  <div className="p-3 rounded-lg border border-purple-100 bg-purple-50/50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-purple-800">Callbacks Requested</div>
                      <div className="text-lg font-bold text-purple-950 mt-0.5">
                        {formatTableNumber(dispData.summary.callbackCount)}{' '}
                        <span className="text-xs font-normal text-purple-700">
                          (
                          {dispData.summary.dialledEntities > 0
                            ? formatPercent(
                                (dispData.summary.callbackCount / dispData.summary.dialledEntities) * 100,
                                1
                              )
                            : '—'}
                          )
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-purple-600 text-right">Follow-up requested</div>
                  </div>
                </div>

                {/* Visuals Grid */}
                <div className="cx-analytics-visual-grid mb-6">
                  <GroupedOutcomeChart
                    title={
                      dispositionMode === 'lead_status'
                        ? 'Vendor status coverage & outcomes'
                        : 'Dialler outcomes by vendor'
                    }
                    subtitle="Observed volume of dialled population, recorded dispositions, RPC, and sales."
                    data={vendorChartData}
                    xKey="vendor"
                    series={[
                      { key: 'dialled', label: 'Dialled' },
                      { key: 'recorded', label: 'Recorded Dispositions' },
                      { key: 'rpc', label: 'RPC' },
                      { key: 'sales', label: 'Sales' },
                    ]}
                  />
                  <VolumeRateComboChart
                    title="Vendor conversion yield"
                    subtitle="Population volume with RPC rate and sale rate overlaid."
                    data={vendorChartData}
                    xKey="vendor"
                    volumeKey="population"
                    volumeLabel={dispositionMode === 'lead_status' ? 'Lead–Vendor Pairs' : 'Dialler Records'}
                    rateSeries={[
                      { key: 'rpcRate', label: 'RPC rate %' },
                      { key: 'saleRate', label: 'Sale rate %' },
                      { key: 'coverageRate', label: 'Disposition coverage %' },
                    ]}
                  />
                </div>

                {/* Section A: Vendor Summary Table */}
                <section className="cx-command-panel mb-6">
                  <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="cx-command-section-kicker">Vendor governance</span>
                      <h2>Vendor disposition summary</h2>
                      <p>
                        Mode-specific counts, disposition coverage, mapping completeness, and commercial outcomes.
                      </p>
                    </div>
                    <ExportAnalysisButton
                      filename={`vendor_dispositions_summary_${dispositionMode}`}
                      rows={[
                        [
                          'Vendor',
                          'Total Population',
                          'Dialled Count',
                          ...(dispositionMode === 'lead_status' ? ['Zero Calls', 'Unrecorded Activity'] : []),
                          'Recorded Dispositions',
                          'Missing Dispositions',
                          'Unmapped Dispositions',
                          'Disposition Coverage %',
                          'Mapping Coverage %',
                          'RPC Count',
                          'Sale Count',
                          'Callback Count',
                          'Source Table',
                          'Date Basis',
                        ],
                        ...dispData.vendorSummaries.map((v) => [
                          v.vendor,
                          v.totalPopulation,
                          v.dialledCount,
                          ...(dispositionMode === 'lead_status'
                            ? [v.zeroCallCount ?? 0, v.unrecordedActivityCount ?? 0]
                            : []),
                          v.recordedDispositionCount,
                          v.missingDispositionCount,
                          v.unmappedDispositionCount,
                          v.dispositionCoveragePct,
                          v.mappingCoveragePct,
                          v.rpcCount,
                          v.saleCount,
                          v.callbackCount,
                          v.sourceTable,
                          v.dateBasis,
                        ]),
                      ]}
                      definitions={[
                        dispData.methodology,
                        'Disposition coverage % = recorded dispositions / dialled population.',
                        'Mapping coverage % = classified dispositions / recorded dispositions.',
                      ]}
                    />
                  </header>

                  <div className="cx-performance-table-wrap">
                    <table className="cx-performance-table">
                      <thead>
                        <tr>
                          <th>Vendor</th>
                          <th>Total Pop</th>
                          <th>Dialled</th>
                          {dispositionMode === 'lead_status' && <th>Zero calls</th>}
                          {dispositionMode === 'lead_status' && <th>Unrecorded</th>}
                          <th>Recorded Disp</th>
                          <th>Missing Disp</th>
                          <th>Unmapped</th>
                          <th>Disp Coverage</th>
                          <th>Mapping Coverage</th>
                          <th>RPC</th>
                          <th>RPC rate</th>
                          <th>Sales</th>
                          <th>Sale rate</th>
                          <th>Callbacks</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dispData.vendorSummaries.map((v) => {
                          const rpcRate =
                            v.dialledCount > 0 ? formatPercent((v.rpcCount / v.dialledCount) * 100) : '—';
                          const saleRate =
                            v.dialledCount > 0 ? formatPercent((v.saleCount / v.dialledCount) * 100, 2) : '—';
                          const isSelected = selectedVendorFilter === v.vendor;

                          return (
                            <tr
                              key={v.vendor}
                              className={isSelected ? 'bg-sky-50/60 font-medium' : undefined}
                            >
                              <th>{v.vendor}</th>
                              <td>{formatTableNumber(v.totalPopulation)}</td>
                              <td>{formatTableNumber(v.dialledCount)}</td>
                              {dispositionMode === 'lead_status' && (
                                <td>{formatTableNumber(v.zeroCallCount ?? 0)}</td>
                              )}
                              {dispositionMode === 'lead_status' && (
                                <td>{formatTableNumber(v.unrecordedActivityCount ?? 0)}</td>
                              )}
                              <td>{formatTableNumber(v.recordedDispositionCount)}</td>
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
                              <td>{formatPercent(v.dispositionCoveragePct)}</td>
                              <td>{formatPercent(v.mappingCoveragePct)}</td>
                              <td>{formatTableNumber(v.rpcCount)}</td>
                              <td>{rpcRate}</td>
                              <td>{formatTableNumber(v.saleCount)}</td>
                              <td>{saleRate}</td>
                              <td>{formatTableNumber(v.callbackCount)}</td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedVendorFilter(isSelected ? 'ALL' : v.vendor)
                                  }
                                  className="text-xs text-sky-700 hover:text-sky-900 font-medium underline inline-flex items-center gap-1"
                                >
                                  {isSelected ? 'Clear drilldown' : 'Drill raw'}
                                  <ChevronRight size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Section B: Raw Disposition Drilldown */}
                <section className="cx-command-panel mb-6">
                  <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="cx-command-section-kicker">Raw telemetry & mapping</span>
                      <h2>Raw disposition drilldown</h2>
                      <p>
                        Preserves vendor-specific raw codes, descriptions, comparison group classification, and
                        overlapping RPC/Sale/Callback markers.
                      </p>
                    </div>
                    <ExportAnalysisButton
                      filename={`raw_dispositions_drilldown_${dispositionMode}`}
                      rows={[
                        [
                          'Vendor',
                          'Raw Disposition Code',
                          'Raw Description',
                          'Approved Comparison Group',
                          'Count',
                          '% of Vendor Base',
                          'RPC Count',
                          'Sale Count',
                          'Callback Count',
                          'Avg Duration (s)',
                          'Latest Observation',
                        ],
                        ...filteredBreakdown.map((r) => [
                          r.vendor,
                          r.rawDisposition,
                          r.rawDescription,
                          r.approvedGroupLabel,
                          r.count,
                          r.percentOfBase,
                          r.rpcCount,
                          r.saleCount,
                          r.callbackCount,
                          r.avgDurationSec ?? '—',
                          r.latestObservation ?? '—',
                        ]),
                      ]}
                      definitions={[
                        'Keyed by vendor + source system + raw disposition.',
                        'Sale does not automatically imply RPC.',
                        'Requested callback does not prove completed callback.',
                      ]}
                    />
                  </header>

                  {/* Filter Toolbar */}
                  <div className="p-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Filter size={13} />
                        <span>Vendor:</span>
                        <select
                          value={selectedVendorFilter}
                          onChange={(e) => setSelectedVendorFilter(e.target.value)}
                          className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800"
                        >
                          <option value="ALL">All Vendors ({vendorOptions.length})</option>
                          {vendorOptions.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span>Group:</span>
                        <select
                          value={selectedGroupFilter}
                          onChange={(e) => setSelectedGroupFilter(e.target.value)}
                          className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800"
                        >
                          <option value="ALL">All Comparison Groups</option>
                          {Object.values(APPROVED_DISPOSITION_GROUPS).map((g) => (
                            <option key={g.code} value={g.code}>
                              {g.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search raw code or description…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-slate-800 w-56"
                      />
                    </div>
                  </div>

                  <div className="cx-performance-table-wrap">
                    <table className="cx-performance-table">
                      <thead>
                        <tr>
                          <th>Vendor</th>
                          <th>Raw Code</th>
                          <th>Raw Description</th>
                          <th>Comparison Group</th>
                          <th>Count</th>
                          <th>% of Vendor</th>
                          <th>RPC</th>
                          <th>Sale</th>
                          <th>Callback</th>
                          {dispositionMode === 'call_records' && <th>Avg Sec</th>}
                          <th>Mapping Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBreakdown.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="text-center py-6 text-slate-500 text-xs">
                              No raw dispositions match the active filter criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredBreakdown.map((row, idx) => {
                            const groupCfg = APPROVED_DISPOSITION_GROUPS[row.approvedGroup];
                            const isMissing = row.approvedGroup === 'MISSING_DISPOSITION';
                            const isUnmapped = row.approvedGroup === 'UNMAPPED';

                            return (
                              <tr key={`${row.vendor}-${row.rawDisposition}-${idx}`}>
                                <th>{row.vendor}</th>
                                <td>
                                  <code className="text-xs px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-800 border border-slate-200">
                                    {row.rawDisposition}
                                  </code>
                                </td>
                                <td>{row.rawDescription}</td>
                                <td>
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{
                                      backgroundColor: `${groupCfg?.color || '#cbd5e1'}18`,
                                      color: groupCfg?.color || '#334155',
                                      border: `1px solid ${groupCfg?.color || '#cbd5e1'}40`,
                                    }}
                                  >
                                    {row.approvedGroupLabel}
                                  </span>
                                </td>
                                <td>{formatTableNumber(row.count)}</td>
                                <td>{formatPercent(row.percentOfBase)}</td>
                                <td>{row.rpcCount > 0 ? formatTableNumber(row.rpcCount) : '—'}</td>
                                <td>
                                  {row.saleCount > 0 ? (
                                    <strong className="text-emerald-700">{formatTableNumber(row.saleCount)}</strong>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td>{row.callbackCount > 0 ? formatTableNumber(row.callbackCount) : '—'}</td>
                                {dispositionMode === 'call_records' && (
                                  <td>{row.avgDurationSec !== null ? `${row.avgDurationSec}s` : '—'}</td>
                                )}
                                <td>
                                  {isMissing ? (
                                    <span className="text-xs text-rose-700 font-medium inline-flex items-center gap-1">
                                      <AlertCircle size={11} /> Missing
                                    </span>
                                  ) : isUnmapped ? (
                                    <span className="text-xs text-purple-700 font-medium inline-flex items-center gap-1">
                                      <HelpCircle size={11} /> Unmapped
                                    </span>
                                  ) : (
                                    <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
                                      <CheckCircle2 size={11} /> Approved
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
                </section>

                {/* Governance Guardrails & Integrity Notes */}
                <section className="cx-command-panel">
                  <header>
                    <div>
                      <span className="cx-command-section-kicker">Governance guardrails</span>
                      <h2>Disposition methodology & evidence boundaries</h2>
                    </div>
                  </header>
                  <div className="p-4 space-y-3 text-xs text-slate-600 bg-slate-50/50 rounded-b-lg">
                    <div className="flex items-start gap-2">
                      <ShieldCheck size={15} className="text-sky-700 mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-slate-900">Activity State vs Call Disposition:</strong> Not
                        dialled is an activity state, not a call disposition. Missing feedback does not prove zero
                        calls. Explicit zero-call pairs and unrecorded call activity are reported in separate
                        populations.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Info size={15} className="text-sky-700 mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-slate-900">Deterministic Grain & Recency:</strong> Mode A
                        evaluates exactly one lead–vendor pair after deterministic recency reconciliation of{' '}
                        <code>hlc_details</code> (using call timestamp, delivery timestamp, and transaction ID). It
                        does not select one vendor and discard others.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={15} className="text-amber-700 mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-slate-900">Snapshot Caveat:</strong> Mode A displays the current
                        recorded status for the selected capture cohort. It does not imply that historical status at
                        period end is reconstructed without full event ledgering.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Info size={15} className="text-sky-700 mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-slate-900">Dialler Event Identity:</strong> In Mode B, metrics are
                        labeled <em>Dialler records</em> until event uniqueness is formally certified against switch
                        logs. Uses call-start date semantics rather than capture cohort semantics.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={15} className="text-emerald-700 mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-slate-900">Overlapping Commercial Flags:</strong> A reported sale
                        does not automatically imply right-party contact (RPC). A requested callback does not prove
                        callback completion. These remain distinct, non-exclusive measures.
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
