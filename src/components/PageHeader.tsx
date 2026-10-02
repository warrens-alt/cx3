import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  subtitle?: React.ReactNode;
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
  const desc = description || subtitle;

  return (
    <header className="cx-page-header">
      <div className="cx-page-heading">
        {category && (
          <div className="cx-page-category">

            <span>{category}</span>
          </div>
        )}
        <h1 className="cx-page-title">
          {title}
        </h1>
        {desc && <p className="cx-page-description">{desc}</p>}
        {badge && (
          <div className="cx-page-badges">
            <span className="cx-page-badge">{badge}</span>
          </div>
        )}
        {badges && badges.length > 0 && (
          <div className="cx-page-badges">
            {badges.map((b, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-text-mute" aria-hidden="true">·</span>}
                <span className={b.variant === 'success' ? 'text-semantic-pos font-semibold' : 'text-text-sec font-medium'}>
                  {b.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
      {children && <div className="cx-page-actions">{children}</div>}
    </header>
  );
}
