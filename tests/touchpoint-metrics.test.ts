import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MASTER_TAXONOMY,
  RELATIVE_TAXONOMY,
  HISTORICAL_ALIASES,
  TAXONOMY_VERSION,
  getTaxonomyItem,
  TAXONOMY_BY_ITEM_NO,
  TAXONOMY_BY_REPORT_VALUE,
  TAXONOMY_BY_COST_METRIC
} from '../contracts/taxonomy';
import * as clientTaxonomy from '../src/lib/taxonomy';
import * as serverTaxonomy from '../server/bigquery/taxonomy';

const EXPECTED_TOUCHPOINTS: Array<{
  itemNo: number;
  reportValue: string;
  formattedItemNo: string;
  costMetric: string;
}> = [
  { itemNo: 2, formattedItemNo: "Impressions - 02.0", reportValue: "Impressions", costMetric: "CPM" },
  { itemNo: 3, formattedItemNo: "Reach - 03.0", reportValue: "Reach", costMetric: "CPM.R" },
  { itemNo: 4, formattedItemNo: "Ad Recall - 04.0", reportValue: "Ad Recall", costMetric: "CP.Recall" },
  { itemNo: 5, formattedItemNo: "Engagement - 05.0", reportValue: "Engagement", costMetric: "CPE" },
  { itemNo: 6, formattedItemNo: 'Video Views (5""+ Play) (20% Viewable) - 06.0', reportValue: 'Video Views (5""+ Play) (20% Viewable)', costMetric: "CP.View" },
  { itemNo: 7, formattedItemNo: "Page Like - 07.0", reportValue: "Page Like", costMetric: "CP.PageLike" },
  { itemNo: 8, formattedItemNo: "Clicks - 08.0", reportValue: "Clicks", costMetric: "CPC" },
  { itemNo: 9, formattedItemNo: "Outbound Clicks - 09.0", reportValue: "Outbound Clicks", costMetric: "CP.OC" },
  { itemNo: 10, formattedItemNo: "Conversation - 010.0", reportValue: "Conversation", costMetric: "CP.Convo" },
  { itemNo: 11, formattedItemNo: "Landing Page Views - 011.0", reportValue: "Landing Page Views", costMetric: "CP.LPV" },
  { itemNo: 12, formattedItemNo: "App Purchases - 012.0", reportValue: "App Purchases", costMetric: "CP.AP" },
  { itemNo: 13, formattedItemNo: "App Download - 013.0", reportValue: "App Download", costMetric: "CP.AD" },
  { itemNo: 14, formattedItemNo: "App Installs - 014.0", reportValue: "App Installs", costMetric: "CP.Install" },
  { itemNo: 15, formattedItemNo: "App Opens - 015.0", reportValue: "App Opens", costMetric: "CP.AO" },
  { itemNo: 16, formattedItemNo: "App Engagements - 016.0", reportValue: "App Engagements", costMetric: "CP.AE" },
  { itemNo: 17, formattedItemNo: "Add To Carts - 017.0", reportValue: "Add To Carts", costMetric: "CP.A2C" },
  { itemNo: 18, formattedItemNo: "Initiate Checkouts - 018.0", reportValue: "Initiate Checkouts", costMetric: "CP.ICheckout" },
  { itemNo: 19, formattedItemNo: "Add Payment Info - 019.0", reportValue: "Add Payment Info", costMetric: "CP.PaymentInfo" },
  { itemNo: 20, formattedItemNo: "Purchase - 020.0", reportValue: "Purchase", costMetric: "CP.Purchase" },
  { itemNo: 21, formattedItemNo: "Form Completes (Lead) - 021.0", reportValue: "Form Completes (Lead)", costMetric: "CPL" },
  { itemNo: 22, formattedItemNo: "Fetched Leads - 022.0", reportValue: "Fetched Leads", costMetric: "CPL.Fetched" },
  { itemNo: 23, formattedItemNo: "Standardised Leads - 023.0", reportValue: "Standardised Leads", costMetric: "CPL.Standardised" },
  { itemNo: 24, formattedItemNo: "ID Validated Leads - 024.0", reportValue: "ID Validated Leads", costMetric: "CPL.IDValidated" },
  { itemNo: 25, formattedItemNo: "Phone Validated Leads - 025.0", reportValue: "Phone Validated Leads", costMetric: "CPL.PhoneValidated" },
  { itemNo: 26, formattedItemNo: "Email Validated Leads - 026.0", reportValue: "Email Validated Leads", costMetric: "CPL.EmailValidated" },
  { itemNo: 27, formattedItemNo: "Address Validated Leads - 027.0", reportValue: "Address Validated Leads", costMetric: "CPL.AddressValidated" },
  { itemNo: 28, formattedItemNo: "Enriched Leads - 028.0", reportValue: "Enriched Leads", costMetric: "CPL.Enriched" },
  { itemNo: 29, formattedItemNo: "Internal DeDuped Leads - 029.0", reportValue: "Internal DeDuped Leads", costMetric: "CPL.Deduped" },
  { itemNo: 30, formattedItemNo: "Internal Scored Leads - 030.0", reportValue: "Internal Scored Leads", costMetric: "CPL.InternalScored" },
  { itemNo: 31, formattedItemNo: "Contactability Verification - 031.0", reportValue: "Contactability Verification", costMetric: "CPL.Verified" },
  { itemNo: 32, formattedItemNo: "Attempted to deliver Leads - 032.0", reportValue: "Attempted to deliver Leads", costMetric: "CPL.DelAttempted" },
  { itemNo: 33, formattedItemNo: "Delivered Leads - 033.0", reportValue: "Delivered Leads", costMetric: "CPL.Delivered" },
  { itemNo: 34, formattedItemNo: "Accepted Leads - 034.0", reportValue: "Accepted Leads", costMetric: "CPL.Accepted" },
  { itemNo: 35, formattedItemNo: "Inbound calls - 035.0", reportValue: "Inbound calls", costMetric: "CP.INCALL" },
  { itemNo: 36, formattedItemNo: "Qualified Leads - 036.0", reportValue: "Qualified Leads", costMetric: "CPL.Qualified" },
  { itemNo: 37, formattedItemNo: "Dialed Leads - 037.0", reportValue: "Dialed Leads", costMetric: "CPL.Dialed" },
  { itemNo: 38, formattedItemNo: "Answered Calls - 038.0", reportValue: "Answered Calls", costMetric: "CPL.Answered" },
  { itemNo: 39, formattedItemNo: "Right Party Contact - 039.0", reportValue: "Right Party Contact", costMetric: "CP.RPC" },
  { itemNo: 40, formattedItemNo: "Sales - 040.0", reportValue: "Sales", costMetric: "CP.Sale" },
  { itemNo: 41, formattedItemNo: "Fetched Sales - 041.0", reportValue: "Fetched Sales", costMetric: "CPS.Fetched" },
  { itemNo: 42, formattedItemNo: "Attempted Delivery of Sales to Client CRM - 042.0", reportValue: "Attempted Delivery of Sales to Client CRM", costMetric: "CPS.CRMAttempted" },
  { itemNo: 43, formattedItemNo: "Delivery of Sales to Client CRM - 043.0", reportValue: "Delivery of Sales to Client CRM", costMetric: "CPS.CRMDelivered" },
  { itemNo: 44, formattedItemNo: "Accepted Client CRM Sales - 044.0", reportValue: "Accepted Client CRM Sales", costMetric: "CPS.CRMAccepted" },
  { itemNo: 45, formattedItemNo: "Delivered Sales - 045.0", reportValue: "Delivered Sales", costMetric: "CPS.Delivered" },
  { itemNo: 46, formattedItemNo: "Activated Sales - 046.0", reportValue: "Activated Sales", costMetric: "CPS.Activated" },
  { itemNo: 47, formattedItemNo: "Sales payment collected - 047.0", reportValue: "Sales payment collected", costMetric: "CPS.Collection" },
  { itemNo: 48, formattedItemNo: "Premium Collections - 048.0", reportValue: "Premium Collections", costMetric: "CPP.Collection" },
  { itemNo: 49, formattedItemNo: "Lifetime Value - 049.0", reportValue: "Lifetime Value", costMetric: "CLTV" },
];

