/**
 * OFFICIAL TOUCHPOINT METRIC TAXONOMY & NAMING CONVENTIONS
 * Authoritative single source of truth for all metric terminology, report values,
 * cost metrics, formulas, waterfall calculations, and relative calculations.
 * 
 * Sourced primarily from "Waterfall " (primary naming authority),
 * with relative formulas from "Relative.", cross-referenced with "Main", "Relative",
 * and supported by "Tag managment".
 */

export const TAXONOMY_VERSION = 'cx.taxonomy.1.1.0';

export interface MetricTaxonomyItem {
  itemNo: number;
  reportValue: string;
  formattedItemNo: string;
  goal?: string;
  objective?: string;
  okr?: string;
  costMetric: string;
  metric: string;
  costMetricFormula: string;
  waterfallMetricFormula: string;
  relativeMetricFormula?: string;
  revenueMetric?: string;
  costOfRevenueMetric?: string;
  costOfRevenueMetricFormula?: string;
  channel?: string;
  context?: 'waterfall' | 'relative';
}

export const MASTER_TAXONOMY: MetricTaxonomyItem[] = [
  {
    itemNo: 2,
    formattedItemNo: "Impressions - 02.0",
    reportValue: "Impressions",
    goal: "WEB Online",
    objective: "Awareness",
    okr: "Serve your ad as many times as possible",
    costMetric: "CPM",
    metric: "Cost per mille",
    costMetricFormula: "(Total Spend / Total Impressions) * 1000",
    waterfallMetricFormula: "N/A",
    relativeMetricFormula: "N/A",
    channel: "Facebook, Instagram, GDN, YouTube, PMax, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 3,
    formattedItemNo: "Reach - 03.0",
    reportValue: "Reach",
    goal: "WEB Online",
    objective: "Awareness",
    okr: "Reach as many unique people as possible",
    costMetric: "CPM.R",
    metric: "Frequency",
    costMetricFormula: "(Total Spend / Reach) * 1000",
    waterfallMetricFormula: "Impressions / Reach",
    relativeMetricFormula: "Impressions / Reach",
    channel: "Facebook, Instagram, GDN, YouTube, PMax, TikTok, Whatsapp",
    context: "waterfall"
  },
  {
    itemNo: 4,
    formattedItemNo: "Ad Recall - 04.0",
    reportValue: "Ad Recall",
    goal: "WEB Online",
    objective: "Awareness",
    okr: "Get as many people to remember your ad.",
    costMetric: "CP.Recall",
    metric: "Ad recall rate",
    costMetricFormula: "Total Spend / Total Ad Recallers",
    waterfallMetricFormula: "(Ad Recallers / Total Reach) * 100",
    relativeMetricFormula: "(Ad Recallers / Total Reach) * 100",
    channel: "Facebook, Instagram, GDN, YouTube, PMax",
    context: "waterfall"
  },
  {
    itemNo: 5,
    formattedItemNo: "Engagement - 05.0",
    reportValue: "Engagement",
    goal: "WEB Online",
    objective: "Consideration",
    okr: "Get as many engagements as possible",
    costMetric: "CPE",
    metric: "Engagement Rate",
    costMetricFormula: "Total Spend / Engagements",
    waterfallMetricFormula: "(Engagements / Reach) * 100",
    relativeMetricFormula: "(Engagements / Reach) * 100",
    channel: "Facebook, Instagram, GDN, YouTube, PMax, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 6,
    formattedItemNo: 'Video Views (5""+ Play) (20% Viewable) - 06.0',
    reportValue: 'Video Views (5""+ Play) (20% Viewable)',
    goal: "WEB Online",
    objective: "Consideration",
    okr: "Get as many video views as possible",
    costMetric: "CP.View",
    metric: "Video view rate",
    costMetricFormula: "Spend / Video Views",
    waterfallMetricFormula: "(Video Views / Reach) * 100",
    relativeMetricFormula: "(Video Views / Impressions) * 100",
    channel: "Facebook, Instagram, YouTube, TikTok, Google Ads",
    context: "waterfall"
  },
  {
    itemNo: 7,
    formattedItemNo: "Page Like - 07.0",
    reportValue: "Page Like",
    goal: "WEB Online",
    objective: "Consideration",
    okr: "Get as many page likes as possible",
    costMetric: "CP.PageLike",
    metric: "Page like rate",
    costMetricFormula: "Total Spend / Page Likes",
    waterfallMetricFormula: "(Page Likes / Reach) * 100",
    relativeMetricFormula: "(Page Likes / Reach) * 100",
    channel: "Facebook",
    context: "waterfall"
  },
  {
    itemNo: 8,
    formattedItemNo: "Clicks - 08.0",
    reportValue: "Clicks",
    goal: "WEB Online",
    objective: "Consideration",
    okr: "Get as many clicks as possible",
    costMetric: "CPC",
    metric: "Click through rate (CTR)",
    costMetricFormula: "Spend / All Clicks",
    waterfallMetricFormula: "(All Clicks / Reach) * 100",
    relativeMetricFormula: "(All Clicks / Impressions) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 9,
    formattedItemNo: "Outbound Clicks - 09.0",
    reportValue: "Outbound Clicks",
    goal: "WEB Online",
    objective: "Consideration",
    okr: "Get as many outbound clicks as possible",
    costMetric: "CP.OC",
    metric: "Outbound click through rate",
    costMetricFormula: "Spend / Outbound Clicks",
    waterfallMetricFormula: "(Outbound Clicks / Reach) * 100",
    relativeMetricFormula: "(Outbound Clicks / All Clicks) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 10,
    formattedItemNo: "Conversation - 010.0",
    reportValue: "Conversation",
    goal: "BOT",
    objective: "Consideration",
    okr: "Get as many conversations started as possible",
    costMetric: "CP.Convo",
    metric: "Conversation Started rate",
    costMetricFormula: "Spend / Conversations Started",
    waterfallMetricFormula: "(Conversations Started / Reach) * 100",
    relativeMetricFormula: "(Conversations Started / Outbound Clicks) * 100",
    channel: "Facebook, Instagram, Whatsapp",
    context: "waterfall"
  },
  {
    itemNo: 11,
    formattedItemNo: "Landing Page Views - 011.0",
    reportValue: "Landing Page Views",
    goal: "WEB Online",
    objective: "Consideration",
    okr: "Get as many landing page views as possible",
    costMetric: "CP.LPV",
    metric: "Landing page view rate",
    costMetricFormula: "Spend / Landing Page Views",
    waterfallMetricFormula: "(Landing Page Views / Reach) * 100",
    relativeMetricFormula: "(Landing Page Views / Outbound Clicks) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 12,
    formattedItemNo: "App Purchases - 012.0",
    reportValue: "App Purchases",
    goal: "APP Journey",
    objective: "Consideration",
    okr: "Get as many app purchases as possible",
    costMetric: "CP.AP",
    metric: "App Purchase Rate",
    costMetricFormula: "Spend / App Purchases",
    waterfallMetricFormula: "(App Purchases / Outbound Clicks) * 100",
    relativeMetricFormula: "(App Purchases / App Installs) * 100",
    revenueMetric: "App Purchase Value",
    costOfRevenueMetric: "ROAS",
    costOfRevenueMetricFormula: "Total App Purchase Value / Total Spend",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 13,
    formattedItemNo: "App Download - 013.0",
    reportValue: "App Download",
    goal: "APP Journey",
    objective: "Consideration",
    okr: "Get as many app downloads as possible",
    costMetric: "CP.AD",
    metric: "App Download Rate",
    costMetricFormula: "Spend / App Download",
    waterfallMetricFormula: "(App downloads / Outbound Clicks) * 100",
    relativeMetricFormula: "(App downloads / Outbound Clicks) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 14,
    formattedItemNo: "App Installs - 014.0",
    reportValue: "App Installs",
    goal: "APP Journey",
    objective: "Consideration",
    okr: "Get as many app Installs as possible",
    costMetric: "CP.Install",
    metric: "App Install Rate",
    costMetricFormula: "Spend / App Installs",
    waterfallMetricFormula: "(App Installs / Outbound Clicks) * 100",
    relativeMetricFormula: "(App Installs / App downloads) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 15,
    formattedItemNo: "App Opens - 015.0",
    reportValue: "App Opens",
    goal: "APP Journey",
    objective: "Consideration",
    okr: "Get as many app opens as possible",
    costMetric: "CP.AO",
    metric: "App Open Rate",
    costMetricFormula: "Spend / App Opens",
    waterfallMetricFormula: "(App Opens / Outbound Clicks) * 100",
    relativeMetricFormula: "(App Opens / App Installs) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 16,
    formattedItemNo: "App Engagements - 016.0",
    reportValue: "App Engagements",
    goal: "APP Journey",
    objective: "Consideration",
    okr: "Get as many app engagements as possible",
    costMetric: "CP.AE",
    metric: "App Engagement Rate",
    costMetricFormula: "Spend / App Engagements",
    waterfallMetricFormula: "(App Engagements / Outbound Clicks) * 100",
    relativeMetricFormula: "(App Engagements / App Opens) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 17,
    formattedItemNo: "Add To Carts - 017.0",
    reportValue: "Add To Carts",
    goal: "e-Commerce",
    objective: "Consideration",
    okr: "Get as many add to carts as possible",
    costMetric: "CP.A2C",
    metric: "Add To Cart Rate",
    costMetricFormula: "Spend / Add To Carts",
    waterfallMetricFormula: "(Add To Carts / Outbound Clicks) * 100",
    relativeMetricFormula: "(Add To Carts / Landing Page Views) * 100",
    revenueMetric: "Total Cart Value",
    costOfRevenueMetric: "Potential Return On Cart",
    costOfRevenueMetricFormula: "Total Cart Value / Total Spend",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 18,
    formattedItemNo: "Initiate Checkouts - 018.0",
    reportValue: "Initiate Checkouts",
    goal: "e-Commerce",
    objective: "Consideration",
    okr: "Get as many initiate checkouts as possible",
    costMetric: "CP.ICheckout",
    metric: "Initiate Checkout Rate",
    costMetricFormula: "Spend / Initiate Checkouts",
    waterfallMetricFormula: "(Initiate Checkouts / Outbound Clicks) * 100",
    relativeMetricFormula: "(Initiate Checkouts / Add To Carts) * 100",
    revenueMetric: "Total Checkout Value",
    costOfRevenueMetric: "Potential Return On Checkout",
    costOfRevenueMetricFormula: "Total Checkout Value / Total Spend",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 19,
    formattedItemNo: "Add Payment Info - 019.0",
    reportValue: "Add Payment Info",
    goal: "e-Commerce",
    objective: "Consideration",
    okr: "Get as many people to complete payment info",
    costMetric: "CP.PaymentInfo",
    metric: "Add payment information rate",
    costMetricFormula: "Spend / Add Payment Info Events",
    waterfallMetricFormula: "(Add Payment Info / Outbound Clicks) * 100",
    relativeMetricFormula: "(Add Payment Info / Initiate Checkouts) * 100",
    revenueMetric: "Total Add Payment Info Value",
    costOfRevenueMetric: "Potential Return On Add Payment Info",
    costOfRevenueMetricFormula: "Total Add Payment Info Value / Total Spend",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 20,
    formattedItemNo: "Purchase - 020.0",
    reportValue: "Purchase",
    goal: "e-Commerce",
    objective: "Conversion",
    okr: "Get as many online purchases as possible",
    costMetric: "CP.Purchase",
    metric: "Purchase rate (Conversion Rate)",
    costMetricFormula: "Spend / Purchases",
    waterfallMetricFormula: "(Purchases / Outbound Clicks) * 100",
    relativeMetricFormula: "(Purchases / Add Payment Info) * 100",
    revenueMetric: "Total Purchase Value",
    costOfRevenueMetric: "ROAS",
    costOfRevenueMetricFormula: "Total Purchase Value / Total Spend",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 21,
    formattedItemNo: "Form Completes (Lead) - 021.0",
    reportValue: "Form Completes (Lead)",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many leads initiated as possible",
    costMetric: "CPL",
    metric: "Form Complete Rate",
    costMetricFormula: "Spend / Form Completes",
    waterfallMetricFormula: "(Form Completes / Initiate Checkouts) * 100",
    relativeMetricFormula: "(Form Completes / Landing Page Views) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 22,
    formattedItemNo: "Fetched Leads - 022.0",
    reportValue: "Fetched Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many Fetched leads as possible",
    costMetric: "CPL.Fetched",
    metric: "Fetched Lead Rate",
    costMetricFormula: "Spend / Fetched Leads",
    waterfallMetricFormula: "(Fetched Leads / Leads) * 100",
    relativeMetricFormula: "(Fetched Leads / Form Completes) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 23,
    formattedItemNo: "Standardised Leads - 023.0",
    reportValue: "Standardised Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many standardised leads as possible",
    costMetric: "CPL.Standardised",
    metric: "Standardised Lead Rate",
    costMetricFormula: "Spend / Standardised Leads",
    waterfallMetricFormula: "(Standardised Leads / Leads) * 100",
    relativeMetricFormula: "(Standardised Leads / Fetched Leads) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 24,
    formattedItemNo: "ID Validated Leads - 024.0",
    reportValue: "ID Validated Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many ID Validated leads as possible",
    costMetric: "CPL.IDValidated",
    metric: "ID Validated Leads",
    costMetricFormula: "Spend / ID Validated",
    waterfallMetricFormula: "(ID Validated Leads / Leads) * 100",
    relativeMetricFormula: "(ID Validated Leads / Standardised Leads) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 25,
    formattedItemNo: "Phone Validated Leads - 025.0",
    reportValue: "Phone Validated Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many Phone Validated leads as possible",
    costMetric: "CPL.PhoneValidated",
    metric: "Phone Validated Leads",
    costMetricFormula: "Spend / Phone Validated",
    waterfallMetricFormula: "(Standardised Leads / Leads) * 100",
    relativeMetricFormula: "(Phone Validated Leads / ID Validated Leads) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 26,
    formattedItemNo: "Email Validated Leads - 026.0",
    reportValue: "Email Validated Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many Email Validated leads as possible",
    costMetric: "CPL.EmailValidated",
    metric: "Email validated Leads",
    costMetricFormula: "Spend / Email Validated",
    waterfallMetricFormula: "(Standardised Leads / Leads) * 100",
    relativeMetricFormula: "(Email Validated Leads / Phone Validated Leads) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 27,
    formattedItemNo: "Address Validated Leads - 027.0",
    reportValue: "Address Validated Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many Address Validated leads as possible",
    costMetric: "CPL.AddressValidated",
    metric: "Address validated Leads",
    costMetricFormula: "Spend / Address Validated",
    waterfallMetricFormula: "(Standardised Leads / Leads) * 100",
    relativeMetricFormula: "(Address Validated Leads / Email Validated Leads) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 28,
    formattedItemNo: "Enriched Leads - 028.0",
    reportValue: "Enriched Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many enriched leads as possible",
    costMetric: "CPL.Enriched",
    metric: "Enriched Lead Rate",
    costMetricFormula: "Spend / Enriched Leads",
    waterfallMetricFormula: "(Enriched Leads / Leads) * 100",
    relativeMetricFormula: "(Enriched Leads / Address Validated Leads) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 29,
    formattedItemNo: "Internal DeDuped Leads - 029.0",
    reportValue: "Internal DeDuped Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many Deduplicated leads as possible",
    costMetric: "CPL.Deduped",
    metric: "Deduplicatin rate",
    costMetricFormula: "Spend / Internal DeDuped Leads",
    waterfallMetricFormula: "(Deduped Leads / Leads) * 100",
    relativeMetricFormula: "(Internal DeDuped Leads / Enriched Leads) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 30,
    formattedItemNo: "Internal Scored Leads - 030.0",
    reportValue: "Internal Scored Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get As many scored leads as possible",
    costMetric: "CPL.InternalScored",
    metric: "Internal Scored Lead Rate",
    costMetricFormula: "Spend / Internal Scored Leads",
    waterfallMetricFormula: "(Internal Scored Leads / Leads) * 100",
    relativeMetricFormula: "(Internal Scored Leads / Internal DeDuped Leads) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 31,
    formattedItemNo: "Contactability Verification - 031.0",
    reportValue: "Contactability Verification",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many contactable leads as possible",
    costMetric: "CPL.Verified",
    metric: "Lead Verification Rate",
    costMetricFormula: "Spend / Contactability Verification",
    waterfallMetricFormula: "(Contactability Verification / Leads) * 100",
    relativeMetricFormula: "(Contactability Verification / Internal Scored Leads) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 32,
    formattedItemNo: "Attempted to deliver Leads - 032.0",
    reportValue: "Attempted to deliver Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Attempt to deliver as many leads as possible",
    costMetric: "CPL.DelAttempted",
    metric: "Lead Delivery Attempted Rate",
    costMetricFormula: "Spend / Delivery Attempt",
    waterfallMetricFormula: "(Attempted Delivered Leads / Leads) * 100",
    relativeMetricFormula: "(Attempted to deliver Leads / Contactability Verification) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 33,
    formattedItemNo: "Delivered Leads - 033.0",
    reportValue: "Delivered Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many delivered leads as possible",
    costMetric: "CPL.Delivered",
    metric: "Lead delivery rate",
    costMetricFormula: "Spend / Delivered Leads",
    waterfallMetricFormula: "(Delivered Leads / Leads) * 100",
    relativeMetricFormula: "(Delivered Leads / Attempted to deliver Leads) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 34,
    formattedItemNo: "Accepted Leads - 034.0",
    reportValue: "Accepted Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many accepted leads as possible",
    costMetric: "CPL.Accepted",
    metric: "Lead acceptance rate",
    costMetricFormula: "Spend / Accepted Leads",
    waterfallMetricFormula: "(Accepted Leads / Leads) * 100",
    relativeMetricFormula: "(Accepted Leads / Delivered Leads) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 35,
    formattedItemNo: "Inbound calls - 035.0",
    reportValue: "Inbound calls",
    goal: "WEB Leads & Sales",
    objective: "Conversion - Inbound",
    okr: "Get as many inbound calls as possible",
    costMetric: "CP.INCALL",
    metric: "Inbound call rate",
    costMetricFormula: "Spend / Inbound Calls",
    waterfallMetricFormula: "(Inbound Calls / Outbound Clicks) * 100",
    relativeMetricFormula: "(Inbound calls / Outbound Clicks) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 36,
    formattedItemNo: "Qualified Leads - 036.0",
    reportValue: "Qualified Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many qualified leads as possible",
    costMetric: "CPL.Qualified",
    metric: "Qualified lead rate",
    costMetricFormula: "Spend / Qualified Leads",
    waterfallMetricFormula: "(Qualified Leads / Leads) * 100",
    relativeMetricFormula: "(Qualified Leads / Accepted Leads) * 100",
    channel: "Facebook, Instagram, YouTube, Google Ads, TikTok",
    context: "waterfall"
  },
  {
    itemNo: 37,
    formattedItemNo: "Dialed Leads - 037.0",
    reportValue: "Dialed Leads",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many leads dialed as possible",
    costMetric: "CPL.Dialed",
    metric: "Lead dial rate",
    costMetricFormula: "Spend / Dialed Leads",
    waterfallMetricFormula: "(Dialed Leads / Qualified Leads) * 100",
    relativeMetricFormula: "(Dialed Leads / Delivered Leads) * 100",
    channel: "CRM Integration",
    context: "waterfall"
  },
  {
    itemNo: 38,
    formattedItemNo: "Answered Calls - 038.0",
    reportValue: "Answered Calls",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Speak to as many leads as possible",
    costMetric: "CPL.Answered",
    metric: "Answer Rate",
    costMetricFormula: "Spend / Answered Leads",
    waterfallMetricFormula: "(Answered / Qualified Leads) * 100",
    relativeMetricFormula: "(Answered Calls / Dialed Leads) * 100",
    channel: "CRM Integration",
    context: "waterfall"
  },
  {
    itemNo: 39,
    formattedItemNo: "Right Party Contact - 039.0",
    reportValue: "Right Party Contact",
    goal: "WEB Leads & Sales",
    objective: "Conversion",
    okr: "Get as many right party connects as possible",
    costMetric: "CP.RPC",
    metric: "Right party contact rate",
    costMetricFormula: "Spend / RPCs",
    waterfallMetricFormula: "(RPCs / Qualified Leads) * 100",
    relativeMetricFormula: "(Right Party Contact / Answered Calls) * 100",
    channel: "CRM Integration",
    context: "waterfall"
  },
  {
    itemNo: 40,
    formattedItemNo: "Sales - 040.0",
    reportValue: "Sales",
    goal: "WEB Leads & Sales",
    objective: "Post Conversion",
    okr: "Convert as many qualified leads to sales as possible",
    costMetric: "CP.Sale",
    metric: "Qualified Leads to Sale Rate (Lead-to-Sale)",
    costMetricFormula: "Spend / Sales",
    waterfallMetricFormula: "(Sales / Qualified Leads) * 100",
    relativeMetricFormula: "(Sales / Right Party Contact) * 100",
    revenueMetric: "Total Sales value",
    costOfRevenueMetric: "Potential return on sales",
    costOfRevenueMetricFormula: "Total Sales value / Total spend",
    channel: "CRM Integration",
    context: "waterfall"
  },
  {
    itemNo: 41,
    formattedItemNo: "Fetched Sales - 041.0",
    reportValue: "Fetched Sales",
    goal: "WEB Leads & Sales",
    objective: "Post Conversion - CRM",
    okr: "Fetch as many sales as possible",
    costMetric: "CPS.Fetched",
    metric: "Fetched Sales Rate",
    costMetricFormula: "Spend / Fetched Sales",
    waterfallMetricFormula: "(Fetched Sales / Sales) * 100",
    relativeMetricFormula: "(Fetched Sales / Sales) * 100",
    revenueMetric: "Total Fetched Sales value",
    costOfRevenueMetric: "Potential return on sales",
    channel: "CRM Integration",
    context: "waterfall"
  },
  {
    itemNo: 42,
    formattedItemNo: "Attempted Delivery of Sales to Client CRM - 042.0",
    reportValue: "Attempted Delivery of Sales to Client CRM",
    goal: "WEB Leads & Sales",
    objective: "Post Conversion - CRM",
    okr: "Attempted to delivery as many sales to client CRM",
    costMetric: "CPS.CRMAttempted",
    metric: "Attempted Sales CRM Delivery Rate",
    costMetricFormula: "Spend / Attempted Delivery of Sales to Client CRM",
    waterfallMetricFormula: "(Attempted Delivery of Sales to Client CRM / Sales) * 100",
    relativeMetricFormula: "(Attempted Delivery of Sales to Client CRM / Fetched Sales) * 100",
    revenueMetric: "Total Fetched Sales value",
    channel: "CRM Integration",
    context: "waterfall"
  },
  {
    itemNo: 43,
    formattedItemNo: "Delivery of Sales to Client CRM - 043.0",
    reportValue: "Delivery of Sales to Client CRM",
    goal: "WEB Leads & Sales",
    objective: "Post Conversion - CRM",
    okr: "Deliver as many sales to clients CRM as possible.",
    costMetric: "CPS.CRMDelivered",
    metric: "Delivered Sales CRM Delivery Rate",
    costMetricFormula: "Spend / Delivered Sales to Client CRM",
    waterfallMetricFormula: "(CRM Delivery / CRM Delivery Attempts) * 100",
    relativeMetricFormula: "(Delivery of Sales to Client CRM / Attempted Delivery of Sales to Client CRM) * 100",
    revenueMetric: "CRM Delivered Sales Value",
    costOfRevenueMetric: "Return on CRM Delivered Sales",
    costOfRevenueMetricFormula: "Delivered Sales Value / Total Spend",
    channel: "CRM Integration",
    context: "waterfall"
  },
  {
    itemNo: 44,
    formattedItemNo: "Accepted Client CRM Sales - 044.0",
    reportValue: "Accepted Client CRM Sales",
    goal: "WEB Leads & Sales",
    objective: "Post Conversion - CRM",
    okr: "Get as many fetched sales accepted by client crm",
    costMetric: "CPS.CRMAccepted",
    metric: "Accepted Sales CRM Rate",
    costMetricFormula: "Spend / Accepted CRM Sales",
    waterfallMetricFormula: "(Accepted CRM Sales / Sales) * 100",
    relativeMetricFormula: "(Accepted Client CRM Sales / Delivery of Sales to Client CRM) * 100",
    channel: "CRM Integration",
    context: "waterfall"
  },
  {
    itemNo: 45,
    formattedItemNo: "Delivered Sales - 045.0",
    reportValue: "Delivered Sales",
    goal: "WEB Leads & Sales",
    objective: "Post Conversion",
    okr: "Get as many sales delivered as possible",
    costMetric: "CPS.Delivered",
    metric: "Delivery Rate",
    costMetricFormula: "Spend / Delivered Sales",
    waterfallMetricFormula: "(Delivered Sales / Sales) * 100",
    relativeMetricFormula: "(Delivered Sales / Accepted Client CRM Sales) * 100",
    channel: "CRM Integration",
    context: "waterfall"
  },
  {
    itemNo: 46,
    formattedItemNo: "Activated Sales - 046.0",
    reportValue: "Activated Sales",
    goal: "WEB Leads & Sales",
    objective: "Post Conversion",
    okr: "Get as many sales activated as possible",
    costMetric: "CPS.Activated",
    metric: "Activation Rate",
    costMetricFormula: "Spend / Activated Sales",
    waterfallMetricFormula: "(Activated Sales / Sales) * 100",
    relativeMetricFormula: "(Activated Sales / Delivered Sales) * 100",
    channel: "CRM Integration",
    context: "waterfall"
  },
  {
    itemNo: 47,
    formattedItemNo: "Sales payment collected - 047.0",
    reportValue: "Sales payment collected",
    goal: "WEB Leads & Sales",
    objective: "Post Conversion",
    okr: "Collect as many sales payments as possible",
    costMetric: "CPS.Collection",
    metric: "Sales Collection Rate",
    costMetricFormula: "Spend / Sales Payment Collections",
    waterfallMetricFormula: "(Sales Payment Collections / Sales) * 100",
    relativeMetricFormula: "(Sales payment collected / Activated Sales) * 100",
    channel: "CRM Integration",
    context: "waterfall"
  },
  {
    itemNo: 48,
    formattedItemNo: "Premium Collections - 048.0",
    reportValue: "Premium Collections",
    goal: "WEB Leads & Sales",
    objective: "Post Conversion",
    okr: "Get as many Premium collections as possible",
    costMetric: "CPP.Collection",
    metric: "Premium Collection rate",
    costMetricFormula: "Spend / Premium Collections",
    waterfallMetricFormula: "(Premium Collections / Sales) * 100",
    relativeMetricFormula: "(Premium Collections / Sales payment collected) * 100",
    channel: "CRM Integration",
    context: "waterfall"
  },
  {
    itemNo: 49,
    formattedItemNo: "Lifetime Value - 049.0",
    reportValue: "Lifetime Value",
    goal: "WEB Leads & Sales",
    objective: "Post Conversion",
    okr: "Get maximum customer lifetime value",
    costMetric: "CLTV",
    metric: "Return On Customer Life Time Value",
    costMetricFormula: "Total Revenue collected / Customer Total Acquisition Cost",
    waterfallMetricFormula: "Customer Life Time Revenue / Customer Total Acquisition Cost",
    relativeMetricFormula: "Customer Life Time Revenue / Customer Total Acquisition Cost",
    revenueMetric: "ROAS",
    costOfRevenueMetricFormula: "Customer Life Time Revenue / Customer Total Acquisition Cost",
    channel: "CRM, Analytics",
    context: "waterfall"
  }
];

