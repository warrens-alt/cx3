/** Physical source roles are not interchangeable with approved, versioned reporting facts. */
export const SOURCE_COVERAGE_VERSION = 'cx.sources.1.0.0';
export const SOURCE_ROLES = ['leads', 'calls', 'timeToDial', 'activations', 'marketing'] as const;
export type SourceRole = typeof SOURCE_ROLES[number];
export interface SourceMetric {
  id: string; label: string; field?: string; operation: 'count' | 'distinct' | 'sum' | 'true' | 'timestamp';
  unit: 'records' | 'seconds' | 'source_amount'; note?: string;
}
export interface SourceDefinition {
  label: string; dateField: string; dateMeaning: string; metrics: SourceMetric[];
  filters: Partial<Record<'source' | 'vendor' | 'medium', string>>;
  legacyConsumers: string[]; requiredIdentityFields: string[]; warning: string;
}
export const SOURCE_DEFINITIONS: Record<SourceRole, SourceDefinition> = {
  leads: {
    label: 'Lead Ledger', dateField: 'fetched', dateMeaning: 'Lead capture date',
    filters: {source: 'offershop_source', medium: 'offernet_medium', vendor: 'hlc_details.vendor'},
    requiredIdentityFields: ['lead_id', 'hlc_details.vendor', 'hlc_details.transaction_id'],
    legacyConsumers: ['overview','funnel','quality','sources','timeseries','calls','speed-to-lead','outcomes','routing','consumers','revetting','leads','explore','export'],
    warning: 'Source rows can contain multiple vendor records. Rows, leads and consumers are different populations.',
    metrics: [{id:'source_rows',label:'Ledger Source Rows',operation:'count',unit:'records'},
      {id:'distinct_leads',label:'Distinct Ledger Lead IDs',field:'lead_id',operation:'distinct',unit:'records'},
      {id:'valid_leads',label:'Rows with Valid Lead Flag',field:'valid_lead',operation:'true',unit:'records'},
      {id:'valid_id',label:'Rows with Valid National ID Flag',field:'valid_idno',operation:'true',unit:'records'},
      {id:'valid_phone',label:'Rows with Valid Phone Flag',field:'phone_valid',operation:'true',unit:'records'}],
  },
  calls: {
    label: 'Dialler Records', dateField:'call_start_date',dateMeaning:'Recorded call-start date',filters:{vendor:'vendor'},
    requiredIdentityFields:['dialer_lead_id','vendor'], legacyConsumers:['overview','funnel','calls','outcomes','sources','cohorts','speed-to-lead','explore','export'],
    warning:'A source row is not a deduplicated call event until the event-ID and ledger/dialler identity contracts are verified.',
    metrics:[{id:'source_rows',label:'Dialler Source Rows',operation:'count',unit:'records'},
      {id:'dialler_lead_ids',label:'Distinct Dialler Lead IDs',field:'dialer_lead_id',operation:'distinct',unit:'records'},
      {id:'rpc_rows',label:'Rows with RPC Flag',field:'is_rpc',operation:'true',unit:'records'},
      {id:'sale_rows',label:'Rows with Sale Flag',field:'is_sale',operation:'true',unit:'records'},
      {id:'duration_seconds',label:'Recorded Duration (Seconds)',field:'length_in_sec',operation:'sum',unit:'seconds'}],
  },
  timeToDial: {
    label:'Time-to-Dial Source',dateField:'expected_first_dial',dateMeaning:'Expected first-dial date (not an observed call date)',filters:{},
    requiredIdentityFields:[],legacyConsumers:['source-metrics/timeToDial'],
    warning:'Expected first dial is a schedule field, not actual first dial. Joining this source to lead/vendor outcomes requires a verified key mapping; it is not silently merged with call logs.',
    metrics:[{id:'source_rows',label:'Time-to-Dial Source Rows',operation:'count',unit:'records'},
      {id:'expected_first_dial_rows',label:'Rows with Valid Expected First Dial',field:'expected_first_dial',operation:'timestamp',unit:'records'}],
  },
  activations: {
    label:'BLC Activation Source',dateField:'date_created',dateMeaning:'Activation-source creation date (not proof of service activation date)',filters:{},
    requiredIdentityFields:['transaction_id'],legacyConsumers:['overview','outcomes','sources','cohorts','explore','export'],
    warning:'This BLC-specific table does not establish activation coverage for every vendor. Expected revenue is not approved revenue or cash collected.',
    metrics:[{id:'source_rows',label:'Activation Source Rows',operation:'count',unit:'records'},
      {id:'transaction_ids',label:'Distinct Activation Transaction IDs',field:'transaction_id',operation:'distinct',unit:'records'},
      {id:'expected_value',label:'Expected Value on Source Rows',field:'expected_ontact_revenue',operation:'sum',unit:'source_amount',note:'Source-row sum may include repeated transaction snapshots; not recognised revenue.'}],
  },
  marketing: {
    label:'Platform Media Insights',dateField:'date',dateMeaning:'Media reporting date',filters:{},requiredIdentityFields:['date','channel'],
    legacyConsumers:['acquisition'],warning:'Platform lead actions are not ledger leads. Reach, budgets and spend must not be treated as interchangeable or duplicated across vendors.',
    metrics:[{id:'source_rows',label:'Media Source Rows',operation:'count',unit:'records'},
      {id:'impressions',label:'Reported Impressions',field:'impressions',operation:'sum',unit:'records'},
      {id:'clicks',label:'Reported Clicks',field:'clicks',operation:'sum',unit:'records'},
      {id:'platform_leads',label:'Platform Lead Actions',field:'actions_lead',operation:'sum',unit:'records'}],
  },
};
