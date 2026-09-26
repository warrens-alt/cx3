import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight } from 'lucide-react';
import { PAGE_TITLES } from '../../contracts/naming';
import { NAV_GROUPS, SECONDARY_DESTINATIONS } from '../lib/navigation';
import { isCurrentPage, navigationTarget } from '../lib/presentation';
import Modal from './Modal';

const PAGES = [
  ...NAV_GROUPS.flatMap(group => group.items.map(item => ({ ...item, group: group.title, title: item.name || PAGE_TITLES[item.path] || item.path }))),
  ...SECONDARY_DESTINATIONS.map(item => ({ ...item, icon: Search, group: 'More analyses', title: item.name })),
];

export default function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; onOpenFilters?: () => void }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const navigate = useNavigate(), location = useLocation(), list = useRef<HTMLDivElement>(null);
  const id = useId();
  const resultsId = `${id}-results`, helpId = `${id}-help`;
  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return PAGES.filter(page => {
      const searchable = `${page.title} ${page.group} ${page.path.replace(/[-/]/g, ' ')}`.toLowerCase();
      return terms.every(term => searchable.includes(term));
    });
  }, [query]);
  useEffect(() => { if (isOpen) { setQuery(''); setIndex(0); } }, [isOpen]);
  useEffect(() => { list.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' }); }, [index, results.length]);
  const go = (path: string) => { navigate(navigationTarget(path, location.pathname, location.search)); onClose(); };

  return <Modal open={isOpen} onClose={onClose} label="Quick navigation" className="cx-command-modal">
    <div className="cx-command-input">
      <Search size={20} aria-hidden="true" />
      <input data-dialog-initial-focus role="combobox" aria-label="Search pages and navigation" aria-expanded={isOpen}
        aria-controls={resultsId} aria-describedby={helpId} aria-autocomplete="list" aria-activedescendant={results.length ? `${id}-option-${index}` : undefined}
        autoComplete="off" spellCheck={false} placeholder="Find a section or analysis…" value={query}
        onChange={event => { setQuery(event.target.value); setIndex(0); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'ArrowDown') { event.preventDefault(); setIndex(old => results.length ? (old + 1) % results.length : 0); }
          if (event.key === 'ArrowUp') { event.preventDefault(); setIndex(old => results.length ? (old - 1 + results.length) % results.length : 0); }
          if (event.key === 'Home' && (!query || event.altKey)) { event.preventDefault(); setIndex(0); }
          if (event.key === 'End' && (!query || event.altKey)) { event.preventDefault(); setIndex(Math.max(0, results.length - 1)); }
          if (event.key === 'Enter' && results[index]) { event.preventDefault(); go(results[index].path); }
        }} />
      <button type="button" className="cx-icon-button" onClick={onClose} aria-label="Close search"><X size={18} aria-hidden="true" /></button>
    </div>
    <div className="cx-command-count" role="status" aria-live="polite" aria-atomic="true">{results.length} {query ? (results.length === 1 ? 'matching page' : 'matching pages') : 'sections and analyses'}</div>
    <div className="cx-command-results" role="listbox" aria-label="Matching pages" id={resultsId} ref={list}>
      {results.map((item, optionIndex) => {
        const Icon = item.icon;
        const current = isCurrentPage(location.pathname, item.path, location.search);
        return <div role="option" aria-selected={optionIndex === index} id={`${id}-option-${optionIndex}`} data-index={optionIndex}
          key={`${item.group}-${item.path}`} onMouseMove={event => { if (event.movementX || event.movementY) setIndex(optionIndex); }} onMouseDown={event => event.preventDefault()}
          onClick={() => go(item.path)} className="cx-command-option">
          <Icon size={18} aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.group}</small></span>
          {current ? <small className="cx-command-current">Current page</small> : <ArrowRight size={16} aria-hidden="true" />}
        </div>;
      })}
    </div>
    {!results.length && <div className="cx-command-empty-search"><strong>No matching pages</strong><p>Try a section such as “contact”, “spend” or “evidence”.</p><button type="button" className="cx-button-secondary" onClick={() => { setQuery(''); setIndex(0); list.current?.parentElement?.querySelector('input')?.focus(); }}>Clear search</button></div>}
    <footer className="cx-command-footer" id={helpId}><span><kbd>↑</kbd> <kbd>↓</kbd> to navigate · <kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span></footer>
  </Modal>;
}