test('Master taxonomy contains exactly all 48 required canonical touchpoints', () => {
  assert.equal(MASTER_TAXONOMY.length, EXPECTED_TOUCHPOINTS.length);
  assert.equal(EXPECTED_TOUCHPOINTS.length, 48);

  for (const expected of EXPECTED_TOUCHPOINTS) {
    const item = TAXONOMY_BY_ITEM_NO[expected.itemNo];
    assert.ok(item, `Item No ${expected.itemNo} must exist in taxonomy`);
    assert.equal(item.reportValue, expected.reportValue, `Item ${expected.itemNo} reportValue mismatch`);
    assert.equal(item.formattedItemNo, expected.formattedItemNo, `Item ${expected.itemNo} formattedItemNo mismatch`);
    assert.equal(item.costMetric, expected.costMetric, `Item ${expected.itemNo} costMetric mismatch`);
  }
});

test('Fast lookup maps are populated and consistent for all items', () => {
  for (const expected of EXPECTED_TOUCHPOINTS) {
    const byReportVal = TAXONOMY_BY_REPORT_VALUE[expected.reportValue.toLowerCase()];
    assert.ok(byReportVal, `Lookup by report value failed for "${expected.reportValue}"`);
    assert.equal(byReportVal.itemNo, expected.itemNo);

    const byCost = TAXONOMY_BY_COST_METRIC[expected.costMetric.toLowerCase()];
    assert.ok(byCost, `Lookup by cost metric failed for "${expected.costMetric}"`);
    assert.equal(byCost.itemNo, expected.itemNo);
  }
});

