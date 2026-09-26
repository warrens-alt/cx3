export interface BaseQueryParams {
  clientId: string;
  startDate?: string;
  endDate?: string;
  filters?: any;
}

export function buildWhereClause(params: BaseQueryParams, targetView: string = "vw_leads") {
  if (targetView === 'vw_lead_lifecycle') {
    targetView = 'vw_leads';
  }
  let clauses = [];
  const queryParams: any = {};
  
  const dateField = targetView === 'vw_consumers' ? 'DATE(latest_lead_date)' : 'capture_date';
  
  if (params.startDate) {
    clauses.push(`${dateField} >= @startDate`);
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    clauses.push(`${dateField} <= @endDate`);
    queryParams.endDate = params.endDate;
  }

  if (params.filters) {
    let i = 0;
    for (const [key, filter] of Object.entries(params.filters)) {
      const f = filter as any;
      if (!f || !f.operator) continue;
      
      let semanticField = key;
      // Map canonical keys to semantic view columns
      if (key === 'activated') semanticField = 'activation';
      if (key === 'sales') semanticField = 'sale';
      if (key === 'calls') semanticField = 'total_calls';
      
      const paramName = `param_${i}`;
      
      if (f.operator === 'in' && Array.isArray(f.values) && f.values.length > 0) {
        const inParams = f.values.map((v:any, idx:number) => `@${paramName}_${idx}`);
        
        if (key === 'vendor') {
          if (targetView === 'vw_leads' || targetView === 'vw_lead_lifecycle') {
            clauses.push(`EXISTS (SELECT 1 FROM vw_lead_vendor_transactions v WHERE v.lead_id = ${targetView}.lead_id AND v.vendor IN (${inParams.join(',')}))`);
          } else if (targetView === 'vw_ror_events') {
            clauses.push(`EXISTS (SELECT 1 FROM vw_lead_vendor_transactions v WHERE v.lead_id = vw_ror_events.lead_id AND v.vendor IN (${inParams.join(',')}))`);
          } else if (targetView === 'vw_consumers') {
            clauses.push(`EXISTS (SELECT 1 FROM vw_lead_vendor_transactions v WHERE v.consumer_id = vw_consumers.consumer_id AND v.vendor IN (${inParams.join(',')}))`);
          } else {
            clauses.push(`vendor IN (${inParams.join(',')})`);
          }
        } else if (key === 'partner' || key === 'ror_partner') {
          if (targetView === 'vw_ror_events') {
            clauses.push(`partner IN (${inParams.join(',')})`);
          } else {
            clauses.push(`EXISTS (SELECT 1 FROM vw_ror_events r WHERE r.lead_id = ${targetView}.lead_id AND r.partner IN (${inParams.join(',')}))`);
          }
        } else {
          clauses.push(`${semanticField} IN (${inParams.join(',')})`);
        }
        
        f.values.forEach((v:any, idx:number) => {
          queryParams[`${paramName}_${idx}`] = v;
        });
      } else if (f.operator === 'equals' && f.value !== undefined) {
        if (key === 'vendor') {
          if (targetView === 'vw_leads' || targetView === 'vw_lead_lifecycle') {
            clauses.push(`EXISTS (SELECT 1 FROM vw_lead_vendor_transactions v WHERE v.lead_id = ${targetView}.lead_id AND v.vendor = @${paramName})`);
          } else if (targetView === 'vw_ror_events') {
            clauses.push(`EXISTS (SELECT 1 FROM vw_lead_vendor_transactions v WHERE v.lead_id = vw_ror_events.lead_id AND v.vendor = @${paramName})`);
          } else if (targetView === 'vw_consumers') {
            clauses.push(`EXISTS (SELECT 1 FROM vw_lead_vendor_transactions v WHERE v.consumer_id = vw_consumers.consumer_id AND v.vendor = @${paramName})`);
          } else {
            clauses.push(`vendor = @${paramName}`);
          }
        } else if (key === 'partner' || key === 'ror_partner') {
          if (targetView === 'vw_ror_events') {
            clauses.push(`partner = @${paramName}`);
          } else {
            clauses.push(`EXISTS (SELECT 1 FROM vw_ror_events r WHERE r.lead_id = ${targetView}.lead_id AND r.partner = @${paramName})`);
          }
        } else {
          clauses.push(`${semanticField} = @${paramName}`);
        }
        queryParams[paramName] = f.value;
      } else if (f.operator === 'not_equals' && f.value !== undefined) {
        clauses.push(`${semanticField} != @${paramName}`);
        queryParams[paramName] = f.value;
      } else if (f.operator === 'between' && f.min !== undefined && f.max !== undefined) {
        clauses.push(`${semanticField} BETWEEN @${paramName}_min AND @${paramName}_max`);
        queryParams[`${paramName}_min`] = f.min;
        queryParams[`${paramName}_max`] = f.max;
      } else if (f.operator === 'greater_than' && f.value !== undefined) {
        clauses.push(`${semanticField} > @${paramName}`);
        queryParams[paramName] = f.value;
      } else if (f.operator === 'less_than' && f.value !== undefined) {
        clauses.push(`${semanticField} < @${paramName}`);
        queryParams[paramName] = f.value;
      }
      i++;
    }
  }

  const sql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return { sql, queryParams };
}
