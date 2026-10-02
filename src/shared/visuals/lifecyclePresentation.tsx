import { Inbox, Send, PhoneCall, UserCheck, BadgeCheck, Zap, Search, ShieldCheck, Database, Clock3, Building2, Headphones, CircleDollarSign, AlertTriangle, Filter } from 'lucide-react';

/** Presentation only. Stage identity must never depend on navigation area or status. */
export const lifecyclePresentation = {
  fetched: { label: 'Fetched', color: 'var(--cx-data-fetched)', Icon: Inbox },
  delivered: { label: 'Delivered', color: 'var(--cx-data-delivered)', Icon: Send },
  dialled: { label: 'Dialled', color: 'var(--cx-data-dialled)', Icon: PhoneCall },
  rpc: { label: 'RPC', color: 'var(--cx-data-rpc)', Icon: UserCheck },
  sales: { label: 'Sales', color: 'var(--cx-data-sales)', Icon: BadgeCheck },
  activated: { label: 'Activation', color: 'var(--cx-data-activation)', Icon: Zap },
} as const;
export type LifecycleStage = keyof typeof lifecyclePresentation;
export const conceptIcons = {
  investigation: Search, evidence: ShieldCheck, trust: ShieldCheck, source: Database,
  timing: Clock3, vendor: Building2, agent: Headphones, commercial: CircleDollarSign,
  exception: AlertTriangle, segment: Filter,
} as const;
