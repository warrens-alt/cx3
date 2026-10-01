import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight, Sun, Moon, Monitor } from 'lucide-react';
import { searchNavigation, SECTION_NAMES, NAV_GROUPS } from '../lib/navigation';
import { useAuth } from '../lib/AuthContext';
import { isCurrentPage, navigationTarget } from '../lib/presentation';
import { useTheme } from '../lib/ThemeContext';
import Modal from './Modal';

export default function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; onOpenFilters?: () => void }) {
  const { isAdmin } = useAuth();
  const { setTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const navigate = useNavigate(), location = useLocation(), list = useRef<HTMLDivElement>(null);
  const id = useId();
  const resultsId = `${id}-results`, helpId = `${id}-help`;

  const themeActions = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const matchesTheme = ['theme', 'dark', 'light', 'mode', 'color', 'appearance'].some(k => k.includes(q) || q.includes(k));
    if (!matchesTheme) return [];
    return [
      { id: 'theme-light', name: 'Switch to Light Theme', description: 'Clean daylight slate canvas with blue accents', icon: Sun, action: () => setTheme('light') },
      { id: 'theme-dark', name: 'Switch to Dark Theme', description: 'Deep dark canvas for reduced eye strain', icon: Moon, action: () => setTheme('dark') },
      { id: 'theme-system', name: 'Switch to System Theme', description: 'Automatically matches your OS appearance', icon: Monitor, action: () => setTheme('system') },
    ];
  }, [query, setTheme]);

  const pageResults = useMemo(() => query.trim() ? searchNavigation(query, isAdmin) : NAV_GROUPS[0].items.filter(page => !page.adminOnly || isAdmin), [query, isAdmin]);

  const totalResults = useMemo(() => [
    ...themeActions.map(t => ({ ...t, isAction: true as const, path: t.id })),
    ...pageResults.map(p => ({ ...p, isAction: false as const, action: undefined })),
  ], [themeActions, pageResults]);

  useEffect(() => { if (isOpen) { setQuery(''); setIndex(0); } }, [isOpen]);
  useEffect(() => { list.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' }); }, [index, totalResults.length]);
  
  const handleSelect = (item: (typeof totalResults)[number]) => {
    if (item.isAction && item.action) {
      item.action();
      onClose();
    } else {
      navigate(navigationTarget(item.path, location.pathname, location.search));
      onClose();
    }
  };

  return <Modal open={isOpen} onClose={onClose} label="Quick navigation" className="cx-command-modal">
    <div className="cx-command-input">
      <Search size={20} aria-hidden="true" />
      <input data-dialog-initial-focus role="combobox" aria-label="Search pages and navigation" aria-expanded={isOpen}
        aria-controls={resultsId} aria-describedby={helpId} aria-autocomplete="list" aria-activedescendant={totalResults.length ? `${id}-option-${index}` : undefined}
        autoComplete="off" spellCheck={false} placeholder="Find a page, action, or describe what you need…" value={query}
        onChange={event => { setQuery(event.target.value); setIndex(0); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'ArrowDown') { event.preventDefault(); setIndex(old => totalResults.length ? (old + 1) % totalResults.length : 0); }
          if (event.key === 'ArrowUp') { event.preventDefault(); setIndex(old => totalResults.length ? (old - 1 + totalResults.length) % totalResults.length : 0); }
          if (event.key === 'Home' && (!query || event.altKey)) { event.preventDefault(); setIndex(0); }
          if (event.key === 'End' && (!query || event.altKey)) { event.preventDefault(); setIndex(Math.max(0, totalResults.length - 1)); }
          if (event.key === 'Enter' && totalResults[index]) { event.preventDefault(); handleSelect(totalResults[index]); }
        }} />
      <button type="button" className="cx-icon-button" onClick={onClose} aria-label="Close search"><X size={18} aria-hidden="true" /></button>
    </div>
    <div className="cx-command-count" role="status" aria-live="polite" aria-atomic="true">
      {totalResults.length} {query ? (totalResults.length === 1 ? 'match' : 'matches') : 'suggested destinations'}
    </div>
    <div className="cx-command-results" role="listbox" aria-label="Matching pages and commands" id={resultsId} ref={list}>
      {totalResults.map((item, optionIndex) => {
        const Icon = item.icon;
        const current = !item.isAction && isCurrentPage(location.pathname, item.path, location.search);
        const group = !query.trim() ? 'Suggested' : item.isAction === true ? 'Display preferences' : SECTION_NAMES[item.section];
        const previous = totalResults[optionIndex - 1];
        const previousGroup = previous ? (!query.trim() ? 'Suggested' : previous.isAction === true ? 'Display preferences' : SECTION_NAMES[previous.section]) : null;
        return <React.Fragment key={item.path}>
          {group !== previousGroup && <div className="cx-command-group-label" role="presentation">{group}</div>}
          <div role="option" aria-selected={optionIndex === index} id={`${id}-option-${optionIndex}`} data-index={optionIndex}
          onMouseMove={event => { if (event.movementX || event.movementY) setIndex(optionIndex); }} onMouseDown={event => event.preventDefault()}
          onClick={() => handleSelect(item)} className="cx-command-option">
          <Icon size={18} aria-hidden="true" />
          <span>
            <strong>{item.name}</strong>
            <small>{item.description}</small>
            <span className={query.trim() ? "cx-command-section" : "sr-only"}>
              {item.isAction === true ? 'Appearance command' : `${SECTION_NAMES[item.section]}${item.adminOnly ? ' · Admin' : ''}`}
            </span>
          </span>
          {current ? <small className="cx-command-current">Current page</small> : <ArrowRight size={16} aria-hidden="true" />}
        </div></React.Fragment>;
      })}
    </div>
    {!totalResults.length && <div className="cx-command-empty-search"><strong>No matching pages or actions</strong><p>Try “first call”, “caller ID”, “spend”, “theme” or “dark”.</p><button type="button" className="cx-button-secondary" onClick={() => { setQuery(''); setIndex(0); list.current?.parentElement?.querySelector('input')?.focus(); }}>Clear search</button></div>}
    <footer className="cx-command-footer" id={helpId}><span><kbd>↑</kbd> <kbd>↓</kbd> to navigate · <kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span></footer>
  </Modal>;
}
