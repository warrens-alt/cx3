import React, { useState } from 'react';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import { useClient } from '../lib/ClientContext';
import { useFilters } from '../lib/FilterContext';
import { Download, Table as TableIcon } from 'lucide-react';
import { useAnalyticsData } from '../lib/useAnalyticsData';

export default function DataAudit() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [grain, setGrain] = useState('lead');

  // Let's rely on standard endpoints or we can fetch manually.
  // Actually, we can use useAnalyticsData to fetch the export JSON
  
  const handleExport = (format: string) => {
    const params = new URLSearchParams({
      clientId: selectedClient || 'default',
      grain,
      format
    });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (filters && Object.keys(filters).length > 0) {
      params.append('filters', JSON.stringify(filters));
    }
    
    const url = '/api/analytics/export?' + params.toString();
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageShell>
      <PageHeader 
        title="Data Export & Raw Query Audit" 
        category="Direct BigQuery Extraction"
        description="Filter, extract, and audit raw BigQuery partitions and multi-vendor transactions for offline reconciliation." 
      />
      
      <div className="enterprise-card p-6 flex flex-wrap gap-6 items-end bg-surface-sec">
        <div>
          <label className="text-sm font-medium text-text-sec block mb-2">Export Data Grain</label>
          <select 
            value={grain}
            onChange={(e) => setGrain(e.target.value)}
            className="w-full border rounded-md px-4 py-2 text-sm bg-white font-medium"
          >
            <option value="lead">Unique Lead (Semantic)</option>
            <option value="transaction">Lead × Vendor Transaction (Semantic)</option>
            <option value="raw_source">Raw Source Tables</option>
          </select>
        </div>
        
        <button onClick={() => handleExport('csv')} className="px-6 py-2 bg-[#3562B3] text-white rounded-md font-medium text-sm flex items-center gap-2 hover:bg-[#294F95] transition-colors">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>
      
      <div className="p-8 text-center text-text-mute bg-white border rounded-lg border-dashed">
        <TableIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p className="max-w-md mx-auto">
          The dataset will be exported applying the current Global Filters.
          To view the data in a table format, use the "View Data" button on individual KPI cards and charts across the application.
        </p>
      </div>
    </PageShell>
  );
}
