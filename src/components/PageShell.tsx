import React from 'react';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function PageShell({ children, className = '', ariaLabel }: PageShellProps) {
  return <div className={`cx-page-shell ${className}`} aria-label={ariaLabel}>{children}</div>;
}
