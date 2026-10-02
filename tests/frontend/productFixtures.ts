// Synthetic evidence generated through buildOperatingControlsResult, also checked in product-journey-operations.test.ts.
// No production data, inferred counters, or verification claims.
export const productPayloads = {
  "/api/analytics/offernet/operating-controls": {
    "summary": {
      "totalLeads": 10,
      "deliveredLeads": 8,
      "dialledLeads": 6,
      "unrecordedCallLeads": 3,
      "dialledUnrecordedCallLeads": null,
      "dialledUnrecordedCallSharePct": null,
      "zeroCallLeads": 0,
      "oneCallLeads": 0,
      "multiCallLeads": 0,
      "highAttemptNoRpcLeads": 0,
      "singleAttemptSharePct": null,
      "multiAttemptSharePct": null,
      "dispositionCompletenessPct": null,
      "afterHoursLeads": 0,
      "afterHoursSharePct": 0,
      "weekendLeads": 0,
      "weekendSharePct": null,
      "sla15Rate": null,
      "sla60Rate": null,
      "awaitingFirstDial": 2,
      "oldestDeliveryWait": "—",
      "captureToDialMedian": "—",
      "captureToDialP90": "—",
      "captureWithin15mRate": null,
      "captureWithin60mRate": null,
      "activationBacklog14d": 0,
      "afterHoursRpcRate": null,
      "operatingHoursRpcRate": null,
      "afterHoursSaleRate": null,
      "operatingHoursSaleRate": null
    },
    "attemptBuckets": [
      {
        "bucket": "0 calls",
        "leads": 0,
        "sharePct": 0,
        "contacted": 0,
        "contactRate": null,
        "sales": 0,
        "saleRate": null,
        "activations": 0
      },
      {
        "bucket": "Unrecorded",
        "leads": 3,
        "sharePct": 30,
        "contacted": 1,
        "contactRate": 33.3,
        "sales": 0,
        "saleRate": 0,
        "activations": 0
      }
    ],
    "slaBands": [
      {
        "band": "0–15m",
        "leads": 6,
        "sharePct": 60,
        "contactRate": 33.3,
        "saleRate": 0
      },
      {
        "band": "Undialled",
        "leads": 2,
        "sharePct": 20,
        "contactRate": 0,
        "saleRate": 0
      }
    ],
    "activationAgeing": [],
    "hourlyFlow": [
      {
        "hour": 9,
        "captured": 10,
        "firstDials": 6
      }
    ],
    "dailyTurnaround": [],
    "vendorControls": [
      {
        "vendor": "VendorA",
        "leads": 10,
        "unrecordedCallLeads": 3,
        "dialledUnrecordedCallLeads": null,
        "dialledUnrecordedCallSharePct": null,
        "zeroCallLeads": 0,
        "oneCallSharePct": 0,
        "highAttemptNoRpc": 0,
        "dispositionCompletenessPct": 100,
        "sla15Rate": 0,
        "medianFirstDial": "—",
        "rpcRate": 33.3,
        "leadToSaleRate": 0
      }
    ],
    "dataCompleteness": {
      "missingSource": 0,
      "missingGrade": 0,
      "missingVendor": 0,
      "missingDisposition": 0
    },
    "operatingContext": {
      "timezone": "Africa/Johannesburg",
      "start": "08:00",
      "end": "17:30",
      "workdays": [
        1,
        2,
        3,
        4,
        5
      ]
    },
    "methodology": {
      "callCount": "Call-count controls use the maximum recorded HLC/vendor total_calls value per lead. Only valid non-negative counters qualify: null/invalid/negative is Unrecorded; an explicit 0 is Zero calls. One-call and multi-call shares count qualified dialled leads in each recorded bucket / all qualified dialled leads; dialled leads with unrecorded counters are reported separately. These are descriptive cumulative counters, not event-level attempt attribution. The 5+ no RPC population requires explicit negative RPC; unknown RPC is excluded.",
      "vendor": "Vendor controls use the first recorded delivered vendor per lead to keep each lead exclusive in the comparison.",
      "operatingHours": "Operating-hours classification uses the tenant timezone and configured operating window.",
      "captureTurnaround": "Capture-to-first-dial measures lead fetched/API-entry time to the first recorded dial. Delivery-to-first-dial remains a separate downstream handoff metric.",
      "realtimeDialler": "Live agent state, hopper priority, dial level, drop rate and hopper-reset events require the VICIdial real-time/API source and are not inferred from historical BigQuery rows."
    },
    "validationStatus": "NOT_VERIFIED"
  }
};
