import React from 'react';
import { useClient } from '../../lib/ClientContext';
import { useFilters } from '../../lib/FilterContext';
import { scopeFilterSummary } from '../../lib/scopeControls';

/** Read-only context for focus mode. Uses the applied scope and performs no lookup. */
export default function ReportingScopeSummary() {
  const { selectedClient, clients } = useClient();
  const { startDate, endDate, filters } = useFilters();
  return <span className="cx-compact-scope-text">
    <strong>{clients.find(client => client.id === selectedClient)?.name || selectedClient || 'No workspace selected'}</strong>
    <span>{startDate || 'Open start'} – {endDate || 'Open end'}</span>
    <span>{filters.vendor ? `Vendor: ${scopeFilterSummary(filters.vendor)}` : 'All vendors'}</span>
    <span>{filters.source ? `Source: ${scopeFilterSummary(filters.source)}` : 'All sources'}</span>
    {Object.entries(filters).filter(([key]) => key !== 'vendor' && key !== 'source').map(([key, condition]) => <span key={key}>{key.replaceAll('_', ' ')}: {scopeFilterSummary(condition)}</span>)}
  </span>;
}
