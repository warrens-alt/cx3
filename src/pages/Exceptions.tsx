import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Download, Filter, Search, ShieldCheck, X, FileText, Database, Table as TableIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { PAGE_TITLES } from '../../contracts/naming';
import type { ExceptionRuleResult, ExceptionStatus } from '../../contracts/operations';
import { exactNumber } from '../../contracts/format';
import { useClient } from '../lib/ClientContext';
import { useFilters } from '../lib/FilterContext';
import { reportingRequest, type ExceptionCatalogueResponse } from '../lib/reportingClient';
import EvidenceScopeBar from '../components/operations/EvidenceScopeBar';
import WorkspaceState from '../components/operations/WorkspaceState';
import MetricRail from '../components/operations/MetricRail';
import { VisualTable } from '../components/visuals/DataVisual';

const statusLabel: Record<string, string> = {
  AVAILABLE: 'Evidence checked',
  CONFIGURATION_REQUIRED: 'Configuration required',
  SOURCE_UNAVAILABLE: 'Source unavailable',
  RULE_NOT_SUPPORTED: 'Not supported'
};
const exportJson = (data: unknown, name: string) => {
  try {
    const href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch (err) {
    console.error('Export JSON failed:', err);
  }
};

type SortKey = 'label' | 'population' | 'count' | 'severity' | 'status' | 'owner';

export default function Exceptions() {
  const { selectedClient } = useClient();
  const tenantKey = selectedClient || 'default_tenant';
  const query = useQuery<ExceptionCatalogueResponse>({
    queryKey: ['exceptions-catalogue', tenantKey],
    queryFn: ({ signal }) => reportingRequest('/exceptions?' + new URLSearchParams({ tenantId: tenantKey }), signal),
    retry: false,
    staleTime: 60000
  });
  const rules = useMemo(() => Array.isArray(query.data?.rules) ? query.data.rules : [], [query.data?.rules]);
  const { vendor } = useFilters();
  const [search, setSearch] = useState(''), deferredSearch = useDeferredValue(search.trim().toLowerCase());

  useEffect(() => {
    if (vendor && !['all', 'all vendors'].includes(vendor.toLowerCase())) {
      setSearch(vendor);
    } else if (!vendor) {
      setSearch('');
    }
  }, [vendor]);
  const [status, setStatus] = useState<'ALL' | ExceptionStatus>('ALL'), [severity, setSeverity] = useState('ALL'), [selected, setSelected] = useState<string | null>(null), [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('severity');
  const [sortAsc, setSortAsc] = useState(false);
  const [pageSize, setPageSize] = useState(8);
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');

  const filtered = useMemo(() => {
    const matched = rules.filter(rule => {
      if (!rule) return false;
      const matchesStatus = status === 'ALL' || rule.status === status;
      const matchesSeverity = severity === 'ALL' || rule.severity === severity;
      const matchesSearch = !deferredSearch || `${rule.label || ''} ${rule.population || ''} ${rule.vendor ?? ''} ${rule.owner ?? ''}`.toLowerCase().includes(deferredSearch);
      return matchesStatus && matchesSeverity && matchesSearch;
    });

    const severityWeight: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, information: 1 };

    return [...matched].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'label') {
        cmp = (a.label || '').localeCompare(b.label || '');
      } else if (sortKey === 'population') {
        cmp = (a.population || '').localeCompare(b.population || '');
      } else if (sortKey === 'count') {
        const parseCount = (c: string | null) => (c !== null && /^-?\d+$/.test(String(c).trim()) ? BigInt(String(c).trim()) : -1n);
        const ac = parseCount(a.count);
        const bc = parseCount(b.count);
        cmp = ac > bc ? 1 : ac < bc ? -1 : 0;
      } else if (sortKey === 'severity') {
        cmp = (severityWeight[a.severity] ?? 0) - (severityWeight[b.severity] ?? 0);
      } else if (sortKey === 'status') {
        cmp = (a.status || '').localeCompare(b.status || '');
      } else if (sortKey === 'owner') {
        cmp = (a.owner ?? '').localeCompare(b.owner ?? '');
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [rules, status, severity, deferredSearch, sortKey, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const selectedRule = rules.find(rule => rule && rule.id === selected) ?? filtered[0] ?? null;
  const checkedCount = rules.filter(rule => rule && rule.status === 'AVAILABLE').reduce((sum, rule) => {
    const raw = String(rule?.count ?? '0');
    return /^\d+$/.test(raw) ? sum + BigInt(raw) : sum;
  }, 0n).toString();
  const configCount = String(rules.filter(rule => rule && rule.status === 'CONFIGURATION_REQUIRED').length);
  const sourceCount = String(rules.filter(rule => rule && rule.status === 'SOURCE_UNAVAILABLE').length);
  const openStatus = (next: 'ALL' | ExceptionStatus) => { setStatus(next); setPage(0); };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'label' || key === 'population' || key === 'status');
    }
  };

  const exportCsv = () => {
    const headers = ['Rule ID', 'Rule Label', 'Population', 'Count', 'Severity', 'Status', 'Owner', 'Description'];
    const rows = filtered.map(r => [
      `"${r?.id ?? ''}"`,
      `"${(r?.label ?? r?.id ?? '').replace(/"/g, '""')}"`,
      `"${(r?.population ?? '').replace(/"/g, '""')}"`,
      `"${r?.count ?? 'Unavailable'}"`,
      `"${r?.severity ?? 'medium'}"`,
      `"${statusLabel[r?.status] || r?.status || 'Unknown'}"`,
      `"${(r?.owner ?? 'Not configured').replace(/"/g, '""')}"`,
      `"${(r?.description ?? '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
    const href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = `cx-exception-rules-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  return <div className="cx-page cx-ops-page cx-exceptions-page">
    <header className="cx-page-header">
      <div>
        <p className="cx-ops-eyebrow">Operational action centre</p>
        <h1 className="text-page-title">{PAGE_TITLES['/exceptions']}</h1>
        <p>Turn operational evidence into an inspectable rule queue while keeping missing thresholds, mappings and sources visibly unavailable.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="cx-button-secondary" onClick={exportCsv} disabled={!filtered.length}>
          <FileText size={15}/>Export CSV
        </button>
        <button type="button" className="cx-button-secondary" onClick={()=>exportJson(filtered,'cx-exception-rules.json')} disabled={!filtered.length}>
          <Download size={15}/>Export JSON
        </button>
      </div>
    </header>

    <EvidenceScopeBar releaseId={query.data?.releaseId} cutoff={query.data?.cutoff} busy={query.isFetching}/>
    
    <WorkspaceState loading={query.isLoading} error={query.error} missingRelease={query.data&&!query.data.available?query.data.reason:null} retry={()=>query.refetch()}/>

    {!query.isLoading && query.data && !query.data.available && (
      <div className="enterprise-card p-6 border-blue-200 bg-blue-50/50 space-y-4 my-4">
        <div className="flex items-center gap-2 text-blue-900 font-semibold">
          <Database size={18} className="text-[#3562B3]" />
          <span>Operational Release Telemetry Guidance</span>
        </div>
        <p className="text-sm text-text-sec">
          The versioned operational release dataset (<code>CX_REPORTING_DATASET</code>) is currently unconfigured in this environment. Operational rules and SLA exceptions are derived from published BigQuery release snapshots.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link to="/overview" className="cx-button-secondary text-xs">Explore Executive Overview</Link>
          <Link to="/call-performance" className="cx-button-secondary text-xs">View Call Performance</Link>
          <Link to="/speed-to-lead" className="cx-button-secondary text-xs">View Speed to Lead</Link>
          <Link to="/lead-performance" className="cx-button-secondary text-xs">View Lead Funnel</Link>
        </div>
      </div>
    )}

    {query.data?.available&&<>
      <MetricRail items={[{id:'checked',label:'Evidence-backed exception count',value:exactNumber(checkedCount),note:'Counts only rules supported by published release validation; unavailable rules are excluded.'},{id:'config',label:'Rules needing configuration',value:exactNumber(configCount),note:'SLA, freshness, eligibility or threshold approval is required.'},{id:'source',label:'Rules missing source evidence',value:exactNumber(sourceCount),note:'Missing facts remain unavailable rather than becoming zero.'},{id:'rules',label:'Rules in catalogue',value:exactNumber(String(rules.length)),note:query.data.releaseId?`Release ${query.data.releaseId} · cutoff ${query.data.cutoff?.slice(0,10) ?? 'N/A'}`:'Approved release'}]}/>
      <section className="enterprise-card cx-exception-queue">
        <header>
          <div>
            <p className="cx-ops-eyebrow">Workflow queue</p>
            <h2>Operational exception rules</h2>
            <p>Counts are published only when the rule has evidence. Configuration-required rows do not imply zero affected records.</p>
          </div>
          <span className="cx-status">{filtered.length} matching rules</span>
        </header>

        <div className="cx-exception-tabs" role="tablist" aria-label="Exception status">
          <button role="tab" aria-selected={status==='ALL'} onClick={()=>openStatus('ALL')}>All <span>{rules.length}</span></button>
          {(['AVAILABLE','CONFIGURATION_REQUIRED','SOURCE_UNAVAILABLE'] as ExceptionStatus[]).map(item=><button key={item} role="tab" aria-selected={status===item} onClick={()=>openStatus(item)}>{item==='AVAILABLE'?'Evidence checked':item==='CONFIGURATION_REQUIRED'?'Needs configuration':'Source unavailable'} <span>{rules.filter(rule=>rule.status===item).length}</span></button>)}
        </div>

        <div className="cx-ops-table-tools">
          <label className="relative">
            <Search size={15}/>
            <span className="sr-only">Search exception rules</span>
            <input 
              value={search} 
              onChange={event=>{setSearch(event.target.value);setPage(0);}} 
              placeholder="Search rule or population"
              className={search ? 'pr-7' : ''}
            />
            {search && (
              <button 
                type="button" 
                onClick={()=>{setSearch('');setPage(0);}} 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-mute hover:text-text-main"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </label>
          <label>
            <Filter size={15}/>
            <span className="sr-only">Filter by severity</span>
            <select aria-label="Filter by severity" value={severity} onChange={event=>{setSeverity(event.target.value);setPage(0);}}>
              <option value="ALL">All severities</option>
              {['critical','high','medium','low','information'].map(item=><option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span>Per page</span>
            <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(0);}} aria-label="Rows per page">
              <option value="8">8</option>
              <option value="16">16</option>
              <option value="24">24</option>
            </select>
          </label>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs ml-auto">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                viewMode === 'table'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                viewMode === 'graph'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Graph</span>
            </button>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="cx-exception-layout">
            <div className="cx-ops-table-scroll">
              <VisualTable initialView="table" visual={{id:'operations.exceptions',data:pageRows}} className="enterprise-table" aria-label="Operational exception rules">
                <thead>
                  <tr>
                    <th scope="col" onClick={()=>toggleSort('label')} className="cursor-pointer select-none">
                      <div className="inline-flex items-center gap-1">
                        <span>Rule</span>
                        {sortKey === 'label' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                      </div>
                    </th>
                    <th scope="col" onClick={()=>toggleSort('population')} className="cursor-pointer select-none">
                      <div className="inline-flex items-center gap-1">
                        <span>Population</span>
                        {sortKey === 'population' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                      </div>
                    </th>
                    <th scope="col" onClick={()=>toggleSort('count')} className="cursor-pointer select-none">
                      <div className="inline-flex items-center gap-1">
                        <span>Count</span>
                        {sortKey === 'count' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                      </div>
                    </th>
                    <th scope="col" onClick={()=>toggleSort('severity')} className="cursor-pointer select-none">
                      <div className="inline-flex items-center gap-1">
                        <span>Severity</span>
                        {sortKey === 'severity' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                      </div>
                    </th>
                    <th scope="col" onClick={()=>toggleSort('status')} className="cursor-pointer select-none">
                      <div className="inline-flex items-center gap-1">
                        <span>Status</span>
                        {sortKey === 'status' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                      </div>
                    </th>
                    <th scope="col" onClick={()=>toggleSort('owner')} className="cursor-pointer select-none">
                      <div className="inline-flex items-center gap-1">
                        <span>Owner</span>
                        {sortKey === 'owner' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(rule => (
                    <tr key={rule.id} data-selected={selectedRule?.id === rule.id}>
                      <th scope="row">
                        <button type="button" className="cx-link-button" onClick={() => setSelected(rule.id)}>
                          {rule.label || rule.id}
                        </button>
                      </th>
                      <td>{rule.population || 'Unknown'}</td>
                      <td>{rule.count === null ? <span title="No evidence-backed count is available" className="text-text-mute">Unavailable</span> : exactNumber(String(rule.count))}</td>
                      <td><span className="cx-severity" data-severity={rule.severity}>{rule.severity}</span></td>
                      <td><span className="cx-rule-status" data-status={rule.status}>{statusLabel[rule.status] || rule.status}</span></td>
                      <td>{rule.owner ?? 'Not configured'}</td>
                    </tr>
                  ))}
                </tbody>
              </VisualTable>
            </div>
            {selectedRule && <RuleDetail rule={selectedRule} />}
          </div>
        ) : (
          <div className="p-6 bg-slate-50/50 rounded-xl border border-slate-200">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-4 font-semibold">Exceptions Count by Rule</h4>
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filtered.slice(0, 12).map(r => {
                    const labelStr = r?.label || r?.id || 'Unknown';
                    const numStr = r?.count !== null && r?.count !== undefined ? String(r.count).trim() : '';
                    return {
                      name: labelStr.length > 25 ? labelStr.slice(0, 22) + '...' : labelStr,
                      count: /^\d+$/.test(numStr) ? Number(numStr) : 0,
                      severity: r?.severity || 'medium'
                    };
                  })}
                  margin={{ top: 10, right: 30, left: 10, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" angle={-20} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '12px' }}
                    formatter={(val: any) => [Number(val).toLocaleString(), 'Exceptions']}
                  />
                  <Bar dataKey="count" name="Exceptions Count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {!filtered.length&&<p className="cx-ops-empty" role="status">No exception rules match these local controls.</p>}

        <footer>
          <span>Showing {filtered.length?page*pageSize+1:0}–{Math.min((page+1)*pageSize,filtered.length)} of {filtered.length} matching rules</span>
          <div>
            <button className="cx-button-secondary" disabled={page===0} onClick={()=>setPage(old=>old-1)}>Previous</button>
            <button className="cx-button-secondary" disabled={page+1>=pageCount} onClick={()=>setPage(old=>old+1)}>Next</button>
          </div>
        </footer>
      </section>

      <section className="cx-exception-principles">
        <article>
          <ShieldCheck size={20}/>
          <div>
            <h2>Observed evidence stays separate</h2>
            <p>Sales never create a call or RPC. Release validation never substitutes for a period-specific operational query.</p>
          </div>
        </article>
        <article>
          <AlertTriangle size={20}/>
          <div>
            <h2>Thresholds require approval</h2>
            <p>Operating hours, SLAs, freshness limits, retry limits and activation eligibility are configuration—not presentation defaults.</p>
          </div>
        </article>
      </section>
    </>}
  </div>;
}

function RuleDetail({ rule }: { rule: ExceptionRuleResult }) {
  if (!rule) return null;
  return (
    <aside className="cx-exception-detail" aria-label={`Rule detail: ${rule?.label || 'Rule'}`}>
      <span className="cx-severity" data-severity={rule.severity}>{rule.severity}</span>
      <h3>{rule.label || rule.id}</h3>
      <p>{rule.description || 'No description provided.'}</p>
      <dl>
        <div><dt>Evidence status</dt><dd>{statusLabel[rule.status] || rule.status || 'Unknown'}</dd></div>
        <div><dt>Population</dt><dd>{rule.population || 'Unknown'}</dd></div>
        <div><dt>Scope basis</dt><dd>{rule.scopeBasis === 'release_validation' ? 'Release-wide validation' : 'Selected period'}</dd></div>
        <div><dt>Source facts</dt><dd>{Array.isArray(rule.sourceEvidence) && rule.sourceEvidence.length ? rule.sourceEvidence.join(', ') : 'Not mapped'}</dd></div>
        <div><dt>Age</dt><dd>{rule.age ?? 'Unavailable'}</dd></div>
        <div><dt>Owner</dt><dd>{rule.owner ?? 'Not configured'}</dd></div>
      </dl>
      {rule.reason && <p className="cx-ops-unavailable"><AlertTriangle size={16} />{rule.reason}</p>}
      {rule.recordsPath ? (
        <a className="cx-button-primary" href={rule.recordsPath}>Open affected records</a>
      ) : (
        <button className="cx-button-secondary" disabled>Records unavailable until rule executes</button>
      )}
    </aside>
  );
}
