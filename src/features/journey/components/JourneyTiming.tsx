import React from 'react';
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
    { label: 'Capture → Delivery', value: velocity.fetchToDelivery, note: 'Routing and delivery' },
    { label: 'Delivery → First Dial', value: velocity.deliveryToFirstDial, note: 'Dialler response' },
    { label: 'First Dial → RPC', value: velocity.firstDialToContact, note: 'RPC timestamp unavailable' },
    { label: 'First Dial → Sale', value: velocity.contactToSale, note: 'Recorded sale timing' },
    { label: 'Sale → Activation', value: velocity.saleToActivation, note: 'Fulfilment timing' },
  ];

  return (
    <div className="bg-surface rounded-xl border border-border-subtle p-5 space-y-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {timingStages.map((stage) => {
          const isUnavailable = String(stage.value).toLowerCase() === 'unavailable' || !stage.value;
          return (
            <div
              key={stage.label}
              className={`p-3.5 rounded-lg border flex flex-col justify-between ${
                isUnavailable
                  ? 'bg-surface-subtle/50 border-border-subtle/60 text-text-mute'
                  : 'bg-surface border-border-subtle text-text-main shadow-2xs'
              }`}
            >
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-mute block">
                  {stage.label}
                </span>
                <span className="text-lg font-bold mt-1 block cx-tabular">
                  {isUnavailable ? 'Unavailable' : stage.value}
                </span>
              </div>
              <span className="text-[11px] text-text-sec mt-2 block">
                {stage.note}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
