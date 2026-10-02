import React from 'react';
import { useFilters } from '../lib/FilterContext';
import { X, Calendar } from 'lucide-react';

export default function AppliedScope() {
  const { startDate, endDate, appliedFilters, setFilter, clearFilters } = useFilters();

  return (
    <div className="flex items-center gap-2 text-xs text-text-sec flex-wrap">
      {startDate && endDate && (
        <span className="inline-flex items-center gap-1.5 bg-surface-subtle px-2.5 py-1 rounded text-text-main border border-border font-medium">
          <Calendar size={12} className="text-text-mute" />
          <span>{startDate} → {endDate}</span>
        </span>
      )}
      {appliedFilters.map(({ key, label, value }) => (
        <span 
          key={key} 
          className="inline-flex items-center gap-1.5 bg-[var(--cx-selected-bg)] text-action px-2.5 py-1 rounded border border-action/30 font-medium transition-all group"
        >
          <span>{label}: <strong>{value}</strong></span>
          <button
            type="button"
            onClick={() => setFilter(key, null)}
            aria-label={`Remove filter ${label}: ${value}`}
            className="text-action hover:text-action-hover hover:bg-[var(--cx-selected-bg)] p-0.5 rounded transition-colors cursor-pointer"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {appliedFilters.length > 0 && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-text-sec hover:text-text-main text-xs underline px-1 py-0.5 transition-colors cursor-pointer"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
