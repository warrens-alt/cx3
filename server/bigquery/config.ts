import { RequestError } from './filters';

export interface ClientOperationalConfig {
  operatingHours: { start: string; end: string; workdays: number[] };
  grading: string[];
  salesDefinition: string;
  activationDefinition: string;
  currency: string;
  dispositionMapping: Record<string, string>;
  funnelStages: string[];
}

export interface MarketingAttributionContract {
  status: 'ACTIVE' | 'UNCONFIGURED';
  marketingSourceField?: string;
  leadSourceField?: string;
  marketingCampaignField?: string;
  leadCampaignField?: string;
  notes?: string;
}

export interface MarketingSourceContract {
  table: string;
  mappingStatus: 'MAPPED' | 'MASTER' | 'UNRESOLVED';
  clientNameField: string;
  clientNames: string[];
  dateField: string;
  channelField: string;
  campaignField: string;
  adsetField: string;
  impressionsField: string;
  reachField?: string;
  clicksField: string;
  outboundClicksField?: string;
  leadsField: string;
  approvedSpendFields: string[];
  spendUnitByField: Record<string, 'currency' | 'micros'>;
  approvedBudgetFields: string[];
  spendGrainFields: string[];
  attribution: MarketingAttributionContract;
}

export interface TenantConfiguration {
  id: string;
  name: string;
  active: boolean;
  currency: string;
  timezone: string;
  bigQueryProject: string;
  bigQueryDatasets: string[];
  dataSourceMode: 'separate' | 'shared';
  sharedTenantIdField?: string;
  sharedTenantIdValue?: string;
  capabilities: {
    marketing: boolean;
    leads: boolean;
    calls: boolean;
    sales: boolean;
    activation: boolean;
    revenue: boolean;
  };
  semanticMappings: {
    tables: {
      leads: string;
      marketing?: string;
      calls?: string;
      timeToDial?: string;
      activations?: string;
      cliPerformance?: string;
    };
    fields: Record<string, string>;
    partners?: string[];
  };
  marketing?: MarketingSourceContract;
  branding?: { logoUrl?: string; accentColor?: string };
  operationalConfig?: ClientOperationalConfig;
}

const DEFAULT_OPERATIONAL_CONFIG: ClientOperationalConfig = {
  operatingHours: { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] },
  grading: ['Gold', 'Silver', 'Bronze', 'Standard'],
  salesDefinition: 'Contract Verified & QA Passed',
  activationDefinition: 'First Monthly Debit / SIM Active',
  currency: 'ZAR',
  dispositionMapping: {
    SALE: 'Sale',
    A: 'Answering Machine',
    B: 'Busy',
    CALLBK: 'Callback',
    DAIR: 'Dead Air',
    DC: 'Disconnected',
    DNC: 'Do Not Call',
    NA: 'No Answer',
    NI: 'Not Interested',
    N: 'No Answer',
    RPC: 'Right Party Contact',
  },
  funnelStages: [
    'Captured',
    'Fetched',
    'Delivered',
    'Dialled',
    'Contacted',
    'Qualified',
    'Sale',
    'Activated',
    'Revenue',
  ],
};

const BASE_TABLES = {
  leads: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
  marketing: 'dashboards-422710.lead_ledger.lead_ledger_platform_insights',
  calls: 'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights',
  timeToDial: 'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights_time_to_dial',
  activations: 'dashboards-422710.lead_ledger.tbl_blc_activations',
  cliPerformance: 'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights',
};

const BASE_MARKETING_CONTRACT: Omit<MarketingSourceContract, 'mappingStatus' | 'clientNames'> = {
  table: BASE_TABLES.marketing,
  clientNameField: 'client_name',
  dateField: 'date',
  channelField: 'channel',
  campaignField: 'Channel_Campaign_Name',
  adsetField: 'channel_adset_name',
  impressionsField: 'impressions',
  reachField: 'reach',
  clicksField: 'clicks',
  outboundClicksField: 'outbound_clicks',
  leadsField: 'actions_lead',
  approvedSpendFields: [
    'spend',
    'amount_spent',
    'actual_spend',
    'media_spend',
    'ad_spend',
    'total_spend',
    'cost',
    'cost_micros',
    'spend_micros',
  ],
  spendUnitByField: {
    spend: 'currency',
    amount_spent: 'currency',
    actual_spend: 'currency',
    media_spend: 'currency',
    ad_spend: 'currency',
    total_spend: 'currency',
    cost: 'currency',
    cost_micros: 'micros',
    spend_micros: 'micros',
  },
  approvedBudgetFields: ['budget', 'campaign_budget', 'daily_budget'],
  spendGrainFields: ['date', 'client_name', 'channel', 'Channel_Campaign_Name', 'channel_adset_name'],
  attribution: {
    status: 'UNCONFIGURED',
    notes: 'Cross-source attribution requires an explicitly approved marketing-to-lead key contract.',
  },
};

