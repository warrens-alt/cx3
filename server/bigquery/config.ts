import { RequestError } from './filters';
export interface ClientOperationalConfig {
  operatingHours: { start: string; end: string; workdays: number[] };
  grading: string[];
  salesDefinition: string;
  activationDefinition: string;
  currency: string;
  revenueRules: {
    leadCost: number;
    callMinuteCost: number;
    baseCommissionPerSale: number;
    revenuePerActivation: number;
    fixedOverhead: number;
  };
  dispositionMapping: Record<string, string>;
  funnelStages: string[];
}

export interface TenantConfiguration {
  id: string; name: string; active: boolean; currency: string; timezone: string;
  bigQueryProject: string; bigQueryDatasets: string[];
  dataSourceMode: 'separate' | 'shared'; sharedTenantIdField?: string; sharedTenantIdValue?: string;
  capabilities: { marketing: boolean; leads: boolean; calls: boolean; sales: boolean; activation: boolean; revenue: boolean; };
  semanticMappings: { tables: { leads: string; marketing?: string; calls?: string; timeToDial?: string; activations?: string; cliPerformance?: string; }; fields: Record<string, string>; partners?: string[]; };
  branding?: { logoUrl?: string; accentColor?: string; };
  operationalConfig?: ClientOperationalConfig;
}

const DEFAULT_OPERATIONAL_CONFIG: ClientOperationalConfig = {
  operatingHours: { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] },
  grading: ['Gold', 'Silver', 'Bronze', 'Standard'],
  salesDefinition: 'Contract Verified & QA Passed',
  activationDefinition: 'First Monthly Debit / SIM Active',
  currency: 'ZAR',
  revenueRules: {
    leadCost: 45,
    callMinuteCost: 1.25,
    baseCommissionPerSale: 350,
    revenuePerActivation: 850,
    fixedOverhead: 15000
  },
  dispositionMapping: {
    'SALE': 'Sale',
    'A': 'Answering Machine',
    'B': 'Busy',
    'CALLBK': 'Callback',
    'DAIR': 'Dead Air',
    'DC': 'Disconnected',
    'DNC': 'Do Not Call',
    'NA': 'No Answer',
    'NI': 'Not Interested',
    'N': 'No Answer',
    'RPC': 'Right Party Contact'
  },
  funnelStages: [
    'Captured', 'Fetched', 'Delivered', 'Dialled', 'Contacted', 'Qualified', 'Sale', 'Activated', 'Revenue'
  ]
};

const BASE_TABLES = {
  leads: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
  marketing: 'dashboards-422710.lead_ledger.lead_ledger_platform_insights',
  calls: 'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights',
  timeToDial: 'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights_time_to_dial',
  activations: 'dashboards-422710.lead_ledger.tbl_blc_activations',
  cliPerformance: 'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights',
};

