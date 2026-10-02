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

export type LegacyNavigationSection =
  | 'overview'
  | 'funnel'
  | 'contact'
  | 'performance'
  | 'sales'
  | 'commercial'
  | 'exceptions'
  | 'evidence'
  | 'explore'
  | 'settings';

export interface RouteItem {
  id: string;
  name: string;
  path: string;
  description: string;
  area: BusinessAreaId;
  icon: LucideIcon;
  scopePolicy: ScopePolicy;
  adminOnly?: boolean;
  isPrimaryTab?: boolean;
  isMoreView?: boolean;
  searchTerms: string[];
  urlAliases?: string[];
  legacySection: LegacyNavigationSection;
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
    id: 'overview',
    name: 'Overview',
    path: '/overview',
    description: 'Decide where to look: principal outcomes, primary trend, attention queue, and lifecycle journey.',
    area: 'overview',
    icon: LayoutDashboard,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['workspace', 'dashboard', 'weekly review', 'why is conversion down'],
    urlAliases: ['/', '/insights'],
    legacySection: 'overview',
  },

  // --- LEAD JOURNEY ---
  {
    id: 'funnel',
    name: 'Progression',
    path: '/funnel',
    description: 'Lead progression and transition losses across lifecycle stages.',
    area: 'journey',
    icon: GitFork,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['funnel', 'journey', 'conversion', 'leakage', 'lead funnel'],
    urlAliases: ['/lead-performance'],
    legacySection: 'funnel',
  },
  {
    id: 'campaigns',
    name: 'Acquisition',
    path: '/campaigns',
    description: 'Media channels, campaign traffic, outbound CTR, and lead capture.',
    area: 'journey',
    icon: Megaphone,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['marketing', 'advertising', 'campaigns spend', 'budget', 'cpl', 'acquisition', 'media spend'],
    urlAliases: ['/acquisition', '/platform-insights'],
    legacySection: 'funnel',
  },
  {
    id: 'vetting',
    name: 'Qualification',
    path: '/vetting',
    description: 'Lead validation, eligibility, deduplication, and reason breakdowns.',
    area: 'journey',
    icon: ListChecks,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['vetting', 'deduplication', 'colour', 'validation', 'qualification'],
    urlAliases: ['/revetting'],
    legacySection: 'funnel',
  },
  {
    id: 'routing',
    name: 'Routing',
    path: '/routing',
    description: 'Handoffs, recipient distribution, and product routing depth.',
    area: 'journey',
    icon: RouteIcon,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['handoffs', 'assignment', 'product routing'],
    legacySection: 'funnel',
  },
  {
    id: 'offershop-flow',
    name: 'Process flow',
    path: '/offershop-flow',
    description: 'Offershop process observability: acquisition, hospital, partner ROR, and HLC delivery.',
    area: 'journey',
    icon: RouteIcon,
    scopePolicy: 'operational',
    isMoreView: true,
    searchTerms: ['deal flow', 'offershop', 'process flow', 'pipeline', 'hospital', 'hlc'],
    urlAliases: ['/deal-flow', '/process-flow'],
    legacySection: 'funnel',
  },
  {
    id: 'vendor-quality',
    name: 'Vendor quality',
    path: '/vendor-quality',
    description: 'Vendor volume, grade mix, and downstream performance comparison.',
    area: 'journey',
    icon: BarChart3,
    scopePolicy: 'operational',
    isMoreView: true,
    searchTerms: ['quality', 'partners', 'source performance', 'grade mix', 'vendor performance'],
    urlAliases: ['/sources', '/quality'],
    legacySection: 'performance',
  },
  {
    id: 'cohorts',
    name: 'Cohort maturation',
    path: '/cohorts',
    description: 'Cohort maturation curves and follow-up outcome maturation.',
    area: 'journey',
    icon: ChartNoAxesCombined,
    scopePolicy: 'operational',
    isMoreView: true,
    searchTerms: ['cohort', 'age', 'maturation'],
    legacySection: 'funnel',
  },

  // --- CONTACT CENTRE ---
  {
    id: 'contact-strategy',
    name: 'Contact effort',
    path: '/contact-strategy',
    description: 'Call-count distributions, attempt saturation, and vendor dispositions.',
    area: 'contact',
    icon: PhoneCall,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['dispositions', 'vendor dispositions', 'attempts', 'retry', 'redial', 'recycling', 'one call', 'contact performance'],
    urlAliases: ['/calls', '/call-performance', '/vendor-dispositions'],
    legacySection: 'contact',
  },
  {
    id: 'speed-to-lead',
    name: 'Response speed',
    path: '/speed-to-lead',
    description: 'Delivery to first-dial latency, response SLA compliance, and backlog.',
    area: 'contact',
    icon: Timer,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['response', 'first call', 'sla', 'undialled', 'speed to lead'],
    legacySection: 'contact',
  },
  {
    id: 'cli-performance',
    name: 'Caller ID',
    path: '/cli-performance',
    description: 'Caller ID number performance, live trends, and call outcomes.',
    area: 'contact',
    icon: PhoneOutgoing,
    scopePolicy: 'operational',
    isMoreView: true,
    searchTerms: ['cli', 'phone', 'dialler', 'caller id', 'caller id performance'],
    legacySection: 'contact',
  },
  {
    id: 'agent-performance',
    name: 'Agent activity',
    path: '/agent-performance',
    description: 'Agent call activity, contact rates, and temporal engagement.',
    area: 'contact',
    icon: Users,
    scopePolicy: 'operational',
    isMoreView: true,
    searchTerms: ['agent performance', 'rpc', 'team', 'agents'],
    legacySection: 'contact',
  },
  {
    id: 'temporal',
    name: 'Time & day',
    path: '/temporal',
    description: 'Capture and dialling window patterns, hourly heatmaps, and weekend rollups.',
    area: 'contact',
    icon: CalendarDays,
    scopePolicy: 'operational',
    isMoreView: true,
    searchTerms: ['calendar', 'temporal', 'hourly', 'overnight', 'weekend'],
    legacySection: 'contact',
  },

  // --- SALES & ACTIVATION ---
  {
    id: 'sales-activation',
    name: 'Sales & activation',
    path: '/sales-activation',
    description: 'Recorded sales, activation conversion, ageing bands, and contract status.',
    area: 'sales',
    icon: BadgeCheck,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['outcomes', 'contracts', 'fulfilment', 'post sale', 'stuck sales', 'sales activation'],
    urlAliases: ['/outcomes'],
    legacySection: 'sales',
  },

  // --- COMMERCIAL ---
  {
    id: 'commercial',
    name: 'Commercial overview',
    path: '/commercial',
    description: 'Evidenced media spend, matched outcome costs, and attribution coverage.',
    area: 'commercial',
    icon: CircleDollarSign,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['revenue', 'cost', 'actual spend', 'profit', 'spend & commercial'],
    legacySection: 'commercial',
  },
  {
    id: 'reconciliation',
    name: 'Reconciliation',
    path: '/reconciliation',
    description: 'Marketing attribution diagnostics, spend grain validation, and unmatched populations.',
    area: 'commercial',
    icon: FileCheck2,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['billing', 'reconcile', 'settlement'],
    legacySection: 'commercial',
  },

  // --- INVESTIGATE ---
  {
    id: 'exceptions',
    name: 'Investigation inbox',
    path: '/investigate',
    description: 'Operational queues needing investigation: backlog, uncontacted, undialled.',
    area: 'investigate',
    icon: AlertTriangle,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['backlog', 'attention', 'missing dispositions', 'exceptions', 'investigation inbox'],
    urlAliases: ['/exceptions'],
    legacySection: 'exceptions',
  },
  {
    id: 'lead-explorer',
    name: 'Record explorer',
    path: '/lead-explorer',
    description: 'Inspect exact lead records, timeline events, and drill populations.',
    area: 'investigate',
    icon: Search,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    adminOnly: true,
    searchTerms: ['records', 'consumer', 'timeline', 'lead explorer', 'explore'],
    urlAliases: ['/explore', '/explorer', '/leads'],
    legacySection: 'explore',
  },
  {
    id: 'data-integrity',
    name: 'Data confidence',
    path: '/data-integrity',
    description: 'Source feed status, completeness, mapping health, and freshness.',
    area: 'investigate',
    icon: Database,
    scopePolicy: 'diagnostics',
    isPrimaryTab: true,
    searchTerms: ['trust', 'quality', 'health', 'data missing', 'data integrity'],
    urlAliases: ['/data-trust', '/data-quality', '/data-coverage', '/audit'],
    legacySection: 'evidence',
  },
  {
    id: 'reports',
    name: 'Evidence reports',
    path: '/reports',
    description: 'Inspect immutable reporting releases, snapshot manifests, and audited metrics.',
    area: 'investigate',
    icon: ShieldCheck,
    scopePolicy: 'release',
    isMoreView: true,
    searchTerms: ['verified', 'releases', 'versioned reports'],
    legacySection: 'evidence',
  },
  {
    id: 'vendors',
    name: 'Vendor evidence',
    path: '/vendors',
    description: 'Reporting evidence catalogued by vendor and partner.',
    area: 'investigate',
    icon: FileCheck2,
    scopePolicy: 'release',
    isMoreView: true,
    searchTerms: ['partners', 'vendor evidence'],
    legacySection: 'evidence',
  },
  {
    id: 'lead-ledger',
    name: 'Lead ledger',
    path: '/lead-ledger',
    description: 'Inspect original source records and normalised lead timelines.',
    area: 'investigate',
    icon: Layers,
    scopePolicy: 'diagnostics',
    isMoreView: true,
    adminOnly: true,
    searchTerms: ['ledger', 'lead ledger'],
    legacySection: 'explore',
  },

  // --- SETTINGS & ADMINISTRATION ---
  {
    id: 'admin',
    name: 'Settings',
    path: '/admin',
    description: 'Workspace configuration, display preferences, and appearance.',
    area: 'settings',
    icon: Settings,
    scopePolicy: 'settings',
    isPrimaryTab: true,
    searchTerms: ['appearance', 'density', 'spacing', 'system', 'configuration', 'settings'],
    urlAliases: ['/settings'],
    legacySection: 'settings',
  },
  {
    id: 'access-control',
    name: 'Access control',
    path: '/access-control',
    description: 'Manage team user roles, approvals, and authorized tenant workspaces.',
    area: 'settings',
    icon: Shield,
    scopePolicy: 'settings',
    isPrimaryTab: true,
    adminOnly: true,
    searchTerms: ['users', 'admin', 'permissions', 'invite'],
    urlAliases: ['/users'],
    legacySection: 'settings',
  },
  {
    id: 'warehouse',
    name: 'Cloud warehouse',
    path: '/warehouse',
    description: 'Deep BigQuery dataset inspection, schema definitions, and table catalogues.',
    area: 'settings',
    icon: Database,
    scopePolicy: 'diagnostics',
    isMoreView: true,
    searchTerms: ['warehouse', 'bigquery', 'datasets', 'tables', 'projects', 'waterfall', 'touchpoints'],
    urlAliases: ['/warehouse-analytics'],
    legacySection: 'evidence',
  },
  {
    id: 'visuals',
    name: 'Visual workspace',
    path: '/visuals',
    description: 'Chart and visual component catalogue.',
    area: 'overview',
    icon: Eye,
    scopePolicy: 'none',
    searchTerms: ['visuals', 'charts'],
    legacySection: 'settings',
  },
  {
    id: 'consumers',
    name: 'Consumer re-entry',
    path: '/consumers',
    description: 'Repeat consumer identification and cross-campaign re-entry diagnostics.',
    area: 'journey',
    icon: Users,
    scopePolicy: 'diagnostics',
    isMoreView: true,
    searchTerms: ['consumers', 're-entry'],
    legacySection: 'funnel',
  },
  {
    id: 'ai-insights',
    name: 'AI Insights',
    path: '/ai-insights',
    description: 'Deterministic operational pattern extraction and anomaly citations.',
    area: 'overview',
    icon: Bot,
    scopePolicy: 'diagnostics',
    isMoreView: true,
    searchTerms: ['ai-insights', 'insights'],
    legacySection: 'settings',
  },
  {
    id: 'validation',
    adminOnly: true,
    name: 'Validation suite',
    path: '/validation',
    description: 'System audit and verification checklist.',
    area: 'settings',
    icon: ShieldCheck,
    scopePolicy: 'diagnostics',
    isMoreView: true,
    searchTerms: ['validation', 'admin validation'],
    legacySection: 'settings',
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
    landingPath: '/investigate',
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
  const item = ROUTE_MANIFEST.find(r => r.path === cleanPath || r.urlAliases?.includes(cleanPath));
  if (item) {
    const area = BUSINESS_AREAS.find(a => a.id === item.area);
    if (area) return area;
  }
  return BUSINESS_AREAS[0];
}

export function getRouteItem(pathname: string): RouteItem | undefined {
  const cleanPath = pathname === '/' ? '/overview' : pathname.split('?')[0];
  return ROUTE_MANIFEST.find(r => r.path === cleanPath || r.urlAliases?.includes(cleanPath));
}

export function getScopePolicy(pathname: string): ScopePolicy {
  return getRouteItem(pathname)?.scopePolicy || 'operational';
}
