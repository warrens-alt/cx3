import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight } from 'lucide-react';
import { PAGE_TITLES } from '../../contracts/naming';
import { NAV_GROUPS } from '../lib/navigation';
import { navigationTarget } from '../lib/presentation';
import Modal from './Modal';
const PAGES=NAV_GROUPS.flatMap(group=>group.items.map(item=>({...item,group:group.title,title:item.name || PAGE_TITLES[item.path] || item.path})));
export default function CommandPalette({isOpen,onClose}:{isOpen:boolean;onClose:()=>void;onOpenFilters?:()=>void}){
  const [query,setQuery]=useState(''),[index,setIndex]=useState(0);
  const navigate=useNavigate(),location=useLocation(),list=useRef<HTMLDivElement>(null);
  const results=useMemo(()=>PAGES.filter(p=>(p.title+' '+p.group+' '+p.path).toLowerCase().includes(query.trim().toLowerCase())),[query]);
  useEffect(()=>{if(isOpen){setQuery('');setIndex(0);}},[isOpen]);
  useEffect(()=>{list.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({block:'nearest'});},[index]);
  const go=(path:string)=>{navigate(navigationTarget(path,location.pathname,location.search));onClose();};
  return <Modal open={isOpen} onClose={onClose} label="Quick navigation" className="cx-command-modal">
    <div className="cx-command-input"><Search size={20} aria-hidden="true"/><input autoFocus role="combobox" aria-label="Search pages and navigation" aria-expanded="true" aria-controls="page-results" aria-autocomplete="list" aria-activedescendant={results.length?`command-${index}`:undefined}
      placeholder="Find a page…" value={query} onChange={e=>{setQuery(e.target.value);setIndex(0);}} onKeyDown={e=>{
        if(e.key==='ArrowDown'){e.preventDefault();setIndex(old=>results.length?(old+1)%results.length:0);}
        if(e.key==='ArrowUp'){e.preventDefault();setIndex(old=>results.length?(old-1+results.length)%results.length:0);}
        if(e.key==='Enter'&&results[index]){e.preventDefault();go(results[index].path);}
      }}/><button className="cx-icon-button" onClick={onClose} aria-label="Close search"><X size={18}/></button></div>
    <div className="cx-command-results" role="listbox" aria-label="Matching pages" id="page-results" ref={list}>
      {!results.length&&<p className="p-6 text-sm text-text-sec" role="status">No pages match “{query}”. Try “calls”, “sources” or “evidence”.</p>}
      {results.map((item,i)=>{const Icon=item.icon;return <div role="option" aria-selected={i===index} id={`command-${i}`} data-index={i} key={`${item.group}-${item.name}-${item.path}-${i}`} onMouseEnter={()=>setIndex(i)} onClick={()=>go(item.path)} className="cx-command-option">
        <Icon size={18} aria-hidden="true"/><span><strong>{item.title}</strong><small>{item.group.toLowerCase()}</small></span><ArrowRight size={16} aria-hidden="true"/></div>;})}
    </div><footer className="cx-command-footer"><span>Arrow keys to navigate · Enter to open</span><span>Esc to close</span></footer>
  </Modal>;
}
