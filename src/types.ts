export interface ClientDataSource {
  clientId: string;
  clientName: string;
  projectId: string;
  datasetId: string;
  leadLedgerTable: string;
  platformInsightsTable: string;
  timezone: string;
  currency: string;
  active: boolean;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface FilterState {
  clientId: string;
  dateRange: DateRange;
  comparisonRange: DateRange;
  channel?: string[];
  source?: string[];
  campaign?: string[];
  vendor?: string[];
  grade?: string[];
  vettingOutcome?: string[];
  disposition?: string[];
}

// Canonical Lead Lifecycle Record
export interface LeadRecord {
  client_id: string;
  lead_id: string;
  transaction_id: string;
  
  capture_timestamp: string;
  capture_date: string;
  
  source: string;
  medium: string;
  channel: string;
  campaign: string;
  
  valid_lead: boolean;
  grade: string;
  vetting_outcome: string;
  
  vendor: string;
  
  attempted_delivery_timestamp: string | null;
  delivery_timestamp: string | null;
  expected_first_dial_timestamp: string | null;
  
  first_call_timestamp: string | null;
  last_call_timestamp: string | null;
  
  latest_disposition: string;
  
  total_calls: number;
  total_call_duration: number;
  rpc: boolean;
  
  sale: boolean;
  sale_timestamp: string | null;
  
  activation: boolean;
  activation_timestamp: string | null;
  
  revenue: number;
  currency: string;
  
  duplicate_flag: boolean;
}

export interface KPIStats {
  leads: number;
  delivered: number;
  called: number;
  rpcs: number;
  sales: number;
  activations: number;
  revenue: number;
  mediaCost: number;
  duplicates: number;
  
  // Computed (will be calculated in UI or backend)
  deliveryRate?: number;
  callCoverage?: number;
  saleRate?: number;
  activationRate?: number;
  duplicateRate?: number;
  cpl?: number;
  costPerSale?: number;
  roas?: number;
  revenuePerLead?: number;
}
