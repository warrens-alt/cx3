import React, { useState, useEffect, useMemo } from 'react';
import { PageShell } from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import { DataState, displayNumber } from '../components/DataState';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { fetchWarehouseTables } from '../lib/warehouseClient';
import { Download, RefreshCw } from 'lucide-react';
import {
  EXPORT_MANIFEST_EVIDENCE,
  OBSERVED_EXPORT_FAILURES,
  type DictionaryObject,
} from '../../contracts/warehouseDictionary';
import {
  RUBIX_DATASET_ID,
  RUBIX_REPORT_ID,
  RUBIX_MODEL_ID,
  RUBIX_ENTITY,
  RUBIX_COMPANY_PREDICATE,
  RUBIX_QUERY_TYPES,
} from '../../contracts/rubixPowerBi';

export default function AdminValidation() {
  const { data, loading, error, refetch } = useAnalyticsData('validation');
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'objects' | 'telemetry' | 'hygiene' | 'blc_powerbi'>('reconciliation');
  const [searchQuery, setSearchQuery] = useState('');
  const [datasetFilter, setDatasetFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [warehouseTables, setWarehouseTables] = useState<DictionaryObject[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tablesError, setTablesError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingTables(true);
    fetchWarehouseTables()
      .then(tbls => {
        if (active) { setWarehouseTables(tbls || []); setTablesError(false); }
      })
      .catch(() => {
        if (active) { setWarehouseTables([]); setTablesError(true); }
      })
      .finally(() => {
        if (active) setLoadingTables(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = (v: unknown) => {
    if (v === null || v === undefined) return 'Not measured';
    if (typeof v === 'string') return v;
    return displayNumber(v, 2);
  };

  const filteredObjects = useMemo(() => {
    return warehouseTables.filter((obj: DictionaryObject) => {
      if (datasetFilter !== 'all' && obj.dataset !== datasetFilter) return false;
      if (typeFilter !== 'all' && obj.tableType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          obj.tableName.toLowerCase().includes(q) ||
          obj.project.toLowerCase().includes(q) ||
          obj.dataset.toLowerCase().includes(q) ||
          obj.family.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [warehouseTables, datasetFilter, typeFilter, searchQuery]);

  const handleExportReconciliationCsv = () => {
    const metrics = data?.metrics || [];
    const headers = ['Metric', 'Raw BigQuery', 'Semantic Model', 'API Payload', 'UI Rendered', 'Status', 'Discrepancy', 'Analytical Grain'];
    const rows = metrics.map((m: any) => [
      `"${m.metric}"`,
      `"${m.rawBigQuery}"`,
      `"${m.semanticModel}"`,
      `"${m.apiPayload}"`,
      `"${m.uiRendered}"`,
      `"${m.status}"`,
      `"${m.discrepancy || ''}"`,
      `"${m.grain || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `data_validation_reconciliation_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportObjectsCsv = () => {
    const headers = ['Project', 'Dataset', 'Table Name', 'Type', 'Family', 'Disposition', 'Columns Count', 'Analytical Grain', 'Candidate Keys'];
    const rows = warehouseTables.map(obj => [
      `"${obj.project}"`,
      `"${obj.dataset}"`,
      `"${obj.tableName}"`,
      `"${obj.tableType}"`,
      `"${obj.family}"`,
      `"${obj.disposition}"`,
      obj.columns.length,
      `"${obj.analyticalGrain}"`,
      `"${(obj.candidateKeys || []).join('; ')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `warehouse_all_objects_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const metricsList = data?.metrics || [];
  const endpointTime = data?.reconciledAt || data?.verifiedAt;
  const timestamp = endpointTime && Number.isFinite(Date.parse(endpointTime)) ? new Date(endpointTime).toLocaleString() : 'Not reported';
  const tabs = [
    ['reconciliation', 'Returned comparison'], ['objects', 'Warehouse catalogue'],
    ['telemetry', 'Telemetry reference'], ['hygiene', 'Validation rules'], ['blc_powerbi', 'BLC integration reference'],
  ] as const;

  return <PageShell className="cx-validation-page">
    <PageHeader title="Validation evidence" description="Inspect returned comparison fields and registered schema references. Independent reconciliation remains outstanding." />
    <section className="cx-command-panel" aria-label="Validation boundary">
      <h2>Independent validation not established</h2>
      <p>The current validation endpoint returns reference measurements and status claims without an independent live reconciliation run. These reference values do not describe the selected workspace or reporting dates. They are not proof of current warehouse accuracy, access, financial reconciliation, or tenant isolation.</p>
      <p>Endpoint status: <strong>{data?.overallStatus || data?.status || 'Not reported'}</strong> · Endpoint timestamp: {timestamp}. This is not a reconciliation timestamp.</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" className="cx-button-secondary" onClick={() => refetch()} disabled={loading}><RefreshCw size={14}/> Refresh returned evidence</button>
        <button type="button" className="cx-button-secondary" onClick={activeTab === 'objects' ? handleExportObjectsCsv : handleExportReconciliationCsv} disabled={activeTab === 'objects' ? loadingTables || tablesError : loading || !!error || !data}><Download size={14}/> Export {activeTab === 'objects' ? 'catalogue' : 'returned matrix (unverified)'}</button>
      </div>
    </section>
    <nav className="cx-viz-jump-nav my-4" aria-label="Validation views">{tabs.map(([key,label]) => <button type="button" className="cx-button-secondary" key={key} aria-pressed={activeTab === key} onClick={() => setActiveTab(key)}>{label}</button>)}</nav>
    {activeTab === 'reconciliation' && <section className="cx-command-panel" aria-label="Returned comparison">
      <h2>Unverified endpoint output</h2>
      <p>Each value below is returned by the endpoint. Labels such as VERIFIED are quoted source claims, not a frontend certification. The CSV retains the original endpoint status claims and does not include this on-screen caveat. It must not be used as certification evidence.</p>
      {loading || error || !data ? <DataState loading={loading} error={error} empty={!data} retry={refetch}/> : <>
        <div className="cx-performance-table-wrap" role="region" aria-label="Unverified comparison fields" tabIndex={0}>
          <table className="cx-performance-table"><thead><tr>{['Metric','Raw BigQuery field','Semantic model field','API payload field','UI rendered field','Reported status','Reported comparison / grain'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>
            {metricsList.map((m:any,index:number)=><tr key={`${m.metric}-${index}`}><th scope="row">{m.metric}</th><td>{value(m.rawBigQuery)}</td><td>{value(m.semanticModel)}</td><td>{value(m.apiPayload)}</td><td>{value(m.uiRendered)}</td><td>{m.status || 'Not reported'} · unverified claim</td><td>{m.discrepancy || 'Not reported'}<br/>{m.grain}</td></tr>)}
          </tbody></table>
        </div>
        {!metricsList.length && <p>No comparison fields returned. No validation result is implied.</p>}
      </>}
    </section>}
    {activeTab === 'objects' && <section className="cx-command-panel" aria-label="Warehouse catalogue">
      <h2>Registered objects</h2><p>Saved schema registration does not establish live source access or row completeness.</p>
      <div className="flex flex-wrap gap-3 my-4">
        <label>Search returned catalogue <input aria-label="Search returned catalogue" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} /></label>
        <label>Dataset <select value={datasetFilter} onChange={e=>setDatasetFilter(e.target.value)}><option value="all">All datasets</option>{[...new Set(warehouseTables.map(t=>t.dataset))].map(d=><option key={d}>{d}</option>)}</select></label>
        <label>Object type <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">All types</option>{[...new Set(warehouseTables.map(t=>t.tableType))].map(t=><option key={t}>{t}</option>)}</select></label>
      </div>
      {loadingTables ? <p role="status">Loading catalogue…</p> : tablesError ? <p role="alert">Warehouse catalogue could not be loaded. Reopen this page to retry the existing catalogue read.</p> : <>
        <p>{filteredObjects.length} of {warehouseTables.length} returned objects match the local selection.</p>
        <div className="cx-performance-table-wrap" role="region" aria-label="Registered warehouse objects" tabIndex={0}><table className="cx-performance-table"><thead><tr>{['Project','Dataset','Object','Type','Family','Disposition','Registered columns','Grain','Candidate keys'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{filteredObjects.map((obj,index)=><tr key={`${obj.project}.${obj.dataset}.${obj.tableName}-${index}`}><td>{obj.project}</td><td>{obj.dataset}</td><th scope="row">{obj.tableName}</th><td>{obj.tableType}</td><td>{obj.family}</td><td>{obj.disposition}</td><td>{obj.columns.length}</td><td>{obj.analyticalGrain}</td><td>{(obj.candidateKeys || []).join(', ') || 'Not reported'}</td></tr>)}</tbody></table></div>
        {!filteredObjects.length && <p>No registered objects match this local selection.</p>}
      </>}
    </section>}
    {activeTab === 'telemetry' && <section className="cx-command-panel"><h2>Telemetry reference</h2><p>No measured JSON validity, event completeness or telemetry reconciliation result is returned by this page. Those checks are not reported.</p><p>The saved export manifest describes {EXPORT_MANIFEST_EVIDENCE.totalProjects} projects and {EXPORT_MANIFEST_EVIDENCE.totalDatasets} datasets. Registration is separate from current access.</p><details><summary>Historical export failure reference</summary><pre className="whitespace-pre-wrap break-words">{JSON.stringify(OBSERVED_EXPORT_FAILURES,null,2)}</pre></details></section>}
    {activeTab === 'hygiene' && <section className="cx-command-panel"><h2>Validation rules reference</h2><p>Identity validation, telephone formatting and lifecycle chronology require measured source checks. No clean-data percentage, executed-test count or chronology pass result is available here.</p><p>Repository test execution and warehouse reconciliation are separate evidence. A page render runs neither.</p></section>}
    {activeTab === 'blc_powerbi' && <section className="cx-command-panel"><h2>BLC integration contract reference</h2><p>No authenticated Power BI check or live mandate reconciliation has been performed by this page. Registered query definitions do not establish verified activations.</p><dl className="break-all"><dt>Dataset</dt><dd>{RUBIX_DATASET_ID}</dd><dt>Report</dt><dd>{RUBIX_REPORT_ID}</dd><dt>Model</dt><dd>{RUBIX_MODEL_ID}</dd><dt>Entity</dt><dd>{RUBIX_ENTITY}</dd><dt>Company predicate</dt><dd>{RUBIX_COMPANY_PREDICATE}</dd></dl><details><summary>Registered query types ({RUBIX_QUERY_TYPES.length})</summary><pre className="whitespace-pre-wrap break-words">{JSON.stringify(RUBIX_QUERY_TYPES,null,2)}</pre></details></section>}
  </PageShell>;
}
