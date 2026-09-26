import React, { useEffect, useState } from 'react';
import { X, Clock, CheckCircle2, User, Phone, DollarSign, Activity } from 'lucide-react';

interface Props {
  leadId: string;
  onClose: () => void;
}

export function LeadTimelineModal({ leadId, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analytics/lead-timeline/${leadId}`)
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) {
          setData(res.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [leadId]);

  if (!leadId) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 sm:p-8 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center bg-surface/50">
          <div>
            <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
              <User className="w-5 h-5 text-text-mute" />
              Lead Explorer: {leadId}
            </h2>
            <p className="text-sm text-text-sec mt-1">Full transaction timeline and vendor handoffs.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-text-sec hover:bg-surface-sec hover:text-text-main rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-surface-sec/30">
          {loading ? (
            <div className="flex justify-center py-20 text-text-sec">Loading timeline...</div>
          ) : !data || data.length === 0 ? (
            <div className="flex justify-center py-20 text-text-sec">No timeline data found for this lead.</div>
          ) : (
            <div className="space-y-6">
              {data.map((tx: any, idx: number) => {
                // Determine sequence of events in this transaction
                const events = [];
                
                if (tx.capture_timestamp) {
                  events.push({ time: tx.capture_timestamp, name: 'Captured', icon: <Clock className="w-4 h-4 text-slate-500" /> });
                }
                if (tx.delivery_timestamp) {
                  events.push({ time: tx.delivery_timestamp, name: 'Delivered', icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> });
                }
                if (tx.first_call_timestamp) {
                  events.push({ 
                    time: tx.first_call_timestamp, 
                    name: `First Call (${tx.total_calls} total)`, 
                    sub: tx.latest_dialer_status,
                    icon: <Phone className="w-4 h-4 text-emerald-500" /> 
                  });
                }
                if (tx.rpc) {
                  events.push({ time: tx.first_call_timestamp || tx.capture_timestamp, name: 'RPC (Contacted)', icon: <User className="w-4 h-4 text-emerald-600" /> });
                }
                if (tx.sale_timestamp || tx.sale) {
                  events.push({ time: tx.sale_timestamp || tx.first_call_timestamp, name: 'Sale Closed', icon: <DollarSign className="w-4 h-4 text-indigo-500" /> });
                }
                if (tx.activation_timestamp || tx.activation) {
                  events.push({ time: tx.activation_timestamp || tx.sale_timestamp, name: 'Activated', icon: <Activity className="w-4 h-4 text-indigo-600" /> });
                }

                // Deduplicate times somewhat crudely, keeping original order
                return (
                  <div key={idx} className="bg-white rounded-lg border border-border-strong p-5 shadow-sm">
                    <h3 className="font-semibold text-sm text-text-main mb-4 flex items-center justify-between">
                      <span>Transaction {idx + 1} &rarr; <span className="text-brand">{tx.vendor || 'Unknown Vendor'}</span></span>
                      {tx.transaction_id && <span className="text-xs text-text-mute font-normal font-mono">{tx.transaction_id}</span>}
                    </h3>
                    
                    <div className="relative border-l-2 border-border-strong ml-3 space-y-6">
                      {events.map((ev, eIdx) => (
                        <div key={eIdx} className="relative pl-6">
                          <div className="absolute -left-[11px] top-1 bg-white border border-border-strong rounded-full p-1 shadow-sm">
                            {ev.icon}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-text-main">{ev.name}</div>
                            {ev.time && (
                              <div className="text-xs text-text-sec mt-0.5">
                                {new Date(ev.time.value || ev.time).toLocaleString()}
                              </div>
                            )}
                            {ev.sub && <div className="text-xs text-text-sec mt-1 bg-surface-sec inline-block px-2.5 py-1 rounded">{ev.sub}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
