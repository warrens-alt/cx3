import React from 'react';
import EvidenceTimeline from '../../../shared/visuals/EvidenceTimeline';
import { lifecyclePresentation } from '../../../shared/visuals/lifecyclePresentation';
import { ArrowRight, Clock3, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';

interface JourneyTimingProps {
  velocity?: {
    fetchToDelivery: string;
    deliveryToFirstDial: string;
    firstDialToContact: string;
    contactToSale: string;
    saleToActivation: string;
  };
  speedToLeadPath?: string | { pathname: string; search: string };
}

export default function JourneyTiming({ velocity, speedToLeadPath }: JourneyTimingProps) {
  if (!velocity) return null;

  const timingStages = [
    { stage: 'delivered' as const, label: 'Capture → Delivery', value: velocity.fetchToDelivery, note: 'Routing and delivery' },
    { stage: 'dialled' as const, label: 'Delivery → First Dial', value: velocity.deliveryToFirstDial, note: 'Dialler response' },
    { stage: 'rpc' as const, label: 'First Dial → RPC', value: velocity.firstDialToContact, note: 'RPC timestamp unavailable' },
    { stage: 'sales' as const, label: 'First Dial → Sale', value: velocity.contactToSale, note: 'Recorded sale timing' },
    { stage: 'activated' as const, label: 'Sale → Activation', value: velocity.saleToActivation, note: 'Fulfilment timing' },
  ];

  return (
    <div className="cx-journey-timing bg-surface rounded-xl border border-border-subtle p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Clock3 size={16} className="text-brand-primary" />
          <h3 className="text-xs font-semibold text-text-mute uppercase tracking-wider">
            Lifecycle Timing Durations
          </h3>
        </div>

        {speedToLeadPath && (
          <Link
            to={speedToLeadPath}
            className="inline-flex items-center gap-1.5 text-xs text-brand-primary font-medium hover:underline"
          >
            <Timer size={13} />
            <span>Open complete Response speed analysis</span>
            <ArrowRight size={13} />
          </Link>
        )}
      </div>

      <EvidenceTimeline title="Returned lifecycle timing durations" events={timingStages.map(stage => ({
        key: stage.stage, label: stage.label, value: stage.value || 'Unavailable', detail: stage.note,
        state: !stage.value || /^(unavailable|not recorded|[—–-])$/i.test(String(stage.value).trim()) ? 'unavailable' : 'observed',
        Icon: lifecyclePresentation[stage.stage].Icon, color: lifecyclePresentation[stage.stage].color,
      }))} />
      <p className="cx-viz-footnote">Each duration is a returned interval for its labelled event pair. Intervals use different eligible populations and are not additive.</p>
    </div>
  );
}
