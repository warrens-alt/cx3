import React from 'react';
import { useLocation } from 'react-router-dom';
import { PAGE_TITLES } from '../../contracts/naming';

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  category?: string;
  badge?: string;
  badges?: Array<{ label: string; variant?: string }>;
  children?: React.ReactNode;
}

export default function PageHeader({
  title,
  description,
  subtitle,
  category,
  badge,
  badges,
  children,
}: PageHeaderProps) {
  const location = useLocation();
  const displayTitle = (location.pathname === '/visuals' ? 'Visual Workspace' : PAGE_TITLES[location.pathname]) || title;
  const desc = description || subtitle;

  return (
    <header className="cx-page-header">
      <div className="min-w-0 flex-1">
        {category && (
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-blue-600 mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            <span>{category}</span>
          </div>
        )}
        <h1 className="text-page-title text-slate-900 tracking-tight" style={{ textWrap: 'balance' }}>
          {displayTitle}
        </h1>
        {desc && <p className="text-slate-600 text-xs sm:text-[13px] leading-relaxed mt-1 max-w-3xl">{desc}</p>}
        {badge && (
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-mono">
            <span className="text-blue-700 font-semibold">{badge}</span>
          </div>
        )}
        {badges && badges.length > 0 && (
          <div className="flex items-center gap-2.5 mt-2.5 text-xs text-slate-500 font-mono flex-wrap">
            {badges.map((b, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-300" aria-hidden="true">·</span>}
                <span className={b.variant === 'success' ? 'text-emerald-700 font-semibold' : 'text-slate-700 font-medium'}>
                  {b.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
      {children && <div className="cx-page-actions shrink-0">{children}</div>}
    </header>
  );
}
