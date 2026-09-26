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
  clicksField: string;
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
  clicksField: 'clicks',
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
    semanticMappings: { tables: BASE_TABLES, fields: {}, partners: ['mondo'] },
    marketing: marketingContract('UNRESOLVED', []),
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
    semanticMappings: { tables: BASE_TABLES, fields: {}, partners: ['mtn'] },
    marketing: marketingContract('UNRESOLVED', []),
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
    semanticMappings: { tables: BASE_TABLES, fields: {}, partners: ['blc'] },
    marketing: marketingContract('UNRESOLVED', []),
    operationalConfig: { ...DEFAULT_OPERATIONAL_CONFIG, salesDefinition: 'BLC Financial Service Policy Issued' },
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
    semanticMappings: { tables: BASE_TABLES, fields: {}, partners: ['bizvoip'] },
    marketing: marketingContract('UNRESOLVED', []),
    operationalConfig: { ...DEFAULT_OPERATIONAL_CONFIG, salesDefinition: 'Vodacom Fibre & Fixed LTE Agreement' },
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
    capabilities: { marketing: false, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: { tables: BASE_TABLES, fields: {}, partners: ['realpromotions'] },
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
    capabilities: { marketing: false, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: { tables: BASE_TABLES, fields: {}, partners: ['rewardsco'] },
    operationalConfig: DEFAULT_OPERATIONAL_CONFIG,
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
    semanticMappings: { tables: BASE_TABLES, fields: {}, partners: ['oneplan_pet', 'oneplan_medical'] },
    marketing: marketingContract('UNRESOLVED', []),
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

export function getClientConfig(clientId: string): TenantConfiguration {
  const key = clientId === 'default' ? 'default_tenant' : clientId;
  const tenant = Object.hasOwn(TENANTS, key) ? TENANTS[key] : undefined;
  if (!tenant || !tenant.active) throw new RequestError('Unknown or inactive tenant', 404);

  const configuredNames = configuredMarketingClientNames(tenant.id);
  if (!tenant.marketing || tenant.marketing.mappingStatus === 'MASTER' || configuredNames === null) {
    return tenant;
  }

  return {
    ...tenant,
    marketing: {
      ...tenant.marketing,
      mappingStatus: configuredNames.length ? 'MAPPED' : 'UNRESOLVED',
      clientNames: configuredNames,
    },
  };
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
