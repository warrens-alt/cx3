import {
  LayoutDashboard, GitFork, PhoneCall, BarChart3, AlertTriangle, ShieldCheck, Search, Settings,
  Timer, ListChecks, PhoneOutgoing, Users, CalendarDays, BadgeCheck, Megaphone, Database,
  CircleDollarSign, FileCheck2, Route, ChartNoAxesCombined, Shield, type LucideIcon,
} from 'lucide-react';

export type NavigationSection = 'overview' | 'funnel' | 'contact' | 'performance' | 'exceptions' | 'evidence' | 'explore' | 'settings';
export interface NavigationPage {
  name: string;
  path: string;
  description: string;
  section: NavigationSection;
  icon: LucideIcon;
  aliases?: string[];
  adminOnly?: boolean;
}

export const SECTION_NAMES: Record<NavigationSection, string> = {
  overview: 'Overview', funnel: 'Funnel', contact: 'Contact', performance: 'Performance',
  exceptions: 'Exceptions', evidence: 'Evidence', explore: 'Explore', settings: 'Settings',
};

export const NAVIGATION_PAGES: NavigationPage[] = [
  { name: 'Overview', path: '/overview', description: 'Lead progress, response times and work needing attention.', section: 'overview', icon: LayoutDashboard, aliases: ['workspace', 'dashboard'] },
  { name: 'Funnel', path: '/funnel', description: 'Follow leads from arrival through sales and activation.', section: 'funnel', icon: GitFork, aliases: ['journey', 'conversion'] },
  { name: 'Speed to lead', path: '/speed-to-lead', description: 'Delivery-to-call timing and operating-hours coverage.', section: 'contact', icon: Timer, aliases: ['response', 'first call', 'sla'] },
  { name: 'Vendor performance', path: '/vendor-quality', description: 'Compare vendors, sources and lead quality.', section: 'performance', icon: BarChart3, aliases: ['quality', 'partners'] },
  { name: 'Exceptions', path: '/exceptions', description: 'Find leads waiting for action or missing outcomes.', section: 'exceptions', icon: AlertTriangle, aliases: ['backlog', 'attention'] },
  { name: 'Evidence reports', path: '/reports', description: 'Inspect reporting evidence and published release status.', section: 'evidence', icon: ShieldCheck, aliases: ['verified', 'releases'] },
  { name: 'Explore leads', path: '/lead-explorer', description: 'Search individual leads and inspect their timelines.', section: 'explore', icon: Search, aliases: ['records', 'consumer', 'timeline'] },
  { name: 'Settings', path: '/admin', description: 'Workspace connection status and display preferences.', section: 'settings', icon: Settings, aliases: ['appearance', 'density', 'spacing', 'system', 'configuration'] },
  { name: 'Contact strategy', path: '/contact-strategy', description: 'Recorded call effort and outcomes by attempt count.', section: 'contact', icon: ListChecks, aliases: ['attempts', 'retry', 'redial'] },
  { name: 'Caller ID performance', path: '/cli-performance', description: 'Compare caller IDs and their recorded call outcomes.', section: 'contact', icon: PhoneOutgoing, aliases: ['cli', 'phone', 'dialler'] },
  { name: 'Agent activity', path: '/agent-performance', description: 'Observed calls and outcomes for each agent.', section: 'contact', icon: Users, aliases: ['agent performance', 'rpc', 'team'] },
  { name: 'Time & day performance', path: '/temporal', description: 'Compare lead timing across hours and weekdays.', section: 'contact', icon: CalendarDays, aliases: ['calendar', 'temporal', 'hourly'] },
  { name: 'Sales & activation', path: '/sales-activation', description: 'Recorded sales, activation and outstanding follow-up.', section: 'performance', icon: BadgeCheck, aliases: ['outcomes', 'conversion'] },
  { name: 'Campaigns & spend', path: '/campaigns', description: 'Campaign delivery, media spend and platform lead costs.', section: 'performance', icon: Megaphone, aliases: ['marketing', 'advertising', 'budget', 'cpl'] },
  { name: 'Data integrity', path: '/data-integrity', description: 'Source availability, missing fields and data checks.', section: 'evidence', icon: Database, aliases: ['trust', 'quality', 'health'] },
  { name: 'Spend & commercial', path: '/commercial', description: 'Commercial measures and their available source evidence.', section: 'performance', icon: CircleDollarSign, aliases: ['revenue', 'cost'] },
  { name: 'Vendor evidence', path: '/vendors', description: 'Inspect reporting evidence grouped by vendor.', section: 'evidence', icon: FileCheck2, aliases: ['partners'] },
  { name: 'Reconciliation', path: '/reconciliation', description: 'Review commercial reporting checks and differences.', section: 'evidence', icon: FileCheck2, aliases: ['audit', 'reconcile'] },
  { name: 'Lead routing', path: '/routing', description: 'Review lead delivery and vendor handoffs.', section: 'funnel', icon: Route, aliases: ['routing', 'assignment'] },
  { name: 'Cohort maturation', path: '/cohorts', description: 'Follow outcomes as lead cohorts mature over time.', section: 'funnel', icon: ChartNoAxesCombined, aliases: ['cohort', 'age', 'maturation'] },
  { name: 'Access control', path: '/access-control', description: 'Manage team access, roles and workspace permissions.', section: 'settings', icon: Shield, aliases: ['users', 'admin', 'permissions', 'invite'], adminOnly: true },
];

const primaryPaths = ['/overview', '/funnel', '/speed-to-lead', '/vendor-quality', '/exceptions', '/reports', '/lead-explorer', '/admin'];
const primaryItems = primaryPaths.map(path => {
  const page = NAVIGATION_PAGES.find(item => item.path === path)!;
  return { ...page, name: SECTION_NAMES[page.section], icon: page.section === 'contact' ? PhoneCall : page.icon };
});
export const NAV_GROUPS = [
  { title: 'Operate', items: primaryItems.filter(page => page.section !== 'settings') },
  { title: 'Administration', items: primaryItems.filter(page => page.section === 'settings') },
];
export const SECONDARY_DESTINATIONS = NAVIGATION_PAGES.filter(page => !primaryPaths.includes(page.path));

export function navigationPage(pathname: string): NavigationPage | undefined {
  const canonical = ({ '/': '/overview', '/users': '/access-control', '/settings': '/admin' } as Record<string, string>)[pathname] || pathname;
  return NAVIGATION_PAGES.find(page => page.path === canonical);
}

export function relatedPages(section: NavigationSection, isAdmin: boolean): NavigationPage[] {
  return NAVIGATION_PAGES.filter(page => page.section === section && (!page.adminOnly || isAdmin));
}

export function searchNavigation(query: string, isAdmin: boolean): NavigationPage[] {
  const normalized = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const terms = normalized.split(/\s+/).filter(Boolean);
  const matches = NAVIGATION_PAGES.filter(page => {
    if (page.adminOnly && !isAdmin) return false;
    const searchable = `${page.name} ${SECTION_NAMES[page.section]} ${page.description} ${page.path.replace(/[-/]/g, ' ')} ${(page.aliases || []).join(' ')}`.toLowerCase();
    return terms.every(term => searchable.includes(term));
  });
  // Naming a page should select it before a broader page that merely mentions the topic.
  const relevance = (page: NavigationPage) => {
    const title = page.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (title === normalized) return 3;
    if (terms.every(term => title.includes(term))) return 2;
    return page.aliases?.some(alias => alias.toLowerCase() === normalized) ? 1 : 0;
  };
  return terms.length ? matches.sort((first, second) => relevance(second) - relevance(first)) : matches;
}
