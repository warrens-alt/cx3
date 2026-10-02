import React from 'react';

export interface VisualTableProps<T = any> {
  id?: string;
  context?: any;
  visual?: any;
  children?: React.ReactNode;
  className?: string;
  initialView?: string;
  'aria-label'?: string;
  columns?: Array<{
    key: string;
    label: string;
    render?: (row: T) => React.ReactNode;
    align?: 'left' | 'right' | 'center';
    sortable?: boolean;
  }>;
  data?: T[] | any;
  onRowClick?: (row: T) => void;
  selectedKey?: string;
  getRowKey?: (row: T) => string;
  emptyMessage?: string;
}

export function VisualTable<T = any>({
  visual,
  children,
  className = '',
  initialView,
  'aria-label': ariaLabel,
  columns,
  data,
  onRowClick,
  selectedKey,
  getRowKey = (r: any) => r.id || r.key || String(r),
  emptyMessage = 'No records found.',
}: VisualTableProps<T>) {
  if (children) {
    return (
      <table className={className} aria-label={ariaLabel}>
        {children}
      </table>
    );
  }

  if (!columns || !data) {
    return null;
  }

  return (
    <div className={`enterprise-card overflow-hidden ${className}`} aria-label={ariaLabel}>
      <div className="overflow-x-auto">
        <div role="table" className="w-full text-left text-xs divide-y divide-border tabular-nums">
          <div role="rowgroup" className="bg-surface-subtle border-b border-border font-semibold text-text-main">
            <div role="row" className="flex items-center px-4 py-2.5 sm:py-3 transition-all duration-150">
              {columns.map((col) => (
                <div
                  key={col.key}
                  role="columnheader"
                  className={`flex-1 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                >
                  {col.label}
                </div>
              ))}
            </div>
          </div>
          <div role="rowgroup" className="divide-y divide-border-subtle bg-surface">
            {data.map((row, idx) => {
              const baseKey = getRowKey(row);
              const isSelected = selectedKey === baseKey;
              return (
                <div
                  key={`${baseKey}-${idx}`}
                  role="row"
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`flex items-center px-4 py-2.5 sm:py-3 transition-colors duration-150 ${
                    onRowClick ? 'cursor-pointer hover:bg-surface-subtle active:bg-[var(--cx-selected-bg)]' : ''
                  } ${isSelected ? 'bg-[var(--cx-selected-bg)] ring-1 ring-action' : ''}`}
                >
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      role="cell"
                      className={`flex-1 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                    >
                      {col.render ? col.render(row) : (row as any)[col.key] ?? '—'}
                    </div>
                  ))}
                </div>
              );
            })}
            {data.length === 0 && (
              <div role="row" className="px-4 py-8 text-center text-text-mute">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DataVisual({ id, data, context, children }: any) {
  if (children) {
    return <div className="space-y-4">{children}</div>;
  }

  if (!data) {
    return (
      <div className="p-4 text-xs text-text-mute italic">
        No dataset records available for exploration.
      </div>
    );
  }

  const formatCellValue = (val: any) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'number') {
      return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
    }
    if (typeof val === 'boolean') {
      return val ? 'true' : 'false';
    }
    if (typeof val === 'object') {
      if (val.value !== undefined) return String(val.value);
      return JSON.stringify(val);
    }
    return String(val);
  };

  const renderDatasetTable = (title: string, list: any[]) => {
    if (!list || list.length === 0) {
      return (
        <div key={title} className="p-3 bg-surface-subtle border border-border rounded text-xs text-text-sec">
          <strong className="block text-text-main capitalize mb-1">{title}</strong>
          No rows in this collection.
        </div>
      );
    }

    const firstItem = list[0];
    const columns = typeof firstItem === 'object' && firstItem !== null
      ? Object.keys(firstItem)
      : ['Value'];

    return (
      <div key={title} className="border border-border rounded-[var(--cx-radius-md)] overflow-hidden bg-surface my-3">
        <div className="px-4 py-2 bg-surface-subtle border-b border-border flex items-center justify-between">
          <span className="text-xs font-bold text-text-main uppercase tracking-wider">
            {title} ({list.length} {list.length === 1 ? 'row' : 'rows'})
          </span>
          <span className="text-[10px] text-text-mute">Dataset reference</span>
        </div>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="enterprise-table w-full text-xs text-left">
            <thead className="bg-surface-subtle border-b border-border text-text-sec font-semibold sticky top-0">
              <tr>
                {columns.map(col => (
                  <th key={col} className="py-2 px-3 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle tabular-nums">
              {list.slice(0, 50).map((row, idx) => (
                <tr key={idx} className="hover:bg-surface-subtle">
                  {columns.map(col => {
                    const cellVal = typeof row === 'object' && row !== null ? row[col] : row;
                    return (
                      <td key={col} className="py-1.5 px-3 whitespace-nowrap text-text-main">
                        {formatCellValue(cellVal)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length > 50 && (
          <div className="px-4 py-1.5 bg-surface-subtle text-[11px] text-text-sec border-t border-border text-center font-sans">
            Showing first 50 rows of {list.length} total records
          </div>
        )}
      </div>
    );
  };

  // Case 1: data is an array
  if (Array.isArray(data)) {
    return <div className="space-y-3">{renderDatasetTable(context?.endpoint || id || 'Records', data)}</div>;
  }

  // Case 2: data is an object with nested arrays / scalars
  const arrayEntries = Object.entries(data).filter(([_, v]) => Array.isArray(v));
  const scalarEntries = Object.entries(data).filter(([_, v]) => !Array.isArray(v) && typeof v !== 'object');

  return (
    <div className="space-y-4 pt-2">
      {scalarEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-surface-subtle border border-border rounded-[var(--cx-radius-md)] text-xs tabular-nums">
          {scalarEntries.map(([k, v]) => (
            <div key={k} className="p-1">
              <span className="text-[10px] text-text-sec font-mono uppercase font-bold block">{k}</span>
              <span className="font-semibold text-text-main">{formatCellValue(v)}</span>
            </div>
          ))}
        </div>
      )}

      {arrayEntries.map(([name, list]) => renderDatasetTable(name, list as any[]))}

      {arrayEntries.length === 0 && scalarEntries.length === 0 && (
        <pre className="p-3 bg-surface-subtle border border-border rounded text-xs font-mono overflow-auto max-h-48 text-text-main">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default VisualTable;
