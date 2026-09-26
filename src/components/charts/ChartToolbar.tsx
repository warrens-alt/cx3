import DataAuditDrawer from '../DataAuditDrawer';
import { Table as TableIcon, Download, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import React from 'react';

export function ChartToolbar({
  auditTitle,
  auditContext,
  auditGrain, 
  title, 
  subtitle,
  children,
  visualData,
}: { 
  title: string; 
  subtitle?: string;
  children?: React.ReactNode;
  auditTitle?: string;
  auditContext?: any;
  auditGrain?: string;
  visualData?: any;
}) {
  const [auditOpen, setAuditOpen] = useState(false);

  const handleExportCsv = () => {
    if (!visualData) return;
    const dataArray = Array.isArray(visualData) ? visualData : [visualData];
    if (dataArray.length === 0) return;

    // Extract headers
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
      <div>
        <h3 className="font-display text-sm sm:text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-normal">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {children}
        {auditTitle && (
          <button 
            type="button"
            onClick={() => setAuditOpen(true)} 
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0 shadow-2xs"
            title="Inspect supporting BigQuery evidence records"
          >
            <TableIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>View Data</span>
          </button>
        )}
        {visualData && (
          <button 
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0 shadow-2xs" 
            title="Export chart data as CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        )}
      </div>
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
