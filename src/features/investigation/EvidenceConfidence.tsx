import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useClient } from '../../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../../lib/FilterContext';
import { useOperationalData } from '../../lib/useOperationalData';
import { fetchDataIntegrity, type DataIntegrityData } from '../../lib/offernetClient';
import { EvidenceStatus } from '../trust/components/SourceEvidenceMatrix';
import { investigationPath } from './investigationModel';

export default function EvidenceConfidence() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [params] = useSearchParams();
  const { data, loading, error } = useOperationalData<DataIntegrityData>('DataIntegrityIntelligence', { clientId: selectedClient, startDate: startDate || undefined, endDate: endDate || undefined, ...extractOffernetFilters(filters) }, fetchDataIntegrity);
  const drill = params.get('drill') || '';
  const needsActivation = /activation|unactivated|sale|funnel/.test(drill);
  const required = [ { key: 'leads', label: 'Lead source' }, { key: 'delivery', label: 'Delivery evidence' }, { key: 'calls', label: 'Dialler evidence' }, ...(needsActivation ? [{ key: 'activations', label: 'Activation evidence' }] : []) ];
  return <section className="cx-investigation-confidence" aria-label="Evidence confidence for this question"><header><h2>Evidence coverage</h2><span>{data?.validationStatus || 'NOT_VERIFIED'}</span></header><p>Source observations inform this question. They cover tenant-owned source records; they do not certify this investigation population or its completeness.</p>
    {error && <p role="alert">Confidence checks unavailable: {error}</p>}
    <div className="cx-investigation-confidence-items">{required.map(requirement => {
      const source = !error ? data?.sources?.find(item => item.key === requirement.key) : undefined;
      return <details key={requirement.key}><summary><span>{requirement.label}</span><EvidenceStatus status={source?.status || (error ? 'CHECK_FAILED' : loading ? 'NOT_VERIFIED' : 'UNAVAILABLE')} /></summary><p>{source?.detail || (requirement.key === 'delivery' ? 'Independent delivery coverage is not supplied by source observability. A recorded lead-source timestamp does not verify delivery completeness.' : 'No coverage metadata was supplied for this required source.')}</p><dl><div><dt>Source table</dt><dd>{source?.table || 'Not supplied'}</dd></div><div><dt>Latest observed timestamp</dt><dd>{source?.latestRecordAt || 'Unavailable'}</dd></div><div><dt>Observation scope</dt><dd>All authorised tenant-owned source rows; not the selected lead cohort.</dd></div></dl></details>;
    })}</div><Link to={investigationPath('/data-integrity', params)}>Open contextual data confidence</Link>
  </section>;
}
