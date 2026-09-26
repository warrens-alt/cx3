import {
  LayoutDashboard,
  GitFork,
  PhoneCall,
  BarChart3,
  AlertTriangle,
  ShieldCheck,
  Search,
  Settings,
} from 'lucide-react';

export const NAV_GROUPS = [
  {
    title: 'Operate',
    items: [
      { name: 'Overview', path: '/overview', icon: LayoutDashboard },
      { name: 'Funnel', path: '/funnel', icon: GitFork },
      { name: 'Contact', path: '/speed-to-lead', icon: PhoneCall },
      { name: 'Performance', path: '/vendor-quality', icon: BarChart3 },
      { name: 'Exceptions', path: '/exceptions', icon: AlertTriangle },
      { name: 'Evidence', path: '/reports', icon: ShieldCheck },
      { name: 'Explore', path: '/lead-explorer', icon: Search },
    ]
  },
  {
    title: 'Administration',
    items: [
      { name: 'Settings', path: '/admin', icon: Settings },
    ]
  }
];

export const SECONDARY_DESTINATIONS = [
  { name: 'Contact Strategy', path: '/contact-strategy' },
  { name: 'CLI Performance', path: '/cli-performance' },
  { name: 'Agent Performance', path: '/agent-performance' },
  { name: 'Temporal Analysis', path: '/temporal' },
  { name: 'Sales & Activation', path: '/sales-activation' },
  { name: 'Campaigns & Spend', path: '/campaigns' },
  { name: 'Data Integrity', path: '/data-integrity' },
  { name: 'Spend & Commercial', path: '/commercial' },
  { name: 'Vendor Evidence', path: '/vendors' },
  { name: 'Reconciliation', path: '/reconciliation' },
] as const;
