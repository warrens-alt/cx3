import { TenantConfiguration } from './config';
import { getBigQueryClient } from './client';

export async function discoverData(client: TenantConfiguration) {
  const bq = getBigQueryClient(client.bigQueryProject);
  const [datasets] = await bq.getDatasets();
  
  let mapped = Object.values(client.semanticMappings.tables).map(t => String(t).split('.').pop());
  
  let tablesList = [];
  
  for (const dataset of datasets) {
    if (!client.bigQueryDatasets.includes(dataset.id)) continue; // only focus on lead_ledger for this prototype, or we could do all
    const [tables] = await dataset.getTables();
    
    for (const table of tables) {
      const [metadata] = await table.getMetadata();
      const isMapped = mapped.includes(table.id);
      
      let domain = 'Unknown';
      if (table.id.includes('vicidial')) domain = 'Calls';
      else if (table.id.includes('activations')) domain = 'Commercial';
      else if (table.id.includes('platform_insights')) domain = 'Marketing';
      else if (table.id.includes('lead_ledger')) domain = 'Lead Lifecycle';
      
      let usedBy = isMapped ? 'Overview, Calls, Outcomes' : '';
      if (domain === 'Marketing') usedBy = 'Acquisition';
      if (domain === 'Commercial' && isMapped) usedBy = 'Outcomes, Revenue';
      
      tablesList.push({
        dataset: dataset.id,
        table: table.id,
        type: metadata.type,
        domain,
        rows: metadata.numRows,
        latestRecord: 'N/A', // Omitted deep scan for performance
        mapped: isMapped,
        usedBy,
        status: 'ACTIVE'
      });
    }
  }
  
  return tablesList;
}