const TENANTS: Record<string, TenantConfiguration> = {
  default_tenant: {
    id: 'default_tenant', name: 'Offernet Master (All Operations)', active: true, currency: 'ZAR', timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710', bigQueryDatasets: ['lead_ledger'], dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: {
      tables: BASE_TABLES, fields: {},
      partners: ['blc', 'mtn', 'mondo', 'realpromotions', 'bizvoip', 'debtrescue', 'naga', 'bmi_loans_african_bank', 'urbanrewards', 'dischem', 'getsavvi', 'rewardsco', 'oneplan_pet', 'oneplan_medical', 'affiliate'],
    },
    operationalConfig: DEFAULT_OPERATIONAL_CONFIG
  },
  mondo: {
    id: 'mondo', name: 'Mondo Connect', active: true, currency: 'ZAR', timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710', bigQueryDatasets: ['lead_ledger'], dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: {
      tables: BASE_TABLES, fields: {},
      partners: ['mondo'],
    },
    operationalConfig: {
      ...DEFAULT_OPERATIONAL_CONFIG,
      salesDefinition: 'Cellular Postpaid / Sim-Only Handset Sale',
      revenueRules: { leadCost: 52, callMinuteCost: 1.30, baseCommissionPerSale: 420, revenuePerActivation: 900, fixedOverhead: 20000 }
    }
  },
  mtn: {
    id: 'mtn', name: 'MTN South Africa', active: true, currency: 'ZAR', timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710', bigQueryDatasets: ['lead_ledger'], dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: {
      tables: BASE_TABLES, fields: {},
      partners: ['mtn'],
    },
    operationalConfig: {
      ...DEFAULT_OPERATIONAL_CONFIG,
      salesDefinition: 'MTN Subscriber Upgrade / New Line Contract',
      revenueRules: { leadCost: 48, callMinuteCost: 1.25, baseCommissionPerSale: 380, revenuePerActivation: 850, fixedOverhead: 25000 }
    }
  },
  ontact_blc: {
    id: 'ontact_blc', name: 'Ontact - BLC', active: true, currency: 'ZAR', timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710', bigQueryDatasets: ['lead_ledger'], dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: {
      tables: BASE_TABLES, fields: {},
      partners: ['blc'],
    },
    operationalConfig: {
      ...DEFAULT_OPERATIONAL_CONFIG,
      salesDefinition: 'BLC Financial Service Policy Issued',
      revenueRules: { leadCost: 42, callMinuteCost: 1.20, baseCommissionPerSale: 310, revenuePerActivation: 750, fixedOverhead: 12000 }
    }
  },
  vodacom_bizvoip: {
    id: 'vodacom_bizvoip', name: 'Vodacom (BizVoip)', active: true, currency: 'ZAR', timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710', bigQueryDatasets: ['lead_ledger'], dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: {
      tables: BASE_TABLES, fields: {},
      partners: ['bizvoip'],
    },
    operationalConfig: {
      ...DEFAULT_OPERATIONAL_CONFIG,
      salesDefinition: 'Vodacom Fibre & Fixed LTE Agreement',
      revenueRules: { leadCost: 55, callMinuteCost: 1.35, baseCommissionPerSale: 450, revenuePerActivation: 950, fixedOverhead: 18000 }
    }
  },
  real_promotions: {
    id: 'real_promotions', name: 'Real Promotions', active: true, currency: 'ZAR', timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710', bigQueryDatasets: ['lead_ledger'], dataSourceMode: 'separate',
    capabilities: { marketing: false, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: {
      tables: BASE_TABLES, fields: {},
      partners: ['realpromotions'],
    },
    operationalConfig: DEFAULT_OPERATIONAL_CONFIG
  },
  rewardsco: {
    id: 'rewardsco', name: 'RewardsCo', active: true, currency: 'ZAR', timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710', bigQueryDatasets: ['lead_ledger'], dataSourceMode: 'separate',
    capabilities: { marketing: false, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: {
      tables: BASE_TABLES, fields: {},
      partners: ['rewardsco'],
    },
    operationalConfig: DEFAULT_OPERATIONAL_CONFIG
  },
  oneplan: {
    id: 'oneplan', name: 'One Plan (Pet & Health)', active: true, currency: 'ZAR', timezone: 'Africa/Johannesburg',
    bigQueryProject: 'dashboards-422710', bigQueryDatasets: ['lead_ledger'], dataSourceMode: 'separate',
    capabilities: { marketing: true, leads: true, calls: true, sales: true, activation: true, revenue: true },
    semanticMappings: {
      tables: BASE_TABLES, fields: {},
      partners: ['oneplan_pet', 'oneplan_medical'],
    },
    operationalConfig: DEFAULT_OPERATIONAL_CONFIG
  }
};
export const ROR_PARTNER_TO_VENDOR_MAP: Record<string, string> = {
  BLC: 'Ontact - BLC', MTN: 'MTN', MONDO: 'Mondo', REALPROMOTIONS: 'Real Promotions', BIZVOIP: 'Ontact - Vodacom (BizVoip)',
  DEBTRESCUE: 'Debt Rescue', NAGA: 'Naga', BMI_LOANS_AFRICAN_BANK: 'African Bank', AFRICAN_BANK: 'African Bank',
  URBANREWARDS: 'Urban Rewards', DISCHEM: 'Dis-Chem', GETSAVVI: 'GetSavvi', REWARDSCO: 'RewardsCo - Motor Warranty',
  ONEPLAN_PET: 'One Plan - Pet', ONEPLAN_MEDICAL: 'One Plan - Health', AFFILIATE: 'Affiliate',
};
export function getClientConfig(clientId: string): TenantConfiguration {
  const key = clientId === 'default' ? 'default_tenant' : clientId;
  const tenant = Object.hasOwn(TENANTS, key) ? TENANTS[key] : undefined;
  if (!tenant || !tenant.active) throw new RequestError('Unknown or inactive tenant', 404);
  return tenant;
}
export function getAllClients(): TenantConfiguration[] { return Object.values(TENANTS).filter(c => c.active); }
export function validateEnvironment(): void {
  if (process.env.NODE_ENV === 'production' && process.env.USE_MOCK_DATA === 'true') throw new Error('Mock data is forbidden in production');
}
export function tableIdentifier(table: string): string {
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+$/.test(table)) throw new Error('Invalid configured table identifier');
  return `\`${table}\``;
}