/**
 * RELATIVE TAXONOMY
 * Sourced from the "Relative." worksheet.
 * Specifically reflects the stage-to-stage transition calculation context.
 */
export const RELATIVE_TAXONOMY: MetricTaxonomyItem[] = MASTER_TAXONOMY.map(item => ({
  ...item,
  context: 'relative',
  waterfallMetricFormula: item.relativeMetricFormula || item.waterfallMetricFormula
}));

/**
 * Historical terminology and aliases cross-referenced with "Main", "Relative", and legacy schemas.
 * Ensures consistent resolution without silently overriding canonical authorities.
 */
export const HISTORICAL_ALIASES: Record<string, string> = {
  // Legacy / spelling variations
  'internally deduplicated leads': 'Internal DeDuped Leads',
  'internally deduplicated leads - 029.0': 'Internal DeDuped Leads',
  'deduped leads': 'Internal DeDuped Leads',
  'deduplicated leads': 'Internal DeDuped Leads',
  'dialled leads': 'Dialed Leads',
  'dialled leads - 037.0': 'Dialed Leads',
  'called leads': 'Dialed Leads',
  'right-party contact': 'Right Party Contact',
  'right-party contact - 039.0': 'Right Party Contact',
  'rpc': 'Right Party Contact',
  'sales payment collections': 'Sales payment collected',
  'sales payment collections - 047.0': 'Sales payment collected',
  'sales payment collection': 'Sales payment collected',
  
  // Cost codes
  'cpm': 'Impressions',
  'cpm.r': 'Reach',
  'cp.recall': 'Ad Recall',
  'cpe': 'Engagement',
  'cp.view': 'Video Views (5"+ Play) (20% Viewable)',
  'cp.pagelike': 'Page Like',
  'cpc': 'Clicks',
  'cp.oc': 'Outbound Clicks',
  'cp.convo': 'Conversation',
  'cp.lpv': 'Landing Page Views',
  'cp.ap': 'App Purchases',
  'cp.ad': 'App Download',
  'cp.install': 'App Installs',
  'cp.ao': 'App Opens',
  'cp.ae': 'App Engagements',
  'cp.a2c': 'Add To Carts',
  'cp.icheckout': 'Initiate Checkouts',
  'cp.paymentinfo': 'Add Payment Info',
  'cp.purchase': 'Purchase',
  'cpl': 'Form Completes (Lead)',
  'cpl.fetched': 'Fetched Leads',
  'cpl.standardised': 'Standardised Leads',
  'cpl.idvalidated': 'ID Validated Leads',
  'cpl.phonevalidated': 'Phone Validated Leads',
  'cpl.emailvalidated': 'Email Validated Leads',
  'cpl.addressvalidated': 'Address Validated Leads',
  'cpl.enriched': 'Enriched Leads',
  'cpl.deduped': 'Internal DeDuped Leads',
  'cpl.internalscored': 'Internal Scored Leads',
  'cpl.verified': 'Contactability Verification',
  'cpl.delattempted': 'Attempted to deliver Leads',
  'cpl.delivered': 'Delivered Leads',
  'cpl.accepted': 'Accepted Leads',
  'cp.incall': 'Inbound calls',
  'cpl.qualified': 'Qualified Leads',
  'cpl.dialed': 'Dialed Leads',
  'cpl.dialled': 'Dialed Leads',
  'cpl.answered': 'Answered Calls',
  'cp.rpc': 'Right Party Contact',
  'cp.sale': 'Sales',
  'cps.fetched': 'Fetched Sales',
  'cps.crmattempted': 'Attempted Delivery of Sales to Client CRM',
  'cps.crmdelivered': 'Delivery of Sales to Client CRM',
  'cps.crmaccepted': 'Accepted Client CRM Sales',
  'cps.delivered': 'Delivered Sales',
  'cps.activated': 'Activated Sales',
  'cps.collection': 'Sales payment collected',
  'cpp.collection': 'Premium Collections',
  'cltv': 'Lifetime Value'
};

