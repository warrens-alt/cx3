import React from 'react';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <div className={`w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6 lg:py-8 pb-16 sm:pb-20 fade-in transition-all duration-200 ${className}`}>
      {children}
    </div>
  );
}
