import DataAuditDrawer from './DataAuditDrawer';
import { Table as TableIcon, Download } from 'lucide-react';
import { useState } from 'react';
import React from 'react';

interface Props {
  visualData?: any;
  auditTitle?: string;
  auditContext?: any;
  auditGrain?: string;
  title: string;
  subtitle?: string;
  controls?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export function ChartPanel({ title, subtitle, controls, children, footer, visualData, auditTitle, auditContext, auditGrain }: Props) {
  const [auditOpen, setAuditOpen] = useState(false);

  const handleExportCsv = () => {
    if (!visualData) return;
    const dataArray = Array.isArray(visualData) ? visualData : [visualData];
    if (dataArray.length === 0) return;

    const firstItem = dataArray[0];
    if (typeof firstItem !== 'object' || firstItem === null) return;

    const headers = Object.keys(firstItem);
    const quote = (val: any) => {
      if (val === null || val === undefined) return '""';
      const s = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const csvContent = '\uFEFF' + [
      headers.map(quote).join(','),
      ...dataArray.map(row => headers.map(h => quote(row[h])).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_data.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="enterprise-card flex flex-col h-full">
      {(title || controls || auditTitle || visualData) && (
        <div className="p-4 sm:p-5 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            {title && <h3 className="text-card-title text-text-main font-semibold tracking-tight">{title}</h3>}
            {subtitle && <p className="text-[12px] text-text-sec mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {controls}
            {auditTitle && (
              <button 
                type="button"
                onClick={() => setAuditOpen(true)} 
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-slate-700 bg-surface border border-border-subtle rounded-md hover:bg-slate-50 transition-colors shrink-0 shadow-2xs"
                title="Inspect supporting records"
              >
                <TableIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>View Data</span>
              </button>
            )}
            {visualData && (
              <button 
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 bg-surface border border-border-subtle rounded-md hover:bg-slate-50 transition-colors shrink-0 shadow-2xs"
                title="Export data as CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 p-4 sm:p-5 min-h-[220px] relative">
        {children}
      </div>
      {footer && (
        <div className="px-4 sm:px-5 py-3 border-t border-border-subtle bg-surface-sec/30 text-[12px]">
          {footer}
        </div>
      )}

      {auditTitle && (
        <DataAuditDrawer
          isOpen={auditOpen}
          onClose={() => setAuditOpen(false)}
          title={auditTitle}
          contextFilters={auditContext || {}}
          defaultGrain={auditGrain || 'lead'}
        />
      )}
    </div>
  );
}
