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
  type LucideIcon,
} from 'lucide-react';
import { BRAND } from '../../contracts/naming';

export type BusinessAreaId =
  | 'overview'
  | 'journey'
  | 'contact'
  | 'evidence'
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
    name: 'Command',
    path: '/command',
    description: 'Decide where to look: principal outcomes, primary trend, attention queue, and lifecycle journey.',
    area: 'overview',
    icon: LayoutDashboard,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['workspace', 'dashboard', 'weekly review', 'why is conversion down'],
    urlAliases: ['/overview', '/', '/insights'],
    legacySection: 'overview',
  },

  // --- LEAD JOURNEY ---
  {
    id: 'funnel',
    name: 'Lifecycle',
    path: '/journey',
    description: 'Lead progression and transition losses across lifecycle stages.',
    area: 'journey',
    icon: GitFork,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['funnel', 'journey', 'conversion', 'leakage', 'lead funnel'],
    urlAliases: ['/funnel', '/lead-performance'],
    legacySection: 'funnel',
  },
  {
    id: 'campaigns',
    name: 'Acquisition',
    path: '/journey/acquisition',
    description: 'Media channels, campaign traffic, outbound CTR, and lead capture.',
    area: 'journey',
    icon: Megaphone,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['marketing', 'advertising', 'campaigns spend', 'budget', 'cpl', 'acquisition', 'media spend'],
    urlAliases: ['/campaigns', '/acquisition', '/platform-insights'],
    legacySection: 'funnel',
  },
  {
    id: 'vetting',
    name: 'Qualification',
    path: '/journey/qualification',
    description: 'Lead validation, eligibility, deduplication, and reason breakdowns.',
    area: 'journey',
    icon: ListChecks,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['vetting', 'deduplication', 'colour', 'validation', 'qualification'],
    urlAliases: ['/vetting', '/revetting'],
    legacySection: 'funnel',
  },
  {
    id: 'routing',
    name: 'Routing',
    path: '/journey/routing',
    description: 'Handoffs, recipient distribution, and product routing depth.',
    area: 'journey',
    icon: RouteIcon,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['handoffs', 'assignment', 'product routing'],
    urlAliases: ['/routing'],
    legacySection: 'funnel',
  },
  {
    id: 'offershop-flow',
    name: 'Process flow',
    path: '/journey/process',
    description: 'Offershop process observability: acquisition, hospital, partner ROR, and HLC delivery.',
    area: 'journey',
    icon: RouteIcon,
    scopePolicy: 'operational',
    isMoreView: true,
    searchTerms: ['deal flow', 'offershop', 'process flow', 'pipeline', 'hospital', 'hlc'],
    urlAliases: ['/offershop-flow', '/deal-flow', '/process-flow'],
    legacySection: 'funnel',
  },
  {
    id: 'vendor-quality',
    name: 'Vendor quality',
    path: '/journey/vendors',
    description: 'Vendor volume, grade mix, and downstream performance comparison.',
    area: 'journey',
    icon: BarChart3,
    scopePolicy: 'operational',
    isMoreView: true,
    searchTerms: ['quality', 'partners', 'source performance', 'grade mix', 'vendor performance'],
    urlAliases: ['/vendor-quality', '/sources', '/quality'],
    legacySection: 'performance',
  },
  {
    id: 'cohorts',
    name: 'Cohort maturation',
    path: '/journey/cohorts',
    description: 'Cohort maturation curves and follow-up outcome maturation.',
    area: 'journey',
    icon: ChartNoAxesCombined,
    scopePolicy: 'operational',
    isMoreView: true,
    searchTerms: ['cohort', 'age', 'maturation'],
    urlAliases: ['/cohorts'],
    legacySection: 'funnel',
  },

  // --- CONTACT CENTRE ---
  {
    id: 'contact-strategy',
    name: 'Contact effort',
    path: '/operations/contact',
    description: 'Call-count distributions, attempt saturation, and vendor dispositions.',
    area: 'contact',
    icon: PhoneCall,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['dispositions', 'vendor dispositions', 'attempts', 'retry', 'redial', 'recycling', 'one call', 'contact performance'],
    urlAliases: ['/contact-strategy', '/calls', '/call-performance', '/vendor-dispositions'],
    legacySection: 'contact',
  },
  {
    id: 'speed-to-lead',
    name: 'Response speed',
    path: '/operations/response',
    description: 'Delivery to first-dial latency, response SLA compliance, and backlog.',
    area: 'contact',
    icon: Timer,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['response', 'first call', 'sla', 'undialled', 'speed to lead'],
    urlAliases: ['/speed-to-lead'],
    legacySection: 'contact',
  },
  {
    id: 'cli-performance',
    name: 'Caller ID',
    path: '/operations/cli',
    description: 'Caller ID number performance, live trends, and call outcomes.',
    area: 'contact',
    icon: PhoneOutgoing,
    scopePolicy: 'operational',
    isMoreView: true,
    searchTerms: ['cli', 'phone', 'dialler', 'caller id', 'caller id performance'],
    urlAliases: ['/cli-performance'],
    legacySection: 'contact',
  },
  {
    id: 'agent-performance',
    name: 'Agent activity',
    path: '/operations/agents',
    description: 'Agent call activity, contact rates, and temporal engagement.',
    area: 'contact',
    icon: Users,
    scopePolicy: 'operational',
    isMoreView: true,
    searchTerms: ['agent performance', 'rpc', 'team', 'agents'],
    urlAliases: ['/agent-performance'],
    legacySection: 'contact',
  },
  {
    id: 'temporal',
    name: 'Time & day',
    path: '/operations/time',
    description: 'Capture and dialling window patterns, hourly heatmaps, and weekend rollups.',
    area: 'contact',
    icon: CalendarDays,
    scopePolicy: 'operational',
    isMoreView: true,
    searchTerms: ['calendar', 'temporal', 'hourly', 'overnight', 'weekend'],
    urlAliases: ['/temporal'],
    legacySection: 'contact',
  },

  // --- SALES & ACTIVATION ---
  {
    id: 'sales-activation',
    name: 'Sales & activation',
    path: '/journey/outcomes',
    description: 'Recorded sales, activation conversion, ageing bands, and contract status.',
    area: 'journey',
    icon: BadgeCheck,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['outcomes', 'contracts', 'fulfilment', 'post sale', 'stuck sales', 'sales activation'],
    urlAliases: ['/sales-activation', '/outcomes'],
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
    path: '/commercial/reconciliation',
    description: 'Marketing attribution diagnostics, spend grain validation, and unmatched populations.',
    area: 'commercial',
    icon: FileCheck2,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    searchTerms: ['billing', 'reconcile', 'settlement'],
    urlAliases: ['/reconciliation'],
    legacySection: 'commercial',
  },

  // --- INVESTIGATE ---
  {
    id: 'exceptions',
    name: 'Investigate',
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
    name: 'Lead Evidence',
    path: '/lead-explorer',
    description: 'Inspect analytical lead populations, journeys, outcomes, audit evidence and original source records.',
    area: 'investigate',
    icon: Search,
    scopePolicy: 'operational',
    isPrimaryTab: true,
    adminOnly: true,
    searchTerms: ['lead', 'record', 'records', 'explorer', 'ledger', 'source ledger', 'analytical ledger', 'raw source', 'lead evidence', 'timeline', 'consumer', 'lead explorer', 'explore'],
    urlAliases: ['/explore', '/explorer', '/leads', '/lead-ledger'],
    legacySection: 'explore',
  },
  {
    id: 'data-integrity',
    name: 'Overview',
    path: '/evidence',
    description: 'Source feed status, completeness, mapping health, and freshness.',
    area: 'evidence',
    icon: Database,
    scopePolicy: 'diagnostics',
    isPrimaryTab: true,
    searchTerms: ['trust', 'quality', 'health', 'data missing', 'data integrity'],
    urlAliases: ['/data-integrity', '/data-trust', '/data-quality', '/data-coverage', '/audit'],
    legacySection: 'evidence',
  },
  {
    id: 'reports',
    name: 'Releases & replay',
    path: '/evidence/releases',
    description: 'Inspect immutable reporting releases, snapshot manifests, and audited metrics.',
    area: 'evidence',
    icon: ShieldCheck,
    scopePolicy: 'release',
    isMoreView: true,
    searchTerms: ['verified', 'releases', 'versioned reports'],
    urlAliases: ['/reports'],
    legacySection: 'evidence',
  },
  {
    id: 'vendors',
    name: 'Vendor evidence',
    path: '/evidence/vendors',
    description: 'Reporting evidence catalogued by vendor and partner.',
    area: 'evidence',
    icon: FileCheck2,
    scopePolicy: 'release',
    isMoreView: true,
    searchTerms: ['partners', 'vendor evidence'],
    urlAliases: ['/vendors'],
    legacySection: 'evidence',
  },
  { id: 'operations', name: 'Overview', path: '/operations', description: 'Delivered leads, contact effort, response speed and recorded outcomes.', area: 'contact', icon: PhoneCall, scopePolicy: 'operational', isPrimaryTab: true, searchTerms: ['overview'], legacySection: 'contact' },
  { id: 'dispositions', name: 'Vendor outcomes', path: '/operations/dispositions', description: 'Vendor disposition coverage and raw-code evidence.', area: 'contact', icon: ListChecks, scopePolicy: 'operational', isPrimaryTab: true, searchTerms: ['vendor outcomes'], legacySection: 'contact' },
  { id: 'evidence-sources', name: 'Sources', path: '/evidence/sources', description: 'Source observations, identities and measurement coverage.', area: 'evidence', icon: Database, scopePolicy: 'operational', isPrimaryTab: true, searchTerms: ['sources'], legacySection: 'evidence' },
  { id: 'evidence-metrics', name: 'Metrics', path: '/evidence/metrics', description: 'Definitions, fields, grain and metric lineage.', area: 'evidence', icon: ListChecks, scopePolicy: 'operational', isPrimaryTab: true, searchTerms: ['metrics'], legacySection: 'evidence' },
  { id: 'evidence-reconciliation', name: 'Reconciliation', path: '/evidence/reconciliation', description: 'Independent evidence states and unresolved reconciliation.', area: 'evidence', icon: FileCheck2, scopePolicy: 'operational', isPrimaryTab: true, searchTerms: ['reconciliation'], legacySection: 'evidence' },
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
    name: 'Warehouse',
    path: '/evidence/warehouse',
    description: 'Deep BigQuery dataset inspection, schema definitions, and table catalogues.',
    area: 'evidence',
    icon: Database,
    scopePolicy: 'diagnostics',
    isMoreView: true,
    searchTerms: ['warehouse', 'bigquery', 'datasets', 'tables', 'projects', 'waterfall', 'touchpoints'],
    urlAliases: ['/warehouse', '/warehouse-analytics'],
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
    path: '/journey/consumers',
    description: 'Repeat consumer identification and cross-campaign re-entry diagnostics.',
    area: 'journey',
    icon: Users,
    scopePolicy: 'diagnostics',
    isMoreView: true,
    searchTerms: ['consumers', 're-entry'],
    urlAliases: ['/consumers'],
    legacySection: 'funnel',
  },
  {
    id: 'ai-insights',
    name: 'Ask ConversionX',
    path: '/ai-insights',
    description: 'Deterministic operational pattern extraction and anomaly citations.',
    area: 'investigate',
    icon: Bot,
    scopePolicy: 'diagnostics',
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
  { id: 'overview', name: 'Command', landingPath: '/command', icon: LayoutDashboard, description: 'Operational health and where to investigate.', primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'overview' && r.isPrimaryTab), moreViews: ROUTE_MANIFEST.filter(r => r.area === 'overview' && r.isMoreView) },
  { id: 'journey', name: 'Journey', landingPath: '/journey', icon: GitFork, description: 'Follow lead acquisition, qualification, delivery and outcomes.', primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'journey' && r.isPrimaryTab), moreViews: ROUTE_MANIFEST.filter(r => r.area === 'journey' && r.isMoreView) },
  { id: 'contact', name: 'Operations', landingPath: '/operations', icon: PhoneCall, description: 'Understand contact effort, response speed and vendor outcomes.', primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'contact' && r.isPrimaryTab), moreViews: ROUTE_MANIFEST.filter(r => r.area === 'contact' && r.isMoreView) },
  { id: 'investigate', name: 'Investigate', landingPath: '/investigate', icon: Search, description: 'Signal, diagnosis, exact records, evidence and conclusion.', primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'investigate' && r.isPrimaryTab), moreViews: ROUTE_MANIFEST.filter(r => r.area === 'investigate' && r.isMoreView) },
  { id: 'commercial', name: 'Commercial', landingPath: '/commercial', icon: CircleDollarSign, description: 'Recorded economics and unavailable commercial inputs.', primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'commercial' && r.isPrimaryTab), moreViews: ROUTE_MANIFEST.filter(r => r.area === 'commercial' && r.isMoreView) },
  { id: 'evidence', name: 'Evidence', landingPath: '/evidence', icon: ShieldCheck, description: 'Sources, definitions, reconciliation and immutable releases.', primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'evidence' && r.isPrimaryTab), moreViews: ROUTE_MANIFEST.filter(r => r.area === 'evidence' && r.isMoreView) },
  { id: 'settings', name: 'Settings', landingPath: '/admin', icon: Settings, description: 'Preferences, access control and system validation.', primaryTabs: ROUTE_MANIFEST.filter(r => r.area === 'settings' && r.isPrimaryTab), moreViews: ROUTE_MANIFEST.filter(r => r.area === 'settings' && r.isMoreView) },
];

export function getAreaForPath(pathname: string): BusinessArea {
  const cleanPath = pathname === '/' ? '/command' : pathname.split('?')[0];
  const item = ROUTE_MANIFEST.find(r => r.path === cleanPath || r.urlAliases?.includes(cleanPath));
  if (item) {
    const area = BUSINESS_AREAS.find(a => a.id === item.area);
    if (area) return area;
  }
  return BUSINESS_AREAS[0];
}

export function getRouteItem(pathname: string): RouteItem | undefined {
  const cleanPath = pathname === '/' ? '/command' : pathname.split('?')[0];
  return ROUTE_MANIFEST.find(r => r.path === cleanPath || r.urlAliases?.includes(cleanPath));
}

export function getScopePolicy(pathname: string): ScopePolicy {
  return getRouteItem(pathname)?.scopePolicy || 'operational';
}
