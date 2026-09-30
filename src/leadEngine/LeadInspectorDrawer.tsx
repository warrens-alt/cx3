import React, { useEffect, useState } from 'react';
import {
  X,
  Copy,
  Check,
  ShieldCheck,
  PhoneCall,
  Clock,
  CircleDollarSign,
  Send,
  Building,
  Radio,
  FileText,
  Activity,
  UserCheck,
} from 'lucide-react';

interface LeadInspectorDrawerProps {
  lead: Record<string, any> | null;
  onClose: () => void;
}

export default function LeadInspectorDrawer({ lead, onClose }: LeadInspectorDrawerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!lead) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const isDelivered = lead.hlc_status === 'Delivered';
  const isRpc = lead.hlc_rpc === 'Confirmed';
  const isValidId = lead.valid_idno === 'true' || lead.valid_idno === true;
  const isValidPhone = lead.phone_valid === 'true' || lead.phone_valid === true;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-950/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white border-l border-neutral-200 shadow-2xl flex flex-col font-sans">
          {/* Header */}
          <div className="p-5 bg-neutral-950 text-white border-b border-neutral-800 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                  Lead Intelligence Record
                </span>
                <span className="text-neutral-600">·</span>
                <span className="text-xs text-neutral-300 font-mono">
                  ID: #{lead.lead_id}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(String(lead.lead_id), 'lead-id')}
                  className="text-neutral-400 hover:text-white transition-colors p-1"
                  title="Copy Lead ID"
                >
                  {copiedId === 'lead-id' ? <Check size={14} className="text-neutral-200" /> : <Copy size={14} />}
                </button>
              </div>
              <h2 id="drawer-title" className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Consumer #{lead.consumer_id || lead.lead_id}</span>
                <span className="text-xs px-2.5 py-0.5 rounded font-mono font-medium bg-neutral-800 text-neutral-200 border border-neutral-700">
                  {lead.hlc_lead_tier || (lead.offershop_grade ? `Grade ${lead.offershop_grade}` : 'Not reported')}
                </span>
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              aria-label="Close Inspector"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-neutral-50">
            {/* Quick KPI Strip */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded-lg border border-neutral-200">
                <span className="text-[10.5px] uppercase font-mono tracking-wider text-neutral-500 block">Delivery</span>
                <strong className="text-sm font-semibold text-neutral-900 block mt-0.5">
                  {lead.hlc_status ?? 'Not reported'}
                </strong>
              </div>
              <div className="p-3 bg-white rounded-lg border border-neutral-200">
                <span className="text-[10.5px] uppercase font-mono tracking-wider text-neutral-500 block">RPC Status</span>
                <strong className="text-sm font-semibold text-neutral-900 block mt-0.5">
                  {lead.hlc_rpc ?? 'Not reported'}
                </strong>
              </div>
              <div className="p-3 bg-white rounded-lg border border-neutral-200">
                <span className="text-[10.5px] uppercase font-mono tracking-wider text-neutral-500 block">Realized Yield</span>
                <strong className="text-sm font-semibold font-mono text-neutral-900 block mt-0.5">
                  {lead.hlc_revenue_generated ?? 'Not reported'}
                </strong>
              </div>
              <div className="p-3 bg-white rounded-lg border border-neutral-200">
                <span className="text-[10.5px] uppercase font-mono tracking-wider text-neutral-500 block">Agreed Rate</span>
                <strong className="text-sm font-semibold font-mono text-neutral-900 block mt-0.5">
                  {lead.hlc_payout_rate ?? 'Not reported'}
                </strong>
              </div>
            </div>

            {/* HLC Partner Delivery Card - 18 Exploded Variables */}
            <div className="bg-white rounded-lg border border-neutral-200 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-neutral-100 text-neutral-800 flex items-center justify-center font-bold border border-neutral-200">
                    <Radio size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 tracking-tight">HLC Partner Delivery Telemetry</h3>
                    <p className="text-[11px] text-neutral-500">Unpacked from BigQuery nested RECORD (18 distinct variables)</p>
                  </div>
                </div>
                <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 font-semibold border border-neutral-300">
                  RECORD EXPLODED
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3.5 gap-x-4 text-xs">
                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[1] Partner Vendor</span>
                  <strong className="text-neutral-900 font-semibold block mt-0.5 flex items-center gap-1.5">
                    <Building size={12} className="text-neutral-600" />
                    {lead.hlc_vendor ?? 'Not reported'}
                  </strong>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[2] Vendor Transaction ID</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-mono text-neutral-800 truncate">{lead.hlc_transaction_id ?? 'Not reported'}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(lead.hlc_transaction_id, 'txn-id')}
                      className="text-neutral-400 hover:text-neutral-700 p-0.5"
                    >
                      {copiedId === 'txn-id' ? <Check size={11} className="text-neutral-900" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[3] Delivery Status</span>
                  <span className="text-neutral-900 font-medium block mt-0.5">
                    {lead.hlc_status ?? 'Not reported'}
                  </span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[4] Attempted Timestamp</span>
                  <span className="font-mono text-neutral-700 block mt-0.5 truncate">{lead.hlc_attempted_to_deliver ?? 'Not reported'}</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[5] Delivery Confirmed</span>
                  <span className="font-mono text-neutral-700 block mt-0.5 truncate">{lead.hlc_delivered ?? 'Not reported'}</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[6] Right Party Contact</span>
                  <strong className="text-neutral-900 font-medium block mt-0.5">
                    {lead.hlc_rpc ?? 'Not reported'}
                  </strong>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[7] Realized Revenue</span>
                  <span className="font-mono font-bold text-neutral-900 block mt-0.5">{lead.hlc_revenue_generated ?? 'Not reported'}</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[8] Telecom Dialler Fee</span>
                  <span className="font-mono text-neutral-700 block mt-0.5">{lead.hlc_dialer_cost ?? 'Not reported'}</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[9] HTTP Response Code</span>
                  <span className="font-mono text-neutral-800 block mt-0.5">{lead.hlc_response_code ?? 'Not reported'}</span>
                </div>

                <div className="col-span-2">
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[10] Dialler Response Message</span>
                  <span className="text-neutral-800 block mt-0.5 italic">{lead.hlc_response_message ?? 'Not reported'}</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[11] Call Duration</span>
                  <span className="font-mono text-neutral-700 block mt-0.5">{lead.hlc_call_duration_seconds ?? 'Not reported'} seconds</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[12] Dialler Attempts</span>
                  <span className="font-mono text-neutral-700 block mt-0.5">{lead.hlc_dialer_attempts ?? 'Not reported'} calls</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[13] Last Call Disposition</span>
                  <span className="text-neutral-800 font-medium block mt-0.5">{lead.hlc_last_dialer_status ?? 'Not reported'}</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[14] Buyer Contract ID</span>
                  <span className="font-mono text-neutral-800 block mt-0.5">{lead.hlc_buyer_contract_id ?? 'Not reported'}</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[15] Contracted Payout Rate</span>
                  <span className="font-mono text-neutral-900 font-semibold block mt-0.5">{lead.hlc_payout_rate ?? 'Not reported'}</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[16] Commercial Tier</span>
                  <span className="text-neutral-800 font-medium block mt-0.5">{lead.hlc_lead_tier ?? 'Not reported'}</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[17] POPIA / GDPR Verified</span>
                  <span className="font-mono text-neutral-600 block mt-0.5 truncate">{lead.hlc_optin_verified ?? 'Not reported'}</span>
                </div>

                <div className="col-span-2">
                  <span className="text-neutral-500 block text-[10.5px] font-medium">[18] Transmission Ref</span>
                  <span className="font-mono text-[11px] text-neutral-600 block mt-0.5 break-all">{lead.hlc_transmission_id ?? 'Not reported'}</span>
                </div>
              </div>
            </div>

            {/* Core Customer Demographics & Data Hygiene */}
            <div className="bg-white rounded-lg border border-neutral-200 p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-neutral-100">
                <div className="w-8 h-8 rounded bg-neutral-100 text-neutral-800 flex items-center justify-center font-bold border border-neutral-200">
                  <UserCheck size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 tracking-tight">Core Lead Demographics & Hygiene</h3>
                  <p className="text-[11px] text-neutral-500">Citizen identity, contact validation, and funnel source</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3.5 gap-x-4 text-xs">
                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">Offershop Source</span>
                  <span className="text-neutral-900 font-semibold block mt-0.5 truncate">{lead.offershop_source ?? 'Not reported'}</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">Campaign Medium</span>
                  <span className="text-neutral-800 font-mono block mt-0.5">{lead.offernet_medium ?? 'Not reported'}</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">Ingestion Date</span>
                  <span className="text-neutral-700 font-mono block mt-0.5 truncate">{lead.fetched ?? 'Not reported'}</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">ID Luhn Compliance</span>
                  <span className={`block mt-0.5 font-mono ${isValidId ? 'font-semibold text-neutral-900' : 'text-neutral-400'}`}>
                    {lead.valid_idno == null ? 'Not reported' : isValidId ? 'PASS (Luhn Mod-10)' : 'FAIL'}
                  </span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">Mobile E.164 Compliance</span>
                  <span className={`block mt-0.5 font-mono ${isValidPhone ? 'font-semibold text-neutral-900' : 'text-neutral-400'}`}>
                    {lead.phone_valid == null ? 'Not reported' : isValidPhone ? 'PASS (E.164 MSISDN)' : 'FAIL'}
                  </span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10.5px] font-medium">Dual Compliance</span>
                  <span className={`block mt-0.5 font-mono ${lead.valid_lead ? 'font-semibold text-neutral-900' : 'text-neutral-400'}`}>
                    {lead.valid_lead == null ? 'Not reported' : lead.valid_lead === true || lead.valid_lead === 'true' ? 'PASS (Dual Compliant)' : 'FAIL'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-white border-t border-neutral-200 flex items-center justify-between text-xs">
            <span className="text-neutral-500 font-mono text-[11px]">BigQuery: clustered_lead_ledger</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded font-medium transition-colors cursor-pointer"
            >
              Done Inspecting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
