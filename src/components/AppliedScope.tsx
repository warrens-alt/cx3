import React from 'react';
import { useFilters } from '../lib/FilterContext';
import { X, Calendar } from 'lucide-react';

export default function AppliedScope() {
  const { startDate, endDate, appliedFilters, setFilter, clearFilters } = useFilters();

  return (
    <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
      {startDate && endDate && (
        <span className="inline-flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded text-slate-700 border border-slate-200/80 font-medium">
          <Calendar size={12} className="text-slate-400" />
          <span>{startDate} → {endDate}</span>
        </span>
      )}
      {appliedFilters.map(({ key, label, value }) => (
        <span 
          key={key} 
          className="inline-flex items-center gap-1.5 bg-blue-50/90 text-blue-700 px-2.5 py-1 rounded border border-blue-200/90 font-medium transition-all group"
        >
          <span>{label}: <strong>{value}</strong></span>
          <button
            type="button"
            onClick={() => setFilter(key, null)}
            aria-label={`Remove filter ${label}: ${value}`}
            className="text-blue-500 hover:text-blue-800 hover:bg-blue-100/80 p-0.5 rounded transition-colors cursor-pointer"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {appliedFilters.length > 0 && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-slate-500 hover:text-slate-800 text-xs underline px-1 py-0.5 transition-colors cursor-pointer"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