function marketingContract(
  mappingStatus: MarketingSourceContract['mappingStatus'],
  clientNames: string[],
): MarketingSourceContract {
  return { ...BASE_MARKETING_CONTRACT, mappingStatus, clientNames };
}

function tenantTables(leads: string, includeBlcActivationSource = false) {
  return {
    ...BASE_TABLES,
    leads,
    activations: includeBlcActivationSource ? BASE_TABLES.activations : undefined,
  };
}

const CONTRACT_LEAD_VIEWS = {
  mtn: 'dashboards-422710.lead_ledger.view_lead_ledger_mtn_lead_submit_open',
  mondo: 'dashboards-422710.lead_ledger.view_lead_ledger_mondo_lead_submit_open',
  ontact_blc: 'dashboards-422710.lead_ledger.view_lead_ledger_blc_lead_submit_open',
  vodacom_bizvoip: 'dashboards-422710.lead_ledger.view_lead_ledger_bizvoip_lead_submit_open',
  rewardsco: 'dashboards-422710.lead_ledger.view_lead_ledger_rewardsco_lead_submit_open',
  real_promotions: 'dashboards-422710.lead_ledger.view_lead_ledger_real_promotions_lead_submit_open',
  oneplan: 'dashboards-422710.lead_ledger.view_lead_leadger_oneplan_lead_submit_open',
  affiliate: 'dashboards-422710.lead_ledger.view_lead_ledger_affiliate_lead_submit_open',
} as const;

