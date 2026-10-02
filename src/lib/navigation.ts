import { PhoneCall, type LucideIcon } from 'lucide-react';
import {
  ROUTE_MANIFEST,
  BUSINESS_AREAS,
  getRouteItem,
  type LegacyNavigationSection,
} from '../app/routeManifest';

export type NavigationSection = LegacyNavigationSection;

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
  overview: 'Overview',
  funnel: 'Lead journey',
  contact: 'Contact centre',
  performance: 'Lead journey',
  sales: 'Sales & activation',
  commercial: 'Commercial',
  exceptions: 'Investigate',
  evidence: 'Investigate',
  explore: 'Investigate',
  settings: 'Settings & Admin',
};

export function primarySection(section: NavigationSection): NavigationSection {
  if (section === 'performance') return 'funnel';
  if (section === 'evidence' || section === 'explore') return 'exceptions';
  return section;
}

const LEGACY_PAGE_DESCRIPTIONS: Record<string, string> = {
  '/overview': 'What changed and what needs attention?',
  '/funnel': 'Where do leads stop progressing?',
  '/offershop-flow': 'End-to-end evidence tracking across acquisition, hospital, partner ROR and HLC delivery.',
  '/campaigns': 'Where did leads come from and how did media perform?',
  '/vetting': 'Are leads eligible and what explains qualification losses?',
  '/vendor-quality': 'Compare vendors, sources and lead quality on like-for-like populations.',
  '/routing': 'Did leads reach the intended receiving operation?',
  '/cohorts': 'Compare outcomes after equivalent follow-up time.',
  '/contact-strategy': 'Observe call-count outcomes, attempt saturation and vendor dispositions.',
  '/speed-to-lead': 'How quickly are delivered leads first dialled?',
  '/cli-performance': 'Which caller numbers have different observed call outcomes?',
  '/agent-performance': 'What calls and outcomes are recorded per agent?',
  '/temporal': 'How do capture and calling windows differ?',
  '/sales-activation': 'Which recorded sales activate and which are still waiting?',
  '/commercial': 'What spend and commercial outcomes are actually evidenced?',
  '/reconciliation': 'Which commercial populations and values do not reconcile?',
  '/investigate': 'Which recorded populations need investigation?',
  '/data-integrity': 'Are source feeds complete, mapped and fresh enough to interpret?',
  '/warehouse': 'Analytics across all Google Cloud projects, BigQuery datasets, and tables.',
  '/reports': 'Inspect published evidence and reporting-release status.',
  '/vendors': 'Inspect reporting evidence grouped by vendor.',
  '/admin': 'Workspace connections and display preferences.',
  '/access-control': 'Manage roles and permitted workspaces.',
};

/**
 * Authoritative pages derived directly from ROUTE_MANIFEST.
 */
export const NAVIGATION_PAGES: NavigationPage[] = ROUTE_MANIFEST.map(item => ({
    name: item.name,
    path: item.path,
    description: LEGACY_PAGE_DESCRIPTIONS[item.path] || item.description,
    section: ({ overview: 'overview', journey: 'funnel', contact: 'contact', sales: 'sales', commercial: 'commercial', investigate: 'exceptions', settings: 'settings' } as const)[item.area],
    icon: item.icon,
    aliases: item.searchTerms,
    adminOnly: item.adminOnly,
  }));

const primaryPaths = BUSINESS_AREAS.map(area => area.landingPath);

const primaryItems = primaryPaths.map(path => {
  const page = NAVIGATION_PAGES.find(item => item.path === path)!;
  return {
    ...page,
    name: BUSINESS_AREAS.find(area => area.landingPath === path)?.name || page.name,
    icon: page.section === 'contact' ? PhoneCall : page.icon,
  };
});

export const NAV_GROUPS = [
  { title: 'Customer journey', items: primaryItems.filter(page => page.section !== 'settings') },
  { title: 'Administration', items: primaryItems.filter(page => page.section === 'settings') },
];

export const SECONDARY_DESTINATIONS = NAVIGATION_PAGES.filter(page => !primaryPaths.includes(page.path));

export const OPERATIONAL_ROUTES: string[] = Array.from(
  new Set([
    '/',
    ...ROUTE_MANIFEST.map(p => p.path),
    ...ROUTE_MANIFEST.flatMap(p => p.urlAliases || []),
    '/vendor-dispositions',
  ])
);

export function isOperationalRoute(pathname: string): boolean {
  const canonical =
    ({ '/': '/overview', '/users': '/access-control', '/settings': '/admin', '/exceptions': '/investigate' } as Record<string, string>)[pathname] ||
    pathname;
  return OPERATIONAL_ROUTES.includes(canonical) || OPERATIONAL_ROUTES.includes(pathname);
}

export function navigationPage(pathname: string): NavigationPage | undefined {
  const canonical = getRouteItem(pathname)?.path;
  return NAVIGATION_PAGES.find(page => page.path === canonical);
}

export function relatedPages(section: NavigationSection, isAdmin: boolean): NavigationPage[] {
  return NAVIGATION_PAGES.filter(
    page => primarySection(page.section) === primarySection(section) && (!page.adminOnly || isAdmin)
  );
}

export function searchNavigation(query: string, isAdmin: boolean): NavigationPage[] {
  const normalized = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const terms = normalized.split(/\s+/).filter(Boolean);
  const matches = NAVIGATION_PAGES.filter(page => {
    if (page.adminOnly && !isAdmin) return false;
    const searchable = `${page.name} ${SECTION_NAMES[page.section]} ${page.description} ${page.path.replace(
      /[-/]/g,
      ' '
    )} ${(page.aliases || []).join(' ')}`.toLowerCase();
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
