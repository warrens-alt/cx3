import React, { useState } from 'react';

/** Limits only rendered rows. Callers retain the complete loaded data for exports. */
export default function TablePreview<T>({ rows, children, limit = 10, label }: {
  rows: readonly T[];
  children: (visibleRows: readonly T[]) => React.ReactNode;
  limit?: number;
  label: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, limit);
  return <div className="cx-table-preview">
    {children(visible)}
    {rows.length > limit && <div className="cx-table-preview-footer">
      <span role="status">Showing {visible.length} of {rows.length} loaded rows</span>
      <button type="button" className="cx-admin-text-button" aria-label={`${showAll ? 'Show fewer' : 'View all'} ${label}`}
        aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? 'Show fewer' : 'View all'}</button>
    </div>}
  </div>;
}
