import {
  LayoutDashboard, GitFork, PhoneCall, BarChart3, AlertTriangle, ShieldCheck, Search, Settings,
  Timer, ListChecks, PhoneOutgoing, Users, CalendarDays, BadgeCheck, Megaphone, Database,
  CircleDollarSign, FileCheck2, Route, ChartNoAxesCombined, Shield, type LucideIcon,
} from 'lucide-react';

// Preserve route identities and shortcuts; organise their discovery by business journey.
export type NavigationSection = 'overview' | 'funnel' | 'contact' | 'performance' | 'sales' | 'commercial' | 'exceptions' | 'evidence' | 'explore' | 'settings';
export interface NavigationPage {
  name: string; path: string; description: string; section: NavigationSection; icon: LucideIcon;
  aliases?: string[]; adminOnly?: boolean;
}
export const SECTION_NAMES: Record<NavigationSection, string> = {
  overview: 'Overview', funnel: 'Lead journey', contact: 'Contact centre', performance: 'Lead journey',
  sales: 'Sales & activation', commercial: 'Commercial', exceptions: 'Investigate',
  evidence: 'Investigate', explore: 'Investigate', settings: 'Settings',
};
export function primarySection(section: NavigationSection): NavigationSection {
  if (section === 'performance') return 'funnel';
  if (section === 'evidence' || section === 'explore') return 'exceptions';
  return section;
}
export const NAVIGATION_PAGES: NavigationPage[] = [
  { name: 'Overview', path: '/overview', description: 'What changed and what needs attention?', section: 'overview', icon: LayoutDashboard, aliases: ['workspace', 'dashboard', 'weekly review', 'why is conversion down'] },
  { name: 'Lead funnel', path: '/funnel', description: 'Where do leads stop progressing?', section: 'funnel', icon: GitFork, aliases: ['funnel', 'journey', 'conversion', 'leakage'] },
  { name: 'Offershop deal flow', path: '/offershop-flow', description: 'End-to-end evidence tracking across acquisition, hospital, partner ROR and HLC delivery.', section: 'funnel', icon: Route, aliases: ['deal flow', 'offershop', 'process flow', 'pipeline', 'hospital', 'hlc'] },
  { name: 'Campaigns & acquisition', path: '/campaigns', description: 'Where did leads come from and how did media perform?', section: 'funnel', icon: Megaphone, aliases: ['marketing', 'advertising', 'campaigns spend', 'budget', 'cpl'] },
  { name: 'Vetting & validation', path: '/vetting', description: 'Are leads eligible and what explains qualification losses?', section: 'funnel', icon: ListChecks, aliases: ['qualification', 'deduplication', 'colour'] },
  { name: 'Vendor performance', path: '/vendor-quality', description: 'Compare vendors, sources and lead quality on like-for-like populations.', section: 'performance', icon: BarChart3, aliases: ['quality', 'partners', 'source performance', 'grade mix'] },
  { name: 'Lead routing', path: '/routing', description: 'Did leads reach the intended receiving operation?', section: 'funnel', icon: Route, aliases: ['handoffs', 'assignment', 'product routing'] },
  { name: 'Cohort maturation', path: '/cohorts', description: 'Compare outcomes after equivalent follow-up time.', section: 'funnel', icon: ChartNoAxesCombined, aliases: ['cohort', 'age', 'maturation'] },
  { name: 'Contact performance', path: '/contact-strategy', description: 'Observe call-count outcomes, attempt saturation and vendor dispositions.', section: 'contact', icon: PhoneCall, aliases: ['dispositions', 'vendor dispositions', 'attempts', 'retry', 'redial', 'recycling', 'one call', 'contact performance'] },
  { name: 'Speed to lead', path: '/speed-to-lead', description: 'How quickly are delivered leads first dialled?', section: 'contact', icon: Timer, aliases: ['response', 'first call', 'sla', 'undialled'] },
  { name: 'Caller ID performance', path: '/cli-performance', description: 'Which caller numbers have different observed call outcomes?', section: 'contact', icon: PhoneOutgoing, aliases: ['cli', 'phone', 'dialler'] },
  { name: 'Agent activity', path: '/agent-performance', description: 'What calls and outcomes are recorded per agent?', section: 'contact', icon: Users, aliases: ['agent performance', 'rpc', 'team'] },
  { name: 'Time & day performance', path: '/temporal', description: 'How do capture and calling windows differ?', section: 'contact', icon: CalendarDays, aliases: ['calendar', 'temporal', 'hourly', 'overnight', 'weekend'] },
  { name: 'Sales & activation', path: '/sales-activation', description: 'Which recorded sales activate and which are still waiting?', section: 'sales', icon: BadgeCheck, aliases: ['outcomes', 'contracts', 'fulfilment', 'post sale', 'stuck sales'] },
  { name: 'Spend & commercial', path: '/commercial', description: 'What spend and commercial outcomes are actually evidenced?', section: 'commercial', icon: CircleDollarSign, aliases: ['revenue', 'cost', 'actual spend', 'profit'] },
  { name: 'Reconciliation', path: '/reconciliation', description: 'Which commercial populations and values do not reconcile?', section: 'commercial', icon: FileCheck2, aliases: ['billing', 'reconcile', 'settlement'] },
  { name: 'Exceptions', path: '/exceptions', description: 'Which recorded populations need investigation?', section: 'exceptions', icon: AlertTriangle, aliases: ['backlog', 'attention', 'missing dispositions'] },
  { name: 'Explore leads', path: '/lead-explorer', description: 'Inspect the exact records and timelines behind a number.', section: 'explore', icon: Search, aliases: ['records', 'consumer', 'timeline'], adminOnly: true },
  { name: 'Data integrity', path: '/data-integrity', description: 'Are source feeds complete, mapped and fresh enough to interpret?', section: 'evidence', icon: Database, aliases: ['trust', 'quality', 'health', 'data missing'] },
  { name: 'Cloud warehouse', path: '/warehouse', description: 'Analytics across all Google Cloud projects, BigQuery datasets, and tables.', section: 'evidence', icon: Database, aliases: ['warehouse', 'bigquery', 'datasets', 'tables', 'projects', 'waterfall', 'touchpoints'] },
  { name: 'Evidence reports', path: '/reports', description: 'Inspect published evidence and reporting-release status.', section: 'evidence', icon: ShieldCheck, aliases: ['verified', 'releases'] },
  { name: 'Vendor evidence', path: '/vendors', description: 'Inspect reporting evidence grouped by vendor.', section: 'evidence', icon: FileCheck2, aliases: ['partners'] },
  { name: 'Settings', path: '/admin', description: 'Workspace connections and display preferences.', section: 'settings', icon: Settings, aliases: ['appearance', 'density', 'spacing', 'system', 'configuration'] },
  { name: 'Access control', path: '/access-control', description: 'Manage roles and permitted workspaces.', section: 'settings', icon: Shield, aliases: ['users', 'admin', 'permissions', 'invite'], adminOnly: true },
];
const primaryPaths = ['/overview', '/funnel', '/contact-strategy', '/sales-activation', '/commercial', '/exceptions', '/admin'];
const primaryItems = primaryPaths.map(path => {
  const page = NAVIGATION_PAGES.find(item => item.path === path)!;
  return { ...page, name: SECTION_NAMES[page.section], icon: page.section === 'contact' ? PhoneCall : page.icon };
});
export const NAV_GROUPS = [
  { title: 'Customer journey', items: primaryItems.filter(page => page.section !== 'settings') },
  { title: 'Administration', items: primaryItems.filter(page => page.section === 'settings') },
];
export const SECONDARY_DESTINATIONS = NAVIGATION_PAGES.filter(page => !primaryPaths.includes(page.path));

