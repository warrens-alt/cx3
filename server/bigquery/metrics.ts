import { MASTER_TAXONOMY, TAXONOMY_BY_ITEM_NO } from './taxonomy';

export const METRIC_DEFINITIONS = {
  // Item 22 - Fetched Leads
  total_leads: {
    itemNo: 22,
    formattedItemNo: "Fetched Leads - 022.0",
    reportValue: "Fetched Leads",
    costMetric: "CPL",
    metric: "Fetched Lead Rate",
    costMetricFormula: "Spend / Fetched Leads",
    waterfallMetricFormula: "(Fetched Leads / Leads) * 100",
    definition: "Fetched lead records ingested into the lead ledger.",
    numerator: "COUNT(DISTINCT lead_id)",
    denominator: "N/A"
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
    definition: "Leads successfully fetched into the staging and ingestion system.",
    numerator: "COUNT(DISTINCT lead_id)",
    denominator: "N/A"
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
    definition: "Leads transformed and formatted into standard schema.",
    numerator: "COUNTIF(valid_lead = true)",
    denominator: "N/A"
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
    definition: "Leads successfully delivered to client or call center.",
    numerator: "COUNTIF(has_delivery = true)",
    denominator: "N/A"
  },
  delivery_rate: {
    itemNo: 33,
    formattedItemNo: "Delivered Leads - 033.0",
    reportValue: "Delivered Leads",
    costMetric: "CPL.Delivered",
    metric: "Lead delivery rate",
    costMetricFormula: "Spend / Delivered Leads",
    waterfallMetricFormula: "(Delivered Leads / Leads) * 100",
    definition: "Delivered Leads / Leads",
    numerator: "COUNTIF(has_delivery = true)",
    denominator: "COUNT(DISTINCT lead_id)"
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
    definition: "Leads passing qualification checks and business rules.",
    numerator: "COUNTIF(valid_lead = true)",
    denominator: "N/A"
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
    definition: "Leads dialed by call center at least once.",
    numerator: "COUNTIF(has_call = true)",
    denominator: "N/A"
  },
  dialed_leads: {
    itemNo: 37,
    formattedItemNo: "Dialed Leads - 037.0",
    reportValue: "Dialed Leads",
    costMetric: "CPL.Dialed",
    metric: "Lead dial rate",
    costMetricFormula: "Spend / Dialed Leads",
    waterfallMetricFormula: "(Dialed Leads / Qualified Leads) * 100",
    definition: "Leads dialed by call center at least once.",
    numerator: "COUNTIF(has_call = true)",
    denominator: "N/A"
  },
  lead_dial_rate: {
    itemNo: 37,
    formattedItemNo: "Dialed Leads - 037.0",
    reportValue: "Dialed Leads",
    costMetric: "CPL.Dialed",
    metric: "Lead dial rate",
    costMetricFormula: "Spend / Dialed Leads",
    waterfallMetricFormula: "(Dialed Leads / Qualified Leads) * 100",
    definition: "Dialed Leads / Qualified Leads",
    numerator: "COUNTIF(has_call = true)",
    denominator: "COUNTIF(has_delivery = true)"
  },
  call_coverage: {
    itemNo: 37,
    formattedItemNo: "Dialed Leads - 037.0",
    reportValue: "Dialed Leads",
    costMetric: "CPL.Dialed",
    metric: "Lead dial rate",
    costMetricFormula: "Spend / Dialed Leads",
    waterfallMetricFormula: "(Dialed Leads / Qualified Leads) * 100",
    definition: "Dialed Leads / Delivered Leads",
    numerator: "COUNTIF(has_call = true)",
    denominator: "COUNTIF(has_delivery = true)"
  },
  total_calls: {
    definition: "Total dials made across all leads",
    numerator: "SUM(IFNULL(total_calls, 0))",
    denominator: "N/A"
  },
  calls_per_called_lead: {
    definition: "Total Calls / Dialed Leads",
    numerator: "SUM(IFNULL(total_calls, 0))",
    denominator: "COUNTIF(has_call = true)"
  },
  one_call_leads: {
    definition: "Leads with exactly 1 call attempt",
    numerator: "COUNTIF(total_calls = 1)",
    denominator: "N/A"
  },
  repeat_call_leads: {
    definition: "Leads with 2 or more call attempts",
    numerator: "COUNTIF(total_calls > 1)",
    denominator: "N/A"
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
    definition: "Leads who answered an inbound or outbound call attempt.",
    numerator: "COUNTIF(has_call = true AND (has_rpc = true OR talk_time_sec > 0))",
    denominator: "N/A"
  },
  answer_rate: {
    itemNo: 38,
    formattedItemNo: "Answered Calls - 038.0",
    reportValue: "Answered Calls",
    costMetric: "CPL.Answered",
    metric: "Answer Rate",
    costMetricFormula: "Spend / Answered Leads",
    waterfallMetricFormula: "(Answered / Qualified Leads) * 100",
    definition: "Answered Calls / Qualified Leads",
    numerator: "COUNTIF(has_call = true AND (has_rpc = true OR talk_time_sec > 0))",
    denominator: "COUNTIF(has_delivery = true)"
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
    definition: "Right Party Contact successfully verified by agent.",
    numerator: "COUNTIF(has_rpc = true)",
    denominator: "N/A"
  },
  rpc_rate: {
    itemNo: 39,
    formattedItemNo: "Right Party Contact - 039.0",
    reportValue: "Right Party Contact",
    costMetric: "CP.RPC",
    metric: "Right party contact rate",
    costMetricFormula: "Spend / RPCs",
    waterfallMetricFormula: "(RPCs / Qualified Leads) * 100",
    definition: "Right Party Contacts / Dialed Leads (or Qualified Leads)",
    numerator: "COUNTIF(has_rpc = true)",
    denominator: "COUNTIF(has_call = true)"
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
    definition: "Completed customer conversion or contract agreements.",
    numerator: "COUNTIF(has_sale = true)",
    denominator: "N/A"
  },
  sale_rate: {
    itemNo: 40,
    formattedItemNo: "Sales - 040.0",
    reportValue: "Sales",
    costMetric: "CP.Sale",
    metric: "Qualified Leads to Sale Rate (Lead-to-Sale)",
    costMetricFormula: "Spend / Sales",
    waterfallMetricFormula: "(Sales / Qualified Leads) * 100",
    definition: "Sales / Qualified Leads",
    numerator: "COUNTIF(has_sale = true)",
    denominator: "COUNTIF(has_call = true)"
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
    definition: "Sales successfully confirmed and delivered to underwriting/operations.",
    numerator: "COUNTIF(has_sale = true AND is_billable = true)",
    denominator: "N/A"
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
    definition: "Sales that fulfilled onboarding, policy initiation, or activation criteria.",
    numerator: "COUNTIF(has_activation = true)",
    denominator: "N/A"
  },
  activation_rate: {
    itemNo: 46,
    formattedItemNo: "Activated Sales - 046.0",
    reportValue: "Activated Sales",
    costMetric: "CPS.Activated",
    metric: "Activation Rate",
    costMetricFormula: "Spend / Activated Sales",
    waterfallMetricFormula: "(Activated Sales / Sales) * 100",
    definition: "Activated Sales / Sales",
    numerator: "COUNTIF(has_activation = true)",
    denominator: "COUNTIF(has_sale = true)"
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
    definition: "Initial payment or fee collection successfully transacted.",
    numerator: "COUNTIF(has_sale = true AND total_revenue > 0)",
    denominator: "N/A"
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
    definition: "Recurring or premium subscription amounts collected.",
    numerator: "SUM(IFNULL(total_revenue, 0))",
    denominator: "N/A"
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
    definition: "Total expected or realized value generated across customer lifespan.",
    numerator: "SUM(IFNULL(total_revenue, 0))",
    denominator: "COUNT(DISTINCT lead_id)"
  },
  revenue: {
    definition: "Total Sales value",
    numerator: "SUM(IFNULL(total_revenue, 0))",
    denominator: "N/A"
  },
  revenue_per_lead: {
    definition: "Total Sales value / Fetched Leads",
    numerator: "SUM(IFNULL(total_revenue, 0))",
    denominator: "COUNT(DISTINCT lead_id)"
  },
  duplicate_leads: {
    itemNo: 29,
    formattedItemNo: "Internal DeDuped Leads - 029.0",
    reportValue: "Internal DeDuped Leads",
    costMetric: "CPL.Deduped",
    metric: "Deduplicatin rate",
    costMetricFormula: "Spend / Internal DeDuped Leads",
    waterfallMetricFormula: "(Deduped Leads / Leads) * 100",
    definition: "Leads identified as duplicates during deduplication stage.",
    numerator: "0",
    denominator: "N/A"
  },
  duplicate_rate: {
    itemNo: 29,
    formattedItemNo: "Internal DeDuped Leads - 029.0",
    reportValue: "Internal DeDuped Leads",
    costMetric: "CPL.Deduped",
    metric: "Deduplicatin rate",
    costMetricFormula: "Spend / Internal DeDuped Leads",
    waterfallMetricFormula: "(Deduped Leads / Leads) * 100",
    definition: "Internal DeDuped Leads / Leads",
    numerator: "0",
    denominator: "COUNT(DISTINCT lead_id)"
  }
};