test('getTaxonomyItem resolves canonical touchpoints by diverse keys and formats', () => {
  // Test by number
  assert.equal(getTaxonomyItem(29)?.reportValue, 'Internal DeDuped Leads');
  assert.equal(getTaxonomyItem(37)?.reportValue, 'Dialed Leads');
  assert.equal(getTaxonomyItem(39)?.reportValue, 'Right Party Contact');
  assert.equal(getTaxonomyItem(47)?.reportValue, 'Sales payment collected');

  // Test by canonical report value
  assert.equal(getTaxonomyItem('Internal DeDuped Leads')?.itemNo, 29);
  assert.equal(getTaxonomyItem('Dialed Leads')?.itemNo, 37);
  assert.equal(getTaxonomyItem('Right Party Contact')?.itemNo, 39);
  assert.equal(getTaxonomyItem('Sales payment collected')?.itemNo, 47);

  // Test by formatted item number
  assert.equal(getTaxonomyItem('Internal DeDuped Leads - 029.0')?.itemNo, 29);
  assert.equal(getTaxonomyItem('Dialed Leads - 037.0')?.itemNo, 37);
  assert.equal(getTaxonomyItem('Right Party Contact - 039.0')?.itemNo, 39);
  assert.equal(getTaxonomyItem('Sales payment collected - 047.0')?.itemNo, 47);

  // Test by cost code
  assert.equal(getTaxonomyItem('CPL.Deduped')?.itemNo, 29);
  assert.equal(getTaxonomyItem('CPL.Dialed')?.itemNo, 37);
  assert.equal(getTaxonomyItem('CP.RPC')?.itemNo, 39);
  assert.equal(getTaxonomyItem('CPS.Collection')?.itemNo, 47);
  assert.equal(getTaxonomyItem('CLTV')?.itemNo, 49);
});

test('Historical aliases resolve to canonical items without overriding primary authority', () => {
  // Historical spelling variants
  assert.equal(getTaxonomyItem('Internally Deduplicated Leads')?.itemNo, 29);
  assert.equal(getTaxonomyItem('Dialled Leads')?.itemNo, 37);
  assert.equal(getTaxonomyItem('Right-Party Contact')?.itemNo, 39);
  assert.equal(getTaxonomyItem('Sales Payment Collections')?.itemNo, 47);

  // With formatted item number suffixes
  assert.equal(getTaxonomyItem('Dialled Leads - 037.0')?.itemNo, 37);
  assert.equal(getTaxonomyItem('Right-Party Contact - 039.0')?.itemNo, 39);

  // Ensure canonical name is retained as primary
  assert.equal(getTaxonomyItem('Dialled Leads')?.reportValue, 'Dialed Leads');
  assert.equal(getTaxonomyItem('Right-Party Contact')?.reportValue, 'Right Party Contact');
  assert.equal(getTaxonomyItem('Internally Deduplicated Leads')?.reportValue, 'Internal DeDuped Leads');
  assert.equal(getTaxonomyItem('Sales Payment Collections')?.reportValue, 'Sales payment collected');
});

test('Relative taxonomy preserves step-to-step formula calculation context', () => {
  assert.equal(RELATIVE_TAXONOMY.length, 48);

  const dialedWaterfall = getTaxonomyItem(37, 'waterfall');
  const dialedRelative = getTaxonomyItem(37, 'relative');
  assert.equal(dialedWaterfall?.waterfallMetricFormula, '(Dialed Leads / Qualified Leads) * 100');
  assert.equal(dialedRelative?.waterfallMetricFormula, '(Dialed Leads / Delivered Leads) * 100');

  const answeredWaterfall = getTaxonomyItem(38, 'waterfall');
  const answeredRelative = getTaxonomyItem(38, 'relative');
  assert.equal(answeredWaterfall?.waterfallMetricFormula, '(Answered / Qualified Leads) * 100');
  assert.equal(answeredRelative?.waterfallMetricFormula, '(Answered Calls / Dialed Leads) * 100');

  const rpcWaterfall = getTaxonomyItem(39, 'waterfall');
  const rpcRelative = getTaxonomyItem(39, 'relative');
  assert.equal(rpcWaterfall?.waterfallMetricFormula, '(RPCs / Qualified Leads) * 100');
  assert.equal(rpcRelative?.waterfallMetricFormula, '(Right Party Contact / Answered Calls) * 100');
});

test('Frontend and backend taxonomy modules re-export from contracts single source of truth', () => {
  assert.equal(clientTaxonomy.MASTER_TAXONOMY.length, MASTER_TAXONOMY.length);
  assert.equal(serverTaxonomy.MASTER_TAXONOMY.length, MASTER_TAXONOMY.length);
  assert.equal(clientTaxonomy.TAXONOMY_VERSION, TAXONOMY_VERSION);
  assert.equal(serverTaxonomy.TAXONOMY_VERSION, TAXONOMY_VERSION);
  assert.equal(clientTaxonomy.getTaxonomyItem(37)?.reportValue, 'Dialed Leads');
  assert.equal(serverTaxonomy.getTaxonomyItem(37)?.reportValue, 'Dialed Leads');
});