const TENANTS: Record<string, TenantConfiguration> = {
  default_tenant: {
    id: 'default_tenant',
    name: 'Offernet Master (All Operations)',
    active: true,
    currency: 'ZAR',
    timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710',
    bigQueryDatasets: ['lead_ledger'],
    dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: {
      tables: BASE_TABLES,
      fields: {},
      partners: [
        'blc',
        'mtn',
        'mondo',
        'realpromotions',
        'bizvoip',
        'debtrescue',
        'naga',
        'bmi_loans_african_bank',
        'urbanrewards',
        'dischem',
        'getsavvi',
        'rewardsco',
        'oneplan_pet',
        'oneplan_medical',
        'affiliate',
      ],
    },
    marketing: marketingContract('MASTER', ['*']),
    operationalConfig: DEFAULT_OPERATIONAL_CONFIG,
  },
  mondo: {
    id: 'mondo',
    name: 'Mondo Connect',
    active: true,
    currency: 'ZAR',
    timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710',
    bigQueryDatasets: ['lead_ledger'],
    dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: { tables: tenantTables(CONTRACT_LEAD_VIEWS.mondo), fields: {}, partners: ['mondo'] },
    marketing: marketingContract('MAPPED', ['Mondo', 'Mondo Deals']),
    operationalConfig: { ...DEFAULT_OPERATIONAL_CONFIG, salesDefinition: 'Cellular Postpaid / Sim-Only Handset Sale' },
  },
  mtn: {
    id: 'mtn',
    name: 'MTN South Africa',
    active: true,
    currency: 'ZAR',
    timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710',
    bigQueryDatasets: ['lead_ledger'],
    dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: { tables: tenantTables(CONTRACT_LEAD_VIEWS.mtn), fields: {}, partners: ['mtn'] },
    marketing: marketingContract('MAPPED', ['MTN', 'MTN SA']),
    operationalConfig: { ...DEFAULT_OPERATIONAL_CONFIG, salesDefinition: 'MTN Subscriber Upgrade / New Line Contract' },
  },
  ontact_blc: {
    id: 'ontact_blc',
    name: 'Ontact - BLC',
    active: true,
    currency: 'ZAR',
    timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710',
    bigQueryDatasets: ['lead_ledger'],
    dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: { tables: tenantTables(CONTRACT_LEAD_VIEWS.ontact_blc, true), fields: {}, partners: ['blc'] },
    marketing: marketingContract('MAPPED', ['BLC', 'BLC 1Life']),
    operationalConfig: {
      ...DEFAULT_OPERATIONAL_CONFIG,
      operatingHours: { start: '08:00', end: '17:00', workdays: [1, 2, 3, 4, 5] },
      salesDefinition: 'BLC Financial Service Policy Issued',
    },
  },
  vodacom_bizvoip: {
    id: 'vodacom_bizvoip',
    name: 'Vodacom (BizVoip)',
    active: true,
    currency: 'ZAR',
    timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710',
    bigQueryDatasets: ['lead_ledger'],
    dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: { tables: tenantTables(CONTRACT_LEAD_VIEWS.vodacom_bizvoip), fields: {}, partners: ['bizvoip'] },
    marketing: marketingContract('MAPPED', ['BizVoIP']),
    operationalConfig: {
      ...DEFAULT_OPERATIONAL_CONFIG,
      operatingHours: { start: '08:30', end: '17:00', workdays: [1, 2, 3, 4, 5] },
      salesDefinition: 'Vodacom Fibre & Fixed LTE Agreement',
    },
  },
  real_promotions: {
    id: 'real_promotions',
    name: 'Real Promotions',
    active: true,
    currency: 'ZAR',
    timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710',
    bigQueryDatasets: ['lead_ledger'],
    dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: { tables: tenantTables(CONTRACT_LEAD_VIEWS.real_promotions), fields: {}, partners: ['realpromotions'] },
    marketing: marketingContract('MAPPED', ['Real Promotions']),
    operationalConfig: DEFAULT_OPERATIONAL_CONFIG,
  },
  rewardsco: {
    id: 'rewardsco',
    name: 'RewardsCo',
    active: true,
    currency: 'ZAR',
    timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710',
    bigQueryDatasets: ['lead_ledger'],
    dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: { tables: tenantTables(CONTRACT_LEAD_VIEWS.rewardsco), fields: {}, partners: ['rewardsco'] },
    marketing: marketingContract('MAPPED', ['Rewardsco']),
    operationalConfig: {
      ...DEFAULT_OPERATIONAL_CONFIG,
      operatingHours: { start: '08:00', end: '18:00', workdays: [1, 2, 3, 4, 5, 6] },
    },
  },
  oneplan: {
    id: 'oneplan',
    name: 'One Plan (Pet & Health)',
    active: true,
    currency: 'ZAR',
    timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710',
    bigQueryDatasets: ['lead_ledger'],
    dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: { tables: tenantTables(CONTRACT_LEAD_VIEWS.oneplan), fields: {}, partners: ['oneplan_pet', 'oneplan_medical'] },
    marketing: marketingContract('MAPPED', ['OnePlan']),
    operationalConfig: {
      ...DEFAULT_OPERATIONAL_CONFIG,
      operatingHours: { start: '08:00', end: '17:00', workdays: [1, 2, 3, 4, 5] },
    },
  },
  affiliate: {
    id: 'affiliate',
    name: 'Affiliate Network',
    active: true,
    currency: 'ZAR',
    timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710',
    bigQueryDatasets: ['lead_ledger'],
    dataSourceMode: 'separate',
    capabilities: { marketing: false, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: { tables: tenantTables(CONTRACT_LEAD_VIEWS.affiliate), fields: {}, partners: ['affiliate'] },
    operationalConfig: DEFAULT_OPERATIONAL_CONFIG,
  },

};

export const ROR_PARTNER_TO_VENDOR_MAP: Record<string, string> = {
  BLC: 'Ontact - BLC',
  MTN: 'MTN',
  MONDO: 'Mondo',
  REALPROMOTIONS: 'Real Promotions',
  BIZVOIP: 'Ontact - Vodacom (BizVoip)',
  DEBTRESCUE: 'Debt Rescue',
  NAGA: 'Naga',
  BMI_LOANS_AFRICAN_BANK: 'African Bank',
  AFRICAN_BANK: 'African Bank',
  URBANREWARDS: 'Urban Rewards',
  DISCHEM: 'Dis-Chem',
  GETSAVVI: 'GetSavvi',
  REWARDSCO: 'RewardsCo - Motor Warranty',
  ONEPLAN_PET: 'One Plan - Pet',
  ONEPLAN_MEDICAL: 'One Plan - Health',
  AFFILIATE: 'Affiliate',
};

export function tenantVendorScopeValues(config: TenantConfiguration): string[] {
  const values = new Set<string>();
  for (const partner of config.semanticMappings.partners || []) {
    const raw = partner.trim();
    if (raw) values.add(raw.toLowerCase());
    const mapped = ROR_PARTNER_TO_VENDOR_MAP[raw.toUpperCase()];
    if (mapped) values.add(mapped.toLowerCase());
  }
  return Array.from(values);
}


function configuredMarketingClientNames(tenantId: string): string[] | null {
  const raw = process.env.CX_MARKETING_CLIENT_MAP_JSON;
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('CX_MARKETING_CLIENT_MAP_JSON must be valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CX_MARKETING_CLIENT_MAP_JSON must be an object keyed by tenant ID');
  }
  const value = (parsed as Record<string, unknown>)[tenantId];
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 256)) {
    throw new Error(`CX_MARKETING_CLIENT_MAP_JSON.${tenantId} must be an array of non-empty client_name strings`);
  }
  return Array.from(new Set(value.map(item => item.trim())));
}