// Fast lookup maps
export const TAXONOMY_BY_ITEM_NO: Record<number, MetricTaxonomyItem> = {};
export const TAXONOMY_BY_REPORT_VALUE: Record<string, MetricTaxonomyItem> = {};
export const TAXONOMY_BY_COST_METRIC: Record<string, MetricTaxonomyItem> = {};
export const TAXONOMY_BY_FORMATTED_NO: Record<string, MetricTaxonomyItem> = {};

// Relative lookup maps
export const RELATIVE_BY_ITEM_NO: Record<number, MetricTaxonomyItem> = {};
export const RELATIVE_BY_REPORT_VALUE: Record<string, MetricTaxonomyItem> = {};

MASTER_TAXONOMY.forEach(item => {
  TAXONOMY_BY_ITEM_NO[item.itemNo] = item;
  TAXONOMY_BY_REPORT_VALUE[item.reportValue.toLowerCase()] = item;
  TAXONOMY_BY_COST_METRIC[item.costMetric.toLowerCase()] = item;
  TAXONOMY_BY_FORMATTED_NO[item.formattedItemNo.toLowerCase()] = item;
});

RELATIVE_TAXONOMY.forEach(item => {
  RELATIVE_BY_ITEM_NO[item.itemNo] = item;
  RELATIVE_BY_REPORT_VALUE[item.reportValue.toLowerCase()] = item;
});

