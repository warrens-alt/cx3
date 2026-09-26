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
        <div role="table" className="w-full text-left text-xs divide-y divide-slate-200 tabular-nums">
          <div role="rowgroup" className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
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
          <div role="rowgroup" className="divide-y divide-slate-100 bg-white">
            {data.map((row, idx) => {
              const baseKey = getRowKey(row);
              const isSelected = selectedKey === baseKey;
              return (
                <div
                  key={`${baseKey}-${idx}`}
                  role="row"
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`flex items-center px-4 py-2.5 sm:py-3 transition-colors duration-150 ${
                    onRowClick ? 'cursor-pointer hover:bg-slate-50/80 active:bg-slate-100' : ''
                  } ${isSelected ? 'bg-blue-50/70 ring-1 ring-blue-400' : ''}`}
                >
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      role="cell"
                      className={`flex-1 ${col.align === 'right' ? 'text-right font-mono' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                    >
                      {col.render ? col.render(row) : (row as any)[col.key] ?? '—'}
                    </div>
                  ))}
                </div>
              );
            })}
            {data.length === 0 && (
              <div role="row" className="px-4 py-8 text-center text-slate-400">
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
      <div className="p-4 text-xs text-slate-400 italic">
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
        <div key={title} className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500">
          <strong className="block text-slate-700 capitalize mb-1">{title}</strong>
          No rows in this collection.
        </div>
      );
    }

    const firstItem = list[0];
    const columns = typeof firstItem === 'object' && firstItem !== null
      ? Object.keys(firstItem)
      : ['Value'];

    return (
      <div key={title} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs my-3">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {title} ({list.length} {list.length === 1 ? 'row' : 'rows'})
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Dataset reference</span>
        </div>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="enterprise-table w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
              <tr>
                {columns.map(col => (
                  <th key={col} className="py-2 px-3 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {list.slice(0, 50).map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70">
                  {columns.map(col => {
                    const cellVal = typeof row === 'object' && row !== null ? row[col] : row;
                    return (
                      <td key={col} className="py-1.5 px-3 whitespace-nowrap text-slate-700">
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
          <div className="px-4 py-1.5 bg-slate-50 text-[11px] text-slate-500 border-t border-slate-200 text-center font-sans">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono">
          {scalarEntries.map(([k, v]) => (
            <div key={k} className="p-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">{k}</span>
              <span className="font-semibold text-slate-800">{formatCellValue(v)}</span>
            </div>
          ))}
        </div>
      )}

      {arrayEntries.map(([name, list]) => renderDatasetTable(name, list as any[]))}

      {arrayEntries.length === 0 && scalarEntries.length === 0 && (
        <pre className="p-3 bg-slate-50 border border-slate-200 rounded text-xs font-mono overflow-auto max-h-48 text-slate-700">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default VisualTable;
