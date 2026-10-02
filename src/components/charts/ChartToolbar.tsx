import DataAuditDrawer from '../DataAuditDrawer';
import { Table as TableIcon, Download } from 'lucide-react';
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
    <div className="cx-chart-toolbar">
      <div className="cx-chart-toolbar-copy">
        <h3 className="">{title}</h3>
        {subtitle && <p className="">{subtitle}</p>}
      </div>
      <div className="cx-chart-toolbar-actions">
        {children}
        {auditTitle && (
          <button
            type="button"
            onClick={() => setAuditOpen(true)}
            className="cx-button-quiet"
            title="Inspect supporting BigQuery evidence records"
          >
            <TableIcon size={14} aria-hidden="true" />
            <span>View Data</span>
          </button>
        )}
        {visualData && (
          <button
            type="button"
            onClick={handleExportCsv}
            className="cx-button-quiet"
            title="Export chart data as CSV"
          >
            <Download size={14} aria-hidden="true" />
            <span >Export CSV</span>
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