/**
 * Universal helper to retrieve canonical taxonomy item by:
 * - Item number (e.g. 29, 37)
 * - Report Value (e.g. "Internal DeDuped Leads", "Dialed Leads")
 * - Formatted Item No (e.g. "Internal DeDuped Leads - 029.0")
 * - Cost Metric code (e.g. "CPL.Deduped", "CPL.Dialed", "CPM")
 * - Historical / alternative alias (e.g. "Internally Deduplicated Leads", "Dialled Leads")
 * - Context ('waterfall' | 'relative')
 */
export function getTaxonomyItem(
  key: string | number | null | undefined, 
  context: 'waterfall' | 'relative' = 'waterfall'
): MetricTaxonomyItem | undefined {
  if (key === null || key === undefined) return undefined;
  
  if (typeof key === 'number') {
    return context === 'relative' ? RELATIVE_BY_ITEM_NO[key] : TAXONOMY_BY_ITEM_NO[key];
  }

  const clean = String(key).trim().toLowerCase();
  if (!clean) return undefined;

  // 1. Direct match on report value
  let item = context === 'relative' 
    ? RELATIVE_BY_REPORT_VALUE[clean] 
    : TAXONOMY_BY_REPORT_VALUE[clean];
  if (item) return item;

  // 2. Direct match on cost metric code
  item = TAXONOMY_BY_COST_METRIC[clean];
  if (item) return context === 'relative' ? RELATIVE_BY_ITEM_NO[item.itemNo] : item;

  // 3. Direct match on formatted item number
  item = TAXONOMY_BY_FORMATTED_NO[clean];
  if (item) return context === 'relative' ? RELATIVE_BY_ITEM_NO[item.itemNo] : item;

  // 4. Try stripping item prefix/suffix like " - 029.0" or "Item 029.0"
  const stripped = clean.replace(/\s*-\s*0?\d+(\.0)?$/, '').trim();
  item = TAXONOMY_BY_REPORT_VALUE[stripped];
  if (item) return context === 'relative' ? RELATIVE_BY_ITEM_NO[item.itemNo] : item;

  // 5. Check historical aliases
  const canonicalName = HISTORICAL_ALIASES[clean] || HISTORICAL_ALIASES[stripped];
  if (canonicalName) {
    const aliasClean = canonicalName.toLowerCase();
    item = context === 'relative' 
      ? RELATIVE_BY_REPORT_VALUE[aliasClean] 
      : TAXONOMY_BY_REPORT_VALUE[aliasClean];
    if (item) return item;
  }

  // 6. Number parsed from string (e.g. "29" or "Item 29")
  const matchNum = clean.match(/\b([2-9]|[1-4][0-9])\b/);
  if (matchNum) {
    const num = parseInt(matchNum[1], 10);
    if (num >= 2 && num <= 49) {
      return context === 'relative' ? RELATIVE_BY_ITEM_NO[num] : TAXONOMY_BY_ITEM_NO[num];
    }
  }

  return undefined;
}
