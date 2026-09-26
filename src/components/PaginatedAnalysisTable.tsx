import { useState, type ReactNode } from 'react';

/** Pagination changes rendered rows only; callers retain the complete analytical population. */
export default function PaginatedAnalysisTable<T>({ rows, label, children }: {
  rows: readonly T[];
  label: string;
  children: (visibleRows: readonly T[]) => ReactNode;
}) {
  const pageSize = 25;
  const [position, setPosition] = useState({ rows, page: 0 });
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  // A different collection resets immediately, without a render of stale page contents.
  const page = position.rows === rows ? Math.min(position.page, pages - 1) : 0;
  const start = page * pageSize;

  if (!rows.length) return <p className="cx-control-note" role="status">No {label} match this selection.</p>;

  return <>
    {children(rows.slice(start, start + pageSize))}
    <nav className="cx-control-note flex flex-wrap items-center justify-between gap-3" aria-label={`${label} pagination`}>
      <span role="status">Showing {start + 1}–{Math.min(start + pageSize, rows.length)} of {rows.length.toLocaleString()} {label}</span>
      {pages > 1 && <div className="flex items-center gap-3">
        <button type="button" className="cx-button-secondary" aria-label={`Previous ${label} page`} disabled={page === 0} onClick={() => setPosition({ rows, page: page - 1 })}>Previous</button>
        <span>Page {page + 1} of {pages}</span>
        <button type="button" className="cx-button-secondary" aria-label={`Next ${label} page`} disabled={page + 1 >= pages} onClick={() => setPosition({ rows, page: page + 1 })}>Next</button>
      </div>}
    </nav>
  </>;
}
