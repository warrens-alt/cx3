import { 
  LayoutDashboard, 
  Filter, 
  Zap, 
  PhoneCall, 
  ShieldCheck, 
  Clock, 
  Award, 
  DollarSign, 
  Database, 
  Users, 
  Megaphone, 
  Sparkles, 
  FileText,
  Building2,
  AlertTriangle,
  History,
  Layers,
  PhoneForwarded
} from 'lucide-react';

export const NAV_GROUPS = [
  {
    title: 'Executive & Funnel',
    items: [
      { name: 'Executive Overview', path: '/overview', icon: LayoutDashboard },
      { name: 'Funnel Intelligence', path: '/funnel', icon: Filter },
      { name: 'Speed to Lead', path: '/speed-to-lead', icon: Zap },
    ]
  },
  {
    title: 'Telephony & Contact',
    items: [
      { name: 'Contact Strategy', path: '/contact-strategy', icon: PhoneCall },
      { name: 'CLI Performance', path: '/cli-performance', icon: PhoneForwarded },
      { name: 'Agent Performance', path: '/agent-performance', icon: Users },
      { name: 'Temporal Intelligence', path: '/temporal', icon: Clock },
    ]
  },
  {
    title: 'Commercial & Quality',
    items: [
      { name: 'Vendor & Lead Quality', path: '/vendor-quality', icon: ShieldCheck },
      { name: 'Sales & Activation', path: '/sales-activation', icon: Award },
      { name: 'Commercial Intelligence', path: '/commercial', icon: DollarSign },
    ]
  },
  {
    title: 'Data & Platform',
    items: [
      { name: 'Client & Campaigns', path: '/campaigns', icon: Megaphone },
      { name: 'AI Insights Engine', path: '/ai-insights', icon: Sparkles },
      { name: 'Data Health & Integrity', path: '/data-integrity', icon: Database },
      { name: 'Raw Data Explorer', path: '/lead-explorer', icon: FileText },
    ]
  },
  {
    title: 'Warehouse Reports',
    items: [
      { name: 'Evidence Reports', path: '/reports', icon: Layers },
      { name: 'Vendor Performance Ledger', path: '/vendors', icon: Building2 },
      { name: 'Vendor Reconciliations', path: '/reconciliation', icon: History },
      { name: 'Exceptions & Flags', path: '/exceptions', icon: AlertTriangle },
    ]
  },
  {
    title: 'Access & Governance',
    items: [
      { name: 'User & Access Control', path: '/access-control', icon: ShieldCheck },
    ]
  }
];
