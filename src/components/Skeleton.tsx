import React from 'react';

export function Skeleton({ className = '', style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`animate-pulse bg-border-subtle rounded ${className}`} style={style} {...props} />
  );
}

export function ChartSkeleton() {
  const heights = [32, 48, 41, 63, 54, 75, 62, 84, 70, 90, 77, 95];
  return (
    <div className="enterprise-card p-6 h-[400px] flex flex-col">
      <Skeleton className="h-4 w-1/4 mb-8" />
      <div className="flex-1 flex items-end gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-sm" style={{ height: `${heights[i]}%` }} />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="enterprise-card overflow-hidden">
      <div className="bg-surface-sec p-4 border-b border-border-strong flex gap-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="p-4 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="p-6 space-y-6" role="status" aria-label="Loading page" aria-busy="true">
      <span className="sr-only">Loading page content…</span>
      <div aria-hidden="true" className="space-y-6">
      <Skeleton className="h-8 w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <ChartSkeleton />
      <TableSkeleton />
      </div>
    </div>
  );
}
