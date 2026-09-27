import React from 'react';
import { Link } from 'react-router-dom';
import { Info, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { useOverviewModel } from './model/useOverviewModel';
import OutcomeStrip from './components/OutcomeStrip';
import PerformanceTrend from './components/PerformanceTrend';
import AttentionList from './components/AttentionList';
import JourneySummary from './components/JourneySummary';
import SegmentComparison from './components/SegmentComparison';
import InspectorHost from '../../shared/evidence/InspectorHost';
import ReportingScopeBar from '../../shared/reporting/ReportingScopeBar';
import { OperationalEmpty, OperationalError, OverviewSkeleton } from '../../components/OperationalState';
import { statusLabel } from '../../lib/statusPresentation';
import { useScopedNavigationTarget } from '../../hooks/useScopedNavigationTarget';
import RootCauseDrawer from '../../components/RootCauseDrawer';

export default function OverviewPage() {
  const scoped = useScopedNavigationTarget();
  const {
    data,
    loading,
    error,
    refreshAll,
    isAdmin,
    inspectorContent,
    setInspectorContent,
    closeInspector,
    rootMetric,
    setRootMetric,
  } = useOverviewModel();

  return (
    <div className="space-y-6">
      {/* Scope Bar */}
      <ReportingScopeBar onRefresh={refreshAll} />

      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text-main">
            {data?.clientName || 'Overview'}
          </h1>
          <p className="text-sm text-text-sec mt-1">
            Follow acquired demand through intake, delivery, contact, sales, and activations.
          </p>
        </div>

        <Link
          to={scoped('/reports')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle transition-colors text-xs text-text-sec shadow-xs"
          title="Inspect evidence and verification status"
        >
          <Info size={14} className="text-brand-primary" aria-hidden="true" />
          <span>
            <strong>{statusLabel(data?.validationStatus || 'NOT_VERIFIED')}</strong>
            <span className="text-text-mute ml-1">· Evidence status</span>
          </span>
          <ArrowRight size={13} className="text-text-mute" />
        </Link>
      </header>

      {/* Error state */}
      {error && (
        <OperationalError
          message={error}
          onRetry={() => { void refreshAll(); }}
          retrying={loading}
        />
      )}

      {/* Loading Skeleton */}
      {loading && !data && <OverviewSkeleton />}

      {/* Updating indicator */}
      {loading && data && (
        <p className="cx-view-updating text-xs text-text-mute flex items-center gap-1.5" role="status">
          <RefreshCw size={12} className="animate-spin text-brand-primary" />
          <span>Updating overview evidence…</span>
        </p>
      )}

      {/* Populated Content */}
      {data && (
        <>
          {/* 1. Principal Supported Outcome Measures */}
          <OutcomeStrip
            data={data}
            onInspect={content => setInspectorContent(content)}
            isAdmin={isAdmin}
          />

          {data.kpis?.fetchedLeads === 0 && (
            <OperationalEmpty title="No leads in this selection">
              Try a different period or remove a filter. Measured counts remain zero; rates without a population are unavailable.
            </OperationalEmpty>
          )}

          {/* 2. Primary 8/4 Layout: Performance Trend (2/3) + Needs Attention (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8">
              <PerformanceTrend
                data={data.dailyTrends}
                comparisonWindow={data.comparisonWindow}
              />
            </div>
            <div className="lg:col-span-4">
              <AttentionList
                items={data.attention as any}
                isAdmin={isAdmin}
              />
            </div>
          </div>

          {/* 3. Lead-to-Activation Progression Journey */}
          <JourneySummary
            stages={data.funnelStages}
            funnelLeak={data.funnelLeak}
            isAdmin={isAdmin}
          />

          {/* 4. Segment Comparison (Replaces stacked tables with Tabbed Vendor / Source / Grade) */}
          <SegmentComparison data={(data as any).segments ?? (data as any).backlog} />
        </>
      )}

      {/* Contextual Inspector Modal */}
      <InspectorHost
        open={inspectorContent !== null}
        onClose={closeInspector}
        content={inspectorContent}
      />

      {/* Root Cause Drawer for drilldowns */}
      <RootCauseDrawer
        open={rootMetric !== null}
        metric={rootMetric}
        onClose={() => setRootMetric(null)}
      />
    </div>
  );
}
