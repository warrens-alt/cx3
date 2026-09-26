import React from 'react';

interface Props {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, children }: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-text-main tracking-tight leading-snug">{title}</h2>
        {subtitle && <p className="text-sm text-text-sec mt-1 leading-normal">{subtitle}</p>}
      </div>
      {children && (
        <div className="flex items-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
}
