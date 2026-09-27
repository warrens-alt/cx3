import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NAVIGATION_PAGES, SECTION_NAMES, navigationPage, primarySection, relatedPages } from '../lib/navigation';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';
import { useAuth } from '../lib/AuthContext';

export default function SectionNavigation({ className = '' }: { className?: string }) {
  const location = useLocation();
  const scoped = useScopedNavigationTarget();
  const { isAdmin } = useAuth();

  const currentPage = navigationPage(location.pathname);
  if (!currentPage) return null;

  const activeSection = primarySection(currentPage.section);
  // Don't show redundant single-destination tabs for Overview or Settings unless there are multiple pages
  const pages = relatedPages(activeSection, isAdmin);
  if (pages.length <= 1) return null;

  const sectionLabel = SECTION_NAMES[activeSection] || 'Section';

  return (
    <nav
      className={`cx-section-navigation flex items-center gap-1.5 overflow-x-auto py-1 px-1 border-b border-slate-200/80 bg-slate-50/70 text-xs ${className}`}
      aria-label={`${sectionLabel} subnavigation`}
    >
      <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] px-2 shrink-0">
        {sectionLabel}:
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {pages.map(page => {
          const isCurrent = location.pathname === page.path;
          return (
            <Link
              key={page.path}
              to={scoped(page.path)}
              aria-current={isCurrent ? 'page' : undefined}
              className={`px-3 py-1 font-medium rounded transition-colors whitespace-nowrap ${
                isCurrent
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              {page.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
