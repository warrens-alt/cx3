import React from 'react';
import { CheckCircle2, AlertTriangle, CircleMinus, Link2, WalletCards, Database, Coins } from 'lucide-react';

export type CommercialEvidenceState = 'available' | 'incomplete' | 'unavailable';

export interface CommercialEvidenceItem {
  label: string;
  state: CommercialEvidenceState;
  detail: string;
}

interface CommercialEvidenceMapProps {
  items: CommercialEvidenceItem[];
}

const stateMeta = {
  available: { label: 'Available', icon: CheckCircle2 },
  incomplete: { label: 'Incomplete', icon: AlertTriangle },
  unavailable: { label: 'Unavailable', icon: CircleMinus },
} as const;

const itemIcons = [WalletCards, Coins, Link2, Database];

export default function CommercialEvidenceMap({ items }: CommercialEvidenceMapProps) {
  return (
    <section className="cx-commercial-evidence-map enterprise-card" aria-label="Commercial evidence map">
      <header>
        <div>
          <span className="cx-command-section-kicker">Evidence map</span>
          <h2>What commercial evidence can support</h2>
          <p>Available, incomplete and unavailable measures are separated before any cost or profitability interpretation.</p>
        </div>
      </header>
      <div className="cx-commercial-evidence-list">
        {items.map((item, index) => {
          const meta = stateMeta[item.state];
          const StateIcon = meta.icon;
          const ItemIcon = itemIcons[index % itemIcons.length];
          return (
            <article key={item.label} className="cx-commercial-evidence-row" data-state={item.state}>
              <span className="cx-commercial-evidence-topic"><ItemIcon size={15} aria-hidden="true" /></span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </div>
              <span className="cx-commercial-evidence-state">
                <StateIcon size={13} aria-hidden="true" />
                {meta.label}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
