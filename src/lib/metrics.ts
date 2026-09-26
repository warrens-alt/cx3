import { MASTER_TAXONOMY, TAXONOMY_BY_ITEM_NO, getTaxonomyItem, MetricTaxonomyItem } from './taxonomy';

export { MASTER_TAXONOMY, TAXONOMY_BY_ITEM_NO, getTaxonomyItem };
export type { MetricTaxonomyItem };

export interface MetricDefinition {
  itemNo?: number;
  formattedItemNo?: string;
  reportValue?: string;
  costMetric?: string;
  metric?: string;
  costMetricFormula?: string;
  waterfallMetricFormula?: string;
  revenueMetric?: string;
  costOfRevenueMetric?: string;
  costOfRevenueMetricFormula?: string;
  channel?: string;
  definition: string;
  numerator: string;
  denominator: string;
  source?: string;
  canonicalName?: string;
}

export const METRICS: Record<string, MetricDefinition> = {
  // Item 22 - Fetched Leads
  total_leads: {
    itemNo: 22,
    formattedItemNo: "Fetched Leads - 022.0",
    reportValue: "Fetched Leads",
    costMetric: "CPL",
    metric: "Fetched Lead Rate",
    costMetricFormula: "Spend / Fetched Leads",
    waterfallMetricFormula: "(Fetched Leads / Leads) * 100",
    canonicalName: "Fetched Leads",
    definition: "Fetched lead records ingested into the lead ledger.",
    numerator: "COUNT(DISTINCT lead_id)",
    denominator: "N/A",
    source: "vw_leads"
  },
  // Item 22 - Fetched Leads
  fetched_leads: {
    itemNo: 22,
    formattedItemNo: "Fetched Leads - 022.0",
    reportValue: "Fetched Leads",
    costMetric: "CPL.Fetched",
    metric: "Fetched Lead Rate",
    costMetricFormula: "Spend / Fetched Leads",
    waterfallMetricFormula: "(Fetched Leads / Leads) * 100",
    canonicalName: "Fetched Leads",
    definition: "Leads fetched into staging pipeline.",
    numerator: "COUNT(DISTINCT lead_id)",
    denominator: "N/A",
    source: "vw_lead_lifecycle"
  },
  // Item 23 - Standardised Leads
  standardised_leads: {
    itemNo: 23,
    formattedItemNo: "Standardised Leads - 023.0",
    reportValue: "Standardised Leads",
    costMetric: "CPL.Standardised",
    metric: "Standardised Lead Rate",
    costMetricFormula: "Spend / Standardised Leads",
    waterfallMetricFormula: "(Standardised Leads / Leads) * 100",
    canonicalName: "Standardised Leads",
    definition: "Leads successfully validated against formatting standards.",
    numerator: "COUNTIF(valid_lead = true)",
    denominator: "N/A",
    source: "vw_lead_lifecycle"
  },
  // Item 33 - Delivered Leads
  delivered_leads: {
    itemNo: 33,
    formattedItemNo: "Delivered Leads - 033.0",
    reportValue: "Delivered Leads",
    costMetric: "CPL.Delivered",
    metric: "Lead delivery rate",
    costMetricFormula: "Spend / Delivered Leads",
    waterfallMetricFormula: "(Delivered Leads / Leads) * 100",
    canonicalName: "Delivered Leads",
    definition: "Leads successfully delivered to vendor or client call center.",
    numerator: "COUNTIF(has_delivery = true)",
    denominator: "N/A",
    source: "vw_lead_vendor_transactions"
  },
  delivery_rate: {
    itemNo: 33,
    formattedItemNo: "Delivered Leads - 033.0",
    reportValue: "Delivered Leads",
    costMetric: "CPL.Delivered",
    metric: "Lead delivery rate",
    costMetricFormula: "Spend / Delivered Leads",
    waterfallMetricFormula: "(Delivered Leads / Leads) * 100",
    canonicalName: "Lead delivery rate",
    definition: "Percentage of leads delivered to client: (Delivered Leads / Leads) * 100",
    numerator: "COUNTIF(has_delivery = true)",
    denominator: "COUNT(DISTINCT lead_id)",
    source: "vw_lead_lifecycle"
  },
  // Item 36 - Qualified Leads
  qualified_leads: {
    itemNo: 36,
    formattedItemNo: "Qualified Leads - 036.0",
    reportValue: "Qualified Leads",
    costMetric: "CPL.Qualified",
    metric: "Qualified lead rate",
    costMetricFormula: "Spend / Qualified Leads",
    waterfallMetricFormula: "(Qualified Leads / Leads) * 100",
    canonicalName: "Qualified Leads",
    definition: "Leads meeting business rules and qualification criteria.",
    numerator: "COUNTIF(valid_lead = true)",
    denominator: "N/A",
    source: "vw_lead_lifecycle"
  },
  // Item 37 - Dialed Leads
  called_leads: {
    itemNo: 37,
    formattedItemNo: "Dialed Leads - 037.0",
    reportValue: "Dialed Leads",
    costMetric: "CPL.Dialed",
    metric: "Lead dial rate",
    costMetricFormula: "Spend / Dialed Leads",
    waterfallMetricFormula: "(Dialed Leads / Qualified Leads) * 100",
    canonicalName: "Dialed Leads",
    definition: "Leads dialed by call center at least once.",
    numerator: "COUNTIF(has_call = true)",
    denominator: "N/A",
    source: "vw_call_performance"
  },
  dialed_leads: {
    itemNo: 37,
    formattedItemNo: "Dialed Leads - 037.0",
    reportValue: "Dialed Leads",
    costMetric: "CPL.Dialed",
    metric: "Lead dial rate",
    costMetricFormula: "Spend / Dialed Leads",
    waterfallMetricFormula: "(Dialed Leads / Qualified Leads) * 100",
    canonicalName: "Dialed Leads",
    definition: "Leads dialed by call center at least once.",
    numerator: "COUNTIF(has_call = true)",
    denominator: "N/A",
    source: "vw_call_performance"
  },
  call_coverage: {
    itemNo: 37,
    formattedItemNo: "Dialed Leads - 037.0",
    reportValue: "Dialed Leads",
    costMetric: "CPL.Dialed",
    metric: "Lead dial rate",
    costMetricFormula: "Spend / Dialed Leads",
    waterfallMetricFormula: "(Dialed Leads / Qualified Leads) * 100",
    canonicalName: "Lead dial rate",
    definition: "Dialed Leads / Qualified Leads (or Delivered Leads)",
    numerator: "COUNTIF(has_call = true)",
    denominator: "COUNTIF(has_delivery = true)",
    source: "vw_call_performance"
  },
  // Item 38 - Answered Calls
  answered_calls: {
    itemNo: 38,
    formattedItemNo: "Answered Calls - 038.0",
    reportValue: "Answered Calls",
    costMetric: "CPL.Answered",
    metric: "Answer Rate",
    costMetricFormula: "Spend / Answered Leads",
    waterfallMetricFormula: "(Answered / Qualified Leads) * 100",
    canonicalName: "Answered Calls",
    definition: "Calls answered by consumer with active talk time.",
    numerator: "COUNTIF(has_call = true AND (has_rpc = true OR talk_time_sec > 0))",
    denominator: "N/A",
    source: "vw_call_performance"
  },
  answer_rate: {
    itemNo: 38,
    formattedItemNo: "Answered Calls - 038.0",
    reportValue: "Answered Calls",
    costMetric: "CPL.Answered",
    metric: "Answer Rate",
    costMetricFormula: "Spend / Answered Leads",
    waterfallMetricFormula: "(Answered / Qualified Leads) * 100",
    canonicalName: "Answer Rate",
    definition: "Answered Calls / Qualified Leads",
    numerator: "COUNTIF(has_call = true AND (has_rpc = true OR talk_time_sec > 0))",
    denominator: "COUNTIF(has_call = true)",
    source: "vw_call_performance"
  },
  // Item 39 - Right Party Contact
  rpcs: {
    itemNo: 39,
    formattedItemNo: "Right Party Contact - 039.0",
    reportValue: "Right Party Contact",
    costMetric: "CP.RPC",
    metric: "Right party contact rate",
    costMetricFormula: "Spend / RPCs",
    waterfallMetricFormula: "(RPCs / Qualified Leads) * 100",
    canonicalName: "Right Party Contact",
    definition: "Verified contact with the designated consumer.",
    numerator: "COUNTIF(has_rpc = true)",
    denominator: "N/A",
    source: "vw_call_performance"
  },
  rpc_rate: {
    itemNo: 39,
    formattedItemNo: "Right Party Contact - 039.0",
    reportValue: "Right Party Contact",
    costMetric: "CP.RPC",
    metric: "Right party contact rate",
    costMetricFormula: "Spend / RPCs",
    waterfallMetricFormula: "(RPCs / Qualified Leads) * 100",
    canonicalName: "Right party contact rate",
    definition: "RPCs / Dialed Leads (or Qualified Leads)",
    numerator: "COUNTIF(has_rpc = true)",
    denominator: "COUNTIF(has_call = true)",
    source: "vw_call_performance"
  },
  // Item 40 - Sales
  sales: {
    itemNo: 40,
    formattedItemNo: "Sales - 040.0",
    reportValue: "Sales",
    costMetric: "CP.Sale",
    metric: "Qualified Leads to Sale Rate (Lead-to-Sale)",
    costMetricFormula: "Spend / Sales",
    waterfallMetricFormula: "(Sales / Qualified Leads) * 100",
    revenueMetric: "Total Sales value",
    costOfRevenueMetric: "Potential return on sales",
    costOfRevenueMetricFormula: "Total Sales value / Total spend",
    canonicalName: "Sales",
    definition: "Qualified leads converted into completed sales.",
    numerator: "COUNTIF(has_sale = true)",
    denominator: "N/A",
    source: "vw_commercial_events"
  },
  sale_rate: {
    itemNo: 40,
    formattedItemNo: "Sales - 040.0",
    reportValue: "Sales",
    costMetric: "CP.Sale",
    metric: "Qualified Leads to Sale Rate (Lead-to-Sale)",
    costMetricFormula: "Spend / Sales",
    waterfallMetricFormula: "(Sales / Qualified Leads) * 100",
    canonicalName: "Qualified Leads to Sale Rate (Lead-to-Sale)",
    definition: "Sales / Qualified Leads",
    numerator: "COUNTIF(has_sale = true)",
    denominator: "COUNTIF(has_call = true)",
    source: "vw_commercial_events"
  },
  // Item 45 - Delivered Sales
  delivered_sales: {
    itemNo: 45,
    formattedItemNo: "Delivered Sales - 045.0",
    reportValue: "Delivered Sales",
    costMetric: "CPS.Delivered",
    metric: "Delivery Rate",
    costMetricFormula: "Spend / Delivered Sales",
    waterfallMetricFormula: "(Delivered Sales / Sales) * 100",
    canonicalName: "Delivered Sales",
    definition: "Sales confirmed and delivered to underwriting/client CRM.",
    numerator: "COUNTIF(has_sale = true AND is_billable = true)",
    denominator: "N/A",
    source: "vw_commercial_events"
  },
  // Item 46 - Activated Sales
  activations: {
    itemNo: 46,
    formattedItemNo: "Activated Sales - 046.0",
    reportValue: "Activated Sales",
    costMetric: "CPS.Activated",
    metric: "Activation Rate",
    costMetricFormula: "Spend / Activated Sales",
    waterfallMetricFormula: "(Activated Sales / Sales) * 100",
    canonicalName: "Activated Sales",
    definition: "Sales activated and recognized commercially.",
    numerator: "COUNTIF(has_activation = true)",
    denominator: "N/A",
    source: "vw_commercial_events"
  },
  activation_rate: {
    itemNo: 46,
    formattedItemNo: "Activated Sales - 046.0",
    reportValue: "Activated Sales",
    costMetric: "CPS.Activated",
    metric: "Activation Rate",
    costMetricFormula: "Spend / Activated Sales",
    waterfallMetricFormula: "(Activated Sales / Sales) * 100",
    canonicalName: "Activation Rate",
    definition: "Activated Sales / Sales",
    numerator: "COUNTIF(has_activation = true)",
    denominator: "COUNTIF(has_sale = true)",
    source: "vw_commercial_events"
  },
  // Item 47 - Sales payment collected
  sales_payment_collected: {
    itemNo: 47,
    formattedItemNo: "Sales payment collected - 047.0",
    reportValue: "Sales payment collected",
    costMetric: "CPS.Collection",
    metric: "Sales Collection Rate",
    costMetricFormula: "Spend / Sales Payment Collections",
    waterfallMetricFormula: "(Sales Payment Collections / Sales) * 100",
    canonicalName: "Sales payment collected",
    definition: "Sales with first debit or payment verified.",
    numerator: "COUNTIF(has_sale = true AND total_revenue > 0)",
    denominator: "N/A",
    source: "vw_commercial_events"
  },
  // Item 48 - Premium Collections
  premium_collections: {
    itemNo: 48,
    formattedItemNo: "Premium Collections - 048.0",
    reportValue: "Premium Collections",
    costMetric: "CPP.Collection",
    metric: "Premium Collection rate",
    costMetricFormula: "Spend / Premium Collections",
    waterfallMetricFormula: "(Premium Collections / Sales) * 100",
    canonicalName: "Premium Collections",
    definition: "Recurring premium payments transacted.",
    numerator: "SUM(IFNULL(total_revenue, 0))",
    denominator: "N/A",
    source: "vw_commercial_events"
  },
  // Item 49 - Lifetime Value
  lifetime_value: {
    itemNo: 49,
    formattedItemNo: "Lifetime Value - 049.0",
    reportValue: "Lifetime Value",
    costMetric: "CLTV",
    metric: "Return On Customer Life Time Value",
    costMetricFormula: "Total Revenue collected / Customer Total Acquisition Cost",
    waterfallMetricFormula: "Customer Life Time Revenue / Customer Total Acquisition Cost",
    revenueMetric: "ROAS",
    costOfRevenueMetricFormula: "Customer Life Time Revenue / Customer Total Acquisition Cost",
    canonicalName: "Lifetime Value",
    definition: "Lifetime customer revenue relative to acquisition cost.",
    numerator: "SUM(IFNULL(total_revenue, 0))",
    denominator: "COUNT(DISTINCT lead_id)",
    source: "vw_commercial_events"
  },
  revenue: {
    definition: "Total Sales value",
    numerator: "SUM(IFNULL(total_revenue, 0))",
    denominator: "N/A",
    canonicalName: "Total Sales value",
    source: "vw_commercial_events"
  },
  duplicate_rate: {
    itemNo: 29,
    formattedItemNo: "Internal DeDuped Leads - 029.0",
    reportValue: "Internal DeDuped Leads",
    costMetric: "CPL.Deduped",
    metric: "Deduplicatin rate",
    costMetricFormula: "Spend / Internal DeDuped Leads",
    waterfallMetricFormula: "(Deduped Leads / Leads) * 100",
    canonicalName: "Deduplicatin rate",
    definition: "Percentage of duplicate leads: (Deduped Leads / Leads) * 100",
    numerator: "0",
    denominator: "COUNT(DISTINCT lead_id)",
    source: "vw_lead_lifecycle"
  }
};