function configuredMarketingAttribution(tenantId: string): MarketingAttributionContract | null {
  const raw = process.env.CX_MARKETING_ATTRIBUTION_JSON;
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('CX_MARKETING_ATTRIBUTION_JSON must be valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CX_MARKETING_ATTRIBUTION_JSON must be an object keyed by tenant ID');
  }
  const value = (parsed as Record<string, unknown>)[tenantId];
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`CX_MARKETING_ATTRIBUTION_JSON.${tenantId} must be an object`);
  }
  const entry = value as Record<string, unknown>;
  const marketingSourceField = typeof entry.marketingSourceField === 'string' ? entry.marketingSourceField.trim() : '';
  const leadSourceField = typeof entry.leadSourceField === 'string' ? entry.leadSourceField.trim() : '';
  if (!marketingSourceField || !leadSourceField) {
    throw new Error(`CX_MARKETING_ATTRIBUTION_JSON.${tenantId} requires marketingSourceField and leadSourceField`);
  }
  for (const field of [marketingSourceField, leadSourceField]) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) throw new Error(`Invalid attribution field for ${tenantId}`);
  }
  const marketingCampaignField = typeof entry.marketingCampaignField === 'string' && entry.marketingCampaignField.trim()
    ? entry.marketingCampaignField.trim()
    : undefined;
  const leadCampaignField = typeof entry.leadCampaignField === 'string' && entry.leadCampaignField.trim()
    ? entry.leadCampaignField.trim()
    : undefined;
  if (Boolean(marketingCampaignField) !== Boolean(leadCampaignField)) throw new Error(`CX_MARKETING_ATTRIBUTION_JSON.${tenantId} requires both campaign fields when either is supplied`);
  for (const field of [marketingCampaignField, leadCampaignField].filter(Boolean)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field!)) throw new Error(`Invalid attribution campaign field for ${tenantId}`);
  }
  return {
    status: 'ACTIVE',
    marketingSourceField,
    leadSourceField,
    marketingCampaignField,
    leadCampaignField,
    notes: 'Activated from explicit CX_MARKETING_ATTRIBUTION_JSON deployment configuration.',
  };
}

const TENANT_ALIASES: Record<string, string> = {
  default: 'default_tenant',
  blc: 'ontact_blc',
  bizvoip: 'vodacom_bizvoip',
  realpromotions: 'real_promotions',
};

export function getClientConfig(clientId: string): TenantConfiguration {
  const key = TENANT_ALIASES[clientId] || clientId;
  const tenant = Object.hasOwn(TENANTS, key) ? TENANTS[key] : undefined;
  if (!tenant || !tenant.active) throw new RequestError('Unknown or inactive tenant', 404);

  const configuredNames = configuredMarketingClientNames(tenant.id);
  const configuredAttribution = configuredMarketingAttribution(tenant.id);
  if (!tenant.marketing) return tenant;

  let spendField: string | undefined;
  if (process.env.CX_MARKETING_SPEND_FIELD_JSON) {
    let mapping: unknown;
    try { mapping = JSON.parse(process.env.CX_MARKETING_SPEND_FIELD_JSON); } catch { throw new Error('CX_MARKETING_SPEND_FIELD_JSON must be valid JSON'); }
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new Error('CX_MARKETING_SPEND_FIELD_JSON must be an object keyed by tenant ID');
    const selection = (mapping as Record<string, unknown>)[tenant.id];
    if (selection !== undefined) {
      if (typeof selection !== 'string' || !tenant.marketing.approvedSpendFields.includes(selection)) throw new Error(`CX_MARKETING_SPEND_FIELD_JSON.${tenant.id} must select one already approved observed-spend field`);
      spendField = selection;
    }
  }

  const marketing = {
    ...tenant.marketing,
    ...(spendField ? { approvedSpendFields: [spendField] } : {}),
    ...(tenant.marketing.mappingStatus !== 'MASTER' && configuredNames !== null
      ? {
          mappingStatus: configuredNames.length ? 'MAPPED' as const : 'UNRESOLVED' as const,
          clientNames: configuredNames,
        }
      : {}),
    ...(configuredAttribution ? { attribution: configuredAttribution } : {}),
  };

  return { ...tenant, marketing };
}

export function getAllClients(): TenantConfiguration[] {
  return Object.values(TENANTS).filter(client => client.active);
}

export function validateEnvironment(): void {
  if (process.env.NODE_ENV === 'production' && process.env.USE_MOCK_DATA === 'true') {
    throw new Error('Mock data is forbidden in production');
  }
}

export function tableIdentifier(table: string): string {
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+$/.test(table)) {
    throw new Error('Invalid configured table identifier');
  }
  return `\`${table}\``;
}
