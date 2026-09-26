import React from 'react';
import { PlayCircle, CheckCircle, Database, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

export default function DemoWorkspace() {
  return (
    <div className="cx-page space-y-6 p-6">
      <PageHeader
        title="Interactive Demo Workspace"
        subtitle="Explore ConversionX enterprise lead, calling, and commercial intelligence using verified sandbox data."
        badges={[
          { label: 'Sandbox Environment', variant: 'success' },
          { label: 'Multi-Tenant Ready', variant: 'neutral' },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="enterprise-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
            <PlayCircle className="w-5 h-5" />
            <h3>Lead & Calling Funnels</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Trace the complete lifecycle from ingestion through delivery, first dial attempt, right-party contact (RPC), and sales conversion.
          </p>
          <Link
            to="/funnel"
            className="inline-flex items-center gap-1.5 text-xs text-blue-700 font-medium hover:underline pt-2"
          >
            Launch Funnel Intelligence <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="enterprise-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
            <CheckCircle className="w-5 h-5" />
            <h3>Vendor Quality Scorecards</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Audit contactability rates, RPC performance, and verified sales yields across outbound and inbound vendor call centers.
          </p>
          <Link
            to="/vendor-quality"
            className="inline-flex items-center gap-1.5 text-xs text-blue-700 font-medium hover:underline pt-2"
          >
            View Vendor Quality <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="enterprise-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
            <Database className="w-5 h-5" />
            <h3>Commercial Reconciliation</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Reconcile expected, approved, invoiced, and collected revenue stages against immutable ledger transactions.
          </p>
          <Link
            to="/reconciliation"
            className="inline-flex items-center gap-1.5 text-xs text-blue-700 font-medium hover:underline pt-2"
          >
            Reconcile Commercial Ledger <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