export const OPERATIONAL_ROUTES: string[] = [
  '/',
  ...NAVIGATION_PAGES.map(p => p.path),
  '/vendor-dispositions',
  '/ai-insights',
  '/warehouse-analytics',
  '/visuals',
  '/consumers',
  '/validation',
  '/lead-ledger',
  '/offershop-flow',
  '/users',
  '/settings',
];

export function isOperationalRoute(pathname: string): boolean {
  const canonical = ({ '/': '/overview', '/users': '/access-control', '/settings': '/admin' } as Record<string, string>)[pathname] || pathname;
  return OPERATIONAL_ROUTES.includes(canonical) || OPERATIONAL_ROUTES.includes(pathname);
}

export function navigationPage(pathname: string): NavigationPage | undefined {
  const canonical = ({ '/': '/overview', '/users': '/access-control', '/settings': '/admin' } as Record<string, string>)[pathname] || pathname;
  return NAVIGATION_PAGES.find(page => page.path === canonical);
}
export function relatedPages(section: NavigationSection, isAdmin: boolean): NavigationPage[] {
  return NAVIGATION_PAGES.filter(page => primarySection(page.section) === primarySection(section) && (!page.adminOnly || isAdmin));
}
export function searchNavigation(query: string, isAdmin: boolean): NavigationPage[] {
  const normalized = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const terms = normalized.split(/\s+/).filter(Boolean);
  const matches = NAVIGATION_PAGES.filter(page => {
    if (page.adminOnly && !isAdmin) return false;
    const searchable = `${page.name} ${SECTION_NAMES[page.section]} ${page.description} ${page.path.replace(/[-/]/g, ' ')} ${(page.aliases || []).join(' ')}`.toLowerCase();
    return terms.every(term => searchable.includes(term));
  });
  const relevance = (page: NavigationPage) => {
    const title = page.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (title === normalized) return 3;
    if (terms.every(term => title.includes(term))) return 2;
    return page.aliases?.some(alias => alias.toLowerCase() === normalized) ? 1 : 0;
  };
  return terms.length ? matches.sort((a, b) => relevance(b) - relevance(a)) : matches;
}
