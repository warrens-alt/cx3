import React from 'react';
import {
  LayoutDashboard,
  GitFork,
  PhoneCall,
  BarChart3,
  AlertTriangle,
  ShieldCheck,
  Search,
  Settings,
  Timer,
  ListChecks,
  PhoneOutgoing,
  Users,
  CalendarDays,
  BadgeCheck,
  Megaphone,
  Database,
  CircleDollarSign,
  FileCheck2,
  Route as RouteIcon,
  ChartNoAxesCombined,
  Shield,
  Eye,
  SlidersHorizontal,
  Bot,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { BRAND } from '../../contracts/naming';

export type BusinessAreaId =
  | 'overview'
  | 'journey'
  | 'contact'
  | 'sales'
  | 'commercial'
  | 'investigate'
  | 'settings';

export type ScopePolicy = 'operational' | 'release' | 'diagnostics' | 'settings' | 'none';

export interface RouteItem {
  name: string;
  path: string;
  description: string;
  area: BusinessAreaId;
  icon: LucideIcon;
  scopePolicy: ScopePolicy;
  adminOnly?: boolean;
  isPrimaryTab?: boolean;
  isMoreView?: boolean;
  aliases?: string[];
}

export interface BusinessArea {
  id: BusinessAreaId;
  name: string;
  landingPath: string;
  icon: LucideIcon;
  description: string;
  primaryTabs: RouteItem[];
  moreViews: RouteItem[];
}

export const ROUTE_MANIFEST: RouteItem[] = [
  // --- OVERVIEW ---
  {
    name: 'Overview',
    path: '/overview',
    description: 'Decide where to look: principal outcomes, primary trend, attention queue, and lifecycle journey.',
    area: 'overview',
    icon: LayoutDashboard,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    aliases: ['workspace', 'dashboard', 'weekly review', 'why is conversion down', '/'],
  },

  // --- LEAD JOURNEY ---
  {
    name: 'Progression',
    path: '/funnel',
    description: 'Lead progression and transition losses across lifecycle stages.',
    area: 'journey',
    icon: GitFork,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    aliases: ['funnel', 'journey', 'conversion', 'leakage', 'lead funnel'],
  },
  {
    name: 'Acquisition',
    path: '/campaigns',
    description: 'Media channels, campaign traffic, outbound CTR, and lead capture.',
    area: 'journey',
    icon: Megaphone,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    aliases: ['marketing', 'advertising', 'campaigns spend', 'budget', 'cpl', 'acquisition'],
  },
  {
    name: 'Qualification',
    path: '/vetting',
    description: 'Lead validation, eligibility, deduplication, and reason breakdowns.',
    area: 'journey',
    icon: ListChecks,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    aliases: ['vetting', 'deduplication', 'colour', 'validation'],
  },
  {
    name: 'Routing',
    path: '/routing',
    description: 'Handoffs, recipient distribution, and product routing depth.',
    area: 'journey',
    icon: RouteIcon,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    aliases: ['handoffs', 'assignment', 'product routing'],
  },
  {
    name: 'Process flow',
    path: '/offershop-flow',
    description: 'Offershop process observability: acquisition, hospital, partner ROR, and HLC delivery.',
    area: 'journey',
    icon: RouteIcon,
    scopePolicy: 'operational',
    isMoreView: true,
    aliases: ['deal flow', 'offershop', 'process flow', 'pipeline', 'hospital', 'hlc'],
  },
  {
    name: 'Vendor quality',
    path: '/vendor-quality',
    description: 'Vendor volume, grade mix, and downstream performance comparison.',
    area: 'journey',
    icon: BarChart3,
    scopePolicy: 'operational',
    isMoreView: true,
    aliases: ['quality', 'partners', 'source performance', 'grade mix', 'vendor performance'],
  },
  {
    name: 'Cohort maturation',
    path: '/cohorts',
    description: 'Cohort maturation curves and follow-up outcome maturation.',
    area: 'journey',
    icon: ChartNoAxesCombined,
    scopePolicy: 'operational',
    isMoreView: true,
    aliases: ['cohort', 'age', 'maturation'],
  },

  // --- CONTACT CENTRE ---
  {
    name: 'Contact effort',
    path: '/contact-strategy',
    description: 'Call-count distributions, attempt saturation, and vendor dispositions.',
    area: 'contact',
    icon: PhoneCall,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    aliases: ['dispositions', 'vendor dispositions', 'attempts', 'retry', 'redial', 'recycling', 'one call', 'contact performance', '/vendor-dispositions'],
  },
  {
    name: 'Response speed',
    path: '/speed-to-lead',
    description: 'Delivery to first-dial latency, response SLA compliance, and backlog.',
    area: 'contact',
    icon: Timer,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    aliases: ['response', 'first call', 'sla', 'undialled', 'speed to lead'],
  },
  {
    name: 'Caller ID',
    path: '/cli-performance',
    description: 'Caller ID number performance, live trends, and call outcomes.',
    area: 'contact',
    icon: PhoneOutgoing,
    scopePolicy: 'operational',
    isMoreView: true,
    aliases: ['cli', 'phone', 'dialler', 'caller id'],
  },
  {
    name: 'Agent activity',
    path: '/agent-performance',
    description: 'Agent call activity, contact rates, and temporal engagement.',
    area: 'contact',
    icon: Users,
    scopePolicy: 'operational',
    isMoreView: true,
    aliases: ['agent performance', 'rpc', 'team', 'agents'],
  },
  {
    name: 'Time & day',
    path: '/temporal',
    description: 'Capture and dialling window patterns, hourly heatmaps, and weekend rollups.',
    area: 'contact',
    icon: CalendarDays,
    scopePolicy: 'operational',
    isMoreView: true,
    aliases: ['calendar', 'temporal', 'hourly', 'overnight', 'weekend'],
  },

  // --- SALES & ACTIVATION ---
  {
    name: 'Sales & activation',
    path: '/sales-activation',
    description: 'Recorded sales, activation conversion, ageing bands, and contract status.',
    area: 'sales',
    icon: BadgeCheck,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    aliases: ['outcomes', 'contracts', 'fulfilment', 'post sale', 'stuck sales', 'sales activation'],
  },

  // --- COMMERCIAL ---
  {
    name: 'Commercial overview',
    path: '/commercial',
    description: 'Evidenced media spend, matched outcome costs, and attribution coverage.',
    area: 'commercial',
    icon: CircleDollarSign,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    aliases: ['revenue', 'cost', 'actual spend', 'profit', 'spend & commercial'],
  },
  {
    name: 'Reconciliation',
    path: '/reconciliation',
    description: 'Marketing attribution diagnostics, spend grain validation, and unmatched populations.',
    area: 'commercial',
    icon: FileCheck2,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    aliases: ['billing', 'reconcile', 'settlement'],
  },

  // --- INVESTIGATE ---
  {
    name: 'Exceptions queue',
    path: '/exceptions',
    description: 'Operational queues needing investigation: backlog, uncontacted, undialled.',
    area: 'investigate',
    icon: AlertTriangle,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    aliases: ['backlog', 'attention', 'missing dispositions'],
  },
  {
    name: 'Explore leads',
    path: '/lead-explorer',
    description: 'Inspect exact lead records, timeline events, and drill populations.',
    area: 'investigate',
    icon: Search,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    adminOnly: true,
    aliases: ['records', 'consumer', 'timeline', 'lead explorer', 'explore'],
  },
  {
    name: 'Data integrity',
    path: '/data-integrity',
    description: 'Source feed status, completeness, mapping health, and freshness.',
    area: 'investigate',
    icon: Database,
    scopePolicy: 'diagnostics',
    isPrimaryTab: true,
    aliases: ['trust', 'quality', 'health', 'data missing', 'data integrity'],
  },
  {
    name: 'Evidence reports',
    path: '/reports',
    description: 'Inspect immutable reporting releases, snapshot manifests, and audited metrics.',
    area: 'investigate',
    icon: ShieldCheck,
    scopePolicy: 'release',
    isMoreView: true,
    aliases: ['verified', 'releases', 'versioned reports'],
  },
  {
    name: 'Vendor evidence',
    path: '/vendors',
    description: 'Reporting evidence catalogued by vendor and partner.',
    area: 'investigate',
    icon: FileCheck2,
    scopePolicy: 'release',
    isMoreView: true,
    aliases: ['partners', 'vendor evidence'],
  },
  {
    name: 'Lead ledger',
    path: '/lead-ledger',
    description: 'Admin-only analytical lead transaction ledger.',
    area: 'investigate',
    icon: Layers,
    scopePolicy: 'diagnostics',
    isMoreView: true,
    adminOnly: true,
    aliases: ['ledger', 'lead ledger'],
  },

  // --- SETTINGS & ADMINISTRATION ---
  {
    name: 'Settings',
    path: '/admin',
    description: 'Workspace configuration, display preferences, and appearance.',
    area: 'settings',
    icon: Settings,
    scopePolicy: 'settings',
    isPrimaryTab: true,
    aliases: ['appearance', 'density', 'spacing', 'system', 'configuration', 'settings', '/settings'],
  },
  {
    name: 'Access control',
    path: '/access-control',
    description: 'Manage team user roles, approvals, and authorized tenant workspaces.',
    area: 'settings',
    icon: Shield,
    scopePolicy: 'settings',
    isPrimaryTab: true,
    adminOnly: true,
    aliases: ['users', 'admin', 'permissions', 'invite', '/users'],
  },
  {
    name: 'Cloud warehouse',
    path: '/warehouse',
    description: 'Deep BigQuery dataset inspection, schema definitions, and table catalogues.',
    area: 'settings',
    icon: Database,
    scopePolicy: 'diagnostics',
    isMoreView: true,
    aliases: ['warehouse', 'bigquery', 'datasets', 'tables', 'projects', '/warehouse-analytics'],
  },
  {
    name: 'Visual workspace',
    path: '/visuals',
    description: 'Chart and visual component catalogue.',
    area: 'settings',
    icon: Eye,
    scopePolicy: 'none',
    isMoreView: true,
    aliases: ['visuals', 'charts'],
  },
  {
    name: 'Consumer re-entry',
    path: '/consumers',
    description: 'Repeat consumer identification and cross-campaign re-entry diagnostics.',
    area: 'settings',
    icon: Users,
    scopePolicy: 'diagnostics',
    isMoreView: true,
    aliases: ['consumers', 're-entry'],
  },
  {
    name: 'AI Insights',
    path: '/ai-insights',
    description: 'Deterministic operational pattern extraction and anomaly citations.',
    area: 'settings',
    icon: Bot,
    scopePolicy: 'diagnostics',
    isMoreView: true,
    aliases: ['ai-insights', 'insights'],
  },
  {
    name: 'Validation suite',
    path: '/validation',
    description: 'System audit and verification checklist.',
    area: 'settings',
    icon: ShieldCheck,
    scopePolicy: 'diagnostics',
    isMoreView: true,
    aliases: ['validation', 'admin validation'],
  },
];

export const BUSINESS_AREAS: BusinessArea[] = [
  {
    id: 'overview',
    name: 'Overview',
    landingPath: '/overview',
    icon: LayoutDashboard,
    description: 'Executive overview, principal outcomes, attention queues, and journey flow.',
    primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'overview' && r.isPrimaryTab),
    moreViews: ROUTE_MANIFEST.filter(r => r.area === 'overview' && r.isMoreView),
  },
  {
    id: 'journey',
    name: 'Lead journey',
    landingPath: '/funnel',
    icon: GitFork,
    description: 'Progression, acquisition media, qualification checks, and routing.',
    primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'journey' && r.isPrimaryTab),
    moreViews: ROUTE_MANIFEST.filter(r => r.area === 'journey' && r.isMoreView),
  },
  {
    id: 'contact',
    name: 'Contact centre',
    landingPath: '/contact-strategy',
    icon: PhoneCall,
    description: 'Call attempt distributions, response times, and vendor dispositions.',
    primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'contact' && r.isPrimaryTab),
    moreViews: ROUTE_MANIFEST.filter(r => r.area === 'contact' && r.isMoreView),
  },
  {
    id: 'sales',
    name: 'Sales & activation',
    landingPath: '/sales-activation',
    icon: BadgeCheck,
    description: 'Recorded sales, activation conversion, and fulfilment ageing.',
    primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'sales' && r.isPrimaryTab),
    moreViews: ROUTE_MANIFEST.filter(r => r.area === 'sales' && r.isMoreView),
  },
  {
    id: 'commercial',
    name: 'Commercial',
    landingPath: '/commercial',
    icon: CircleDollarSign,
    description: 'Evidenced media spend, outcome economics, and reconciliation.',
    primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'commercial' && r.isPrimaryTab),
    moreViews: ROUTE_MANIFEST.filter(r => r.area === 'commercial' && r.isMoreView),
  },
  {
    id: 'investigate',
    name: 'Investigate',
    landingPath: '/exceptions',
    icon: AlertTriangle,
    description: 'Operational exception queues, record-level drilldowns, and source integrity.',
    primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'investigate' && r.isPrimaryTab),
    moreViews: ROUTE_MANIFEST.filter(r => r.area === 'investigate' && r.isMoreView),
  },
  {
    id: 'settings',
    name: 'Settings & Admin',
    landingPath: '/admin',
    icon: Settings,
    description: 'Preferences, user access management, and infrastructure tools.',
    primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'settings' && r.isPrimaryTab),
    moreViews: ROUTE_MANIFEST.filter(r => r.area === 'settings' && r.isMoreView),
  },
];

export function getAreaForPath(pathname: string): BusinessArea {
  const cleanPath = pathname === '/' ? '/overview' : pathname.split('?')[0];
  const item = ROUTE_MANIFEST.find(r => r.path === cleanPath || r.aliases?.includes(cleanPath));
  if (item) {
    const area = BUSINESS_AREAS.find(a => a.id === item.area);
    if (area) return area;
  }
  return BUSINESS_AREAS[0];
}

export function getRouteItem(pathname: string): RouteItem | undefined {
  const cleanPath = pathname === '/' ? '/overview' : pathname.split('?')[0];
  return ROUTE_MANIFEST.find(r => r.path === cleanPath || r.aliases?.includes(cleanPath));
}

export function getScopePolicy(pathname: string): ScopePolicy {
  return getRouteItem(pathname)?.scopePolicy || 'operational';
}
