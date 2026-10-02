import React from 'react';

/** Shape only: no placeholder metric values or animated data. */
export default function VisualSkeleton({ kind = 'bars', label = 'Loading evidence' }: {
  kind?: 'lifecycle' | 'heatmap' | 'timeline' | 'bars'; label?: string;
}) {
  const count = kind === 'heatmap' ? 168 : kind === 'lifecycle' || kind === 'timeline' ? 6 : 5;
  return <div className={`cx-visual-skeleton is-${kind}`} role="status" aria-label={label}>
    <span className="sr-only">{label}</span><div aria-hidden="true">{Array.from({ length: count }, (_, index) => <i key={index} />)}</div>
  </div>;
}
