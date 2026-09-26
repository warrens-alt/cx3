import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Clock3, Download, Moon, Sun, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFilters, extractOffernetFilters } from '../lib/FilterContext';
import { useClient } from '../lib/ClientContext';
import { fetchSpeedToLead, type SpeedToLeadData } from '../lib/offernetClient';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import OperationalPageHeader from '../components/OperationalPageHeader';
import { downloadCsv } from '../lib/formatters';
import { useScopedNavigationTarget } from '../hooks/useScopedNavigationTarget';

export default function SpeedToLeadIntelligence() {
  const scoped = useScopedNavigationTarget();
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [data, setData] = useState<SpeedToLeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (forceRefresh = false) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      setData(await fetchSpeedToLead({
        clientId: selectedClient,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...extractOffernetFilters(filters),
      }, forceRefresh));
    } catch (err: any) {
      setError(err?.message || 'Failed to load contact timing analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) loadData();
  }, [selectedClient, startDate, endDate, filters]);

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Lead-age cohort', 'Leads', 'RPC', 'RPC rate', 'Sales', 'Sale rate', 'Activations', 'Activation rate'],
      ...data.cohorts.map(row => [
        row.cohort,
        row.leads,
        row.contacted,
        row.contactRate,
        row.sales,
        row.saleRate,
        row.activations,
        row.activationRate,
      ]),
    ];
    downloadCsv(`contact_timing_${selectedClient}_${startDate || 'all'}_${endDate || 'all'}`, rows);
  };

  const cohortMax = useMemo(() => Math.max(1, ...(data?.cohorts || []).map(row => row.leads)), [data?.cohorts]);
  const primaryStage = data?.timingStages.find(stage => stage.stage === 'Delivery → First Dial') || data?.timingStages[0];

  return (
    <div className="cx-command-page">
      <OffernetFilterBar onRefresh={() => loadData(true)} onExportCsv={handleExportCsv} />

      <div className="cx-command-content">
        <OperationalPageHeader
          eyebrow="Contact"
          title="Speed to lead"
          description="Understand how quickly leads are contacted and how downstream outcomes change as first-dial age increases."
          actions={
            <Link to={scoped('/contact-strategy')} className="cx-button-secondary">
              Call-count outcomes <ArrowRight size={13}/>
            </Link>
          }
        />

        {error && <div className="cx-command-error"><AlertTriangle size={17}/>{error}</div>}
        {loading && !data && <div className="cx-command-loading"><div className="cx-command-spinner"/>Calculating latency distributions…</div>}

        {data && (
          <>
            <section className="cx-command-metrics cx-contact-metrics">
              <article className="cx-command-metric">
                <span>Median first dial</span>
                <strong>{primaryStage?.median || '—'}</strong>
                <div><small>{primaryStage?.stage || 'Delivery → First Dial'}</small></div>
              </article>
              <article className="cx-command-metric">
                <span>P75 first dial</span>
                <strong>{primaryStage?.p75 || '—'}</strong>
                <div><small>75% of measured leads below this latency</small></div>
              </article>
              <article className="cx-command-metric">
                <span>P90 first dial</span>
                <strong>{primaryStage?.p90 || '—'}</strong>
                <div><small>Tail latency</small></div>
              </article>
              <article className="cx-command-metric">
                <span>Age cohorts</span>
                <strong>{data.cohorts.length}</strong>
                <div><small>Observed first-dial groups</small></div>
              </article>
            </section>

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Latency</span>
                  <h2>Measured lifecycle stages</h2>
                  <p>Percentiles are shown in one stable table so comparison does not require switching visual modes.</p>
                </div>
                <Clock3 size={16} className="text-slate-400"/>
              </header>
              <div className="cx-performance-table-wrap">
                <table className="cx-performance-table cx-timing-table">
                  <thead>
                    <tr>
                      <th>Stage</th>
                      <th>Definition</th>
                      <th>Average</th>
                      <th>Median</th>
                      <th>P75</th>
                      <th>P90</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.timingStages.map((stage, index) => (
                      <tr key={`${stage.stage}-${index}`}>
                        <th><span className="cx-inline-stage"><Zap size={13}/>{stage.stage}</span></th>
                        <td>{stage.description}</td>
                        <td>{stage.avg}</td>
                        <td><strong>{stage.median}</strong></td>
                        <td>{stage.p75}</td>
                        <td>{stage.p90}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Lead age</span>
                  <h2>Outcome by time to first dial</h2>
                  <p>Each cohort combines population size with RPC, sale and activation yield.</p>
                </div>
              </header>
              <div className="cx-contact-cohorts">
                {data.cohorts.map((row, index) => (
                  <article key={`${row.cohort}-${index}`}>
                    <div className="cx-contact-cohort-label">
                      <strong>{row.cohort}</strong>
                      <small>{row.leads.toLocaleString()} leads</small>
                    </div>
                    <div className="cx-contact-cohort-volume"><i style={{ width: `${(row.leads / cohortMax) * 100}%` }}/></div>
                    <dl>
                      <div><dt>RPC</dt><dd>{row.contactRate}%</dd></div>
                      <div><dt>Sale</dt><dd>{row.saleRate}%</dd></div>
                      <div><dt>Activation</dt><dd>{row.activationRate}%</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>

            <section className="cx-command-panel">
              <header>
                <div>
                  <span className="cx-command-section-kicker">Operating context</span>
                  <h2>Business hours vs after-hours</h2>
                  <p>Observed lead volume, contact rate, sale rate and average first-dial latency by capture context.</p>
                </div>
              </header>
              <div className="cx-hours-grid">
                {data.afterHours.map((row, index) => {
                  const afterHours = row.type.toLowerCase().includes('after');
                  return (
                    <article key={`${row.type}-${index}`}>
                      <div className="cx-hours-title">
                        {afterHours ? <Moon size={16}/> : <Sun size={16}/>}
                        <div><strong>{row.type}</strong><small>{row.leads.toLocaleString()} leads</small></div>
                      </div>
                      <dl>
                        <div><dt>RPC rate</dt><dd>{row.contactRate}%</dd></div>
                        <div><dt>Sale rate</dt><dd>{row.saleRate}%</dd></div>
                        <div><dt>Avg first dial</dt><dd>{row.avgTimeToFirstDial}</dd></div>
                      </dl>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="cx-command-shortcuts">
              <Link to={scoped('/contact-strategy')}><Zap size={16}/><span><strong>Call-count outcomes</strong><small>See RPC and sales by recorded call count</small></span><ArrowRight size={14}/></Link>
              <Link to={scoped('/exceptions')}><AlertTriangle size={16}/><span><strong>SLA exceptions</strong><small>Investigate overdue first-dial populations</small></span><ArrowRight size={14}/></Link>
              <button type="button" onClick={handleExportCsv}><Download size={16}/><span><strong>Export cohorts</strong><small>Download current scoped contact timing data</small></span><ArrowRight size={14}/></button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
