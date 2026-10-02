/** Browser-only snapshots of existing regression inputs. No production entry imports this file.
 * Vetting: tests/vetting-router.test.ts first report; grouped evidence stays empty.
 * Cohorts: tests/analytics-expansion-scope.test.ts 17-row truncation case, unchanged mapper output.
 * CLI: tests/cli-performance.test.ts validCsv, unchanged parser/summary output.
 * Warehouse: tests/audit-integrity-warehouse.test.ts saved catalogue, never live evidence.
 * Consumer, agent, routing, reconciliation retain the existing acceptance fixtures/unavailable states. */
import { CLI_METRIC_DEFINITIONS } from '../../contracts/cliPerformance';

const cohortRegressionRow = {
  "detailTruncated": true,
  "rowLimit": 16,
  "missingRevenueLeads": 0,
  "size": 10,
  "delivered": 8,
  "deliveryRate": 80,
  "called": 5,
  "callRate": 50,
  "callCoverage": 62.5,
  "rpcs": 0,
  "rpcRate": 0,
  "sales": 2,
  "saleRate": 20,
  "leadToSaleRate": 20,
  "billableSales": 0,
  "billableSaleRate": 0,
  "activations": 1,
  "activationRate": 50,
  "revenue": 0,
  "revPerLead": 0,
  "maturationStatus": "OBSERVED",
  "maturationReason": null,
  "metrics": {
    "d0": 0,
    "d1": null,
    "d3": null,
    "d7": null,
    "d14": null,
    "d30": null
  }
};

const cliRegressionReport = {
  "provenance": "IMPORTED_REPORT",
  "status": "AVAILABLE",
  "sourceStatus": {
    "table": "synthetic CSV regression fixture",
    "configured": true,
    "schemaChecked": false,
    "cliFieldPresent": false,
    "reason": "Existing CSV parser regression fixture; no warehouse access."
  },
  "summary": {
    "totalCalls": "4000",
    "activeClis": 2,
    "distinctLeads": null,
    "callsPerLead": null,
    "asrCount": "2500",
    "asrRate": "62.50",
    "answeredCount": "2200",
    "answeredRate": "55.00",
    "contactCount": "1200",
    "contactRate": "30.00",
    "saleCount": "135",
    "salePerCallRate": "3.38",
    "salePerAnswerRate": "6.14",
    "salePerContactRate": "11.25",
    "durationGe5mRate": "14.50",
    "avgDurationSeconds": null,
    "totalDurationSeconds": null,
    "avgLeadAgeDays": "1.02",
    "activations": null,
    "recordedValue": null
  },
  "cliPerformance": [
    {
      "cli": "0875501001",
      "campaign": "MTN_DIRECT",
      "vendor": "Unavailable",
      "reportDate": "2026-09-20",
      "totalCalls": "1500",
      "distinctLeads": "1200",
      "callsPerLead": "1.25",
      "asrCount": "900",
      "asrRate": "60.00",
      "answeredCount": "800",
      "answeredRate": "53.33",
      "contactCount": "450",
      "contactRate": "30.00",
      "saleCount": "45",
      "salePerCallRate": "3.00",
      "salePerAnswerRate": "5.63",
      "salePerContactRate": "10.00",
      "durationGe1mCount": "600",
      "durationGe1mPct": "40.00",
      "durationGe5mCount": "200",
      "durationGe5mPct": "13.33",
      "durationGe15mCount": "30",
      "durationGe15mPct": "2.00",
      "avgDurationSeconds": null,
      "totalDurationSeconds": null,
      "avgLeadAgeDays": "0.85",
      "activations": null,
      "recordedValue": null,
      "valuePerCall": null,
      "valuePerLead": null,
      "hasAnomalies": false,
      "anomalies": []
    },
    {
      "cli": "0875501002",
      "campaign": "MTN_UPSELL",
      "vendor": "Unavailable",
      "reportDate": "2026-09-21",
      "totalCalls": "2500",
      "distinctLeads": "2000",
      "callsPerLead": "1.25",
      "asrCount": "1600",
      "asrRate": "64.00",
      "answeredCount": "1400",
      "answeredRate": "56.00",
      "contactCount": "750",
      "contactRate": "30.00",
      "saleCount": "90",
      "salePerCallRate": "3.60",
      "salePerAnswerRate": "6.43",
      "salePerContactRate": "12.00",
      "durationGe1mCount": "1050",
      "durationGe1mPct": "42.00",
      "durationGe5mCount": "380",
      "durationGe5mPct": "15.20",
      "durationGe15mCount": "50",
      "durationGe15mPct": "2.00",
      "avgDurationSeconds": null,
      "totalDurationSeconds": null,
      "avgLeadAgeDays": "1.20",
      "activations": null,
      "recordedValue": null,
      "valuePerCall": null,
      "valuePerLead": null,
      "hasAnomalies": false,
      "anomalies": []
    }
  ],
  "trend": [
    {
      "date": "2026-09-20",
      "totalCalls": 1500,
      "contactRate": 30,
      "saleRate": 3,
      "answeredRate": 53.33,
      "asrRate": 60,
      "durationGe5mRate": 13.33
    },
    {
      "date": "2026-09-21",
      "totalCalls": 2500,
      "contactRate": 30,
      "saleRate": 3.6,
      "answeredRate": 56,
      "asrRate": 64,
      "durationGe5mRate": 15.2
    }
  ],
  "durationBands": {
    "under1mCount": "2350",
    "under1mPct": "58.75",
    "oneTo5mCount": "1070",
    "oneTo5mPct": "26.75",
    "fiveTo15mCount": "500",
    "fiveTo15mPct": "12.50",
    "over15mCount": "80",
    "over15mPct": "2.00",
    "totalDurationSeconds": null,
    "avgDurationSeconds": null,
    "medianDurationSeconds": null
  },
  "leadAgeBands": {
    "bands": [
      {
        "band": "< 15 min",
        "callCount": "0",
        "callSharePct": "0.00",
        "contactCount": "0",
        "contactRatePct": "0.00",
        "saleCount": "0",
        "salePerCallRatePct": "0.00"
      },
      {
        "band": "15–60 min",
        "callCount": "0",
        "callSharePct": "0.00",
        "contactCount": "0",
        "contactRatePct": "0.00",
        "saleCount": "0",
        "salePerCallRatePct": "0.00"
      },
      {
        "band": "1–4 hours",
        "callCount": "0",
        "callSharePct": "0.00",
        "contactCount": "0",
        "contactRatePct": "0.00",
        "saleCount": "0",
        "salePerCallRatePct": "0.00"
      },
      {
        "band": "4–24 hours",
        "callCount": "0",
        "callSharePct": "0.00",
        "contactCount": "0",
        "contactRatePct": "0.00",
        "saleCount": "0",
        "salePerCallRatePct": "0.00"
      },
      {
        "band": "1–2 days",
        "callCount": "0",
        "callSharePct": "0.00",
        "contactCount": "0",
        "contactRatePct": "0.00",
        "saleCount": "0",
        "salePerCallRatePct": "0.00"
      },
      {
        "band": "2–3 days",
        "callCount": "0",
        "callSharePct": "0.00",
        "contactCount": "0",
        "contactRatePct": "0.00",
        "saleCount": "0",
        "salePerCallRatePct": "0.00"
      },
      {
        "band": "3+ days",
        "callCount": "0",
        "callSharePct": "0.00",
        "contactCount": "0",
        "contactRatePct": "0.00",
        "saleCount": "0",
        "salePerCallRatePct": "0.00"
      }
    ],
    "avgLeadAgeDays": "1.07",
    "medianLeadAgeDays": null,
    "joinReliability": "SOURCE_REPORTED_ESTIMATE",
    "disclaimer": "The imported report supplies only average lead age. CX3 does not infer a lead-age distribution or median from aggregate averages."
  },
  "campaigns": [],
  "periodComparison": null,
  "fieldCoverage": [],
  "anomalies": [],
  "metadata": {
    "clientId": "synthetic-a",
    "startDate": "2026-09-20",
    "endDate": "2026-09-21",
    "filters": {},
    "modelVersion": "synthetic regression fixture",
    "generatedAt": "2026-09-30T06:00:00Z",
    "rowCount": 2,
    "validationStatus": "NOT_VERIFIED"
  }
};

export const secondaryMaturityPayloads: Record<string, unknown> = {
  "/api/analytics/vetting": {
    "current": {
      "leads": "150",
      "classRecorded": "120",
      "recognisedClass": "110",
      "colourRecorded": "100",
      "namedColour": "90",
      "bothRecorded": "85",
      "withHlc": "140",
      "valid": "130",
      "invalid": "10",
      "unknownValidity": "10",
      "delivered": "140",
      "called": "135",
      "rpc": "95",
      "sales": "40",
      "activations": "30",
      "classTimed": "115",
      "colourTimed": "95",
      "classBeforeCapture": "0",
      "colourBeforeCapture": "0",
      "classInvalidTime": "0",
      "colourInvalidTime": "0",
      "classFutureTime": "0",
      "colourFutureTime": "0",
      "classMeanSeconds": "12.5",
      "colourMeanSeconds": "14.2"
    },
    "previous": {
      "leads": "140",
      "classRecorded": "110",
      "recognisedClass": "100",
      "colourRecorded": "95",
      "namedColour": "85",
      "bothRecorded": "80",
      "withHlc": "130",
      "valid": "120",
      "invalid": "10",
      "unknownValidity": "10",
      "delivered": "130",
      "called": "125",
      "rpc": "90",
      "sales": "35",
      "activations": "25",
      "classTimed": "105",
      "colourTimed": "90",
      "classBeforeCapture": "0",
      "colourBeforeCapture": "0",
      "classInvalidTime": "0",
      "colourInvalidTime": "0",
      "classFutureTime": "0",
      "colourFutureTime": "0",
      "classMeanSeconds": "13.1",
      "colourMeanSeconds": "15.0"
    },
    "groups": [],
    "diagnostics": [
      {
        "period": "current",
        "sourceRows": "150",
        "missingIdRows": "0",
        "conflictingLeads": "0",
        "conflictingRows": "0",
        "duplicateRowsCollapsed": "0",
        "eligibleUniqueLeads": "150"
      }
    ],
    "timing": [
      {
        "kind": "Class",
        "sample": "115",
        "meanSeconds": "12.5",
        "medianSeconds": "10.0",
        "p90Seconds": "25.0"
      }
    ],
    "fields": {
      "leadClass": {
            "sourceField": "offershop_grade",
            "available": true
      },
      "leadColour": {
            "sourceField": "offershop_color_vetting",
            "available": true
      },
      "leadClassDate": {
            "sourceField": "offershop_grade_date",
            "available": true
      },
      "leadColourDate": {
            "sourceField": "offershop_color_vetting_date",
            "available": true
      },
      "lead_id": {
            "sourceField": "lead_id",
            "available": true
      },
      "fetched": {
            "sourceField": "fetched",
            "available": true
      },
      "offershop_source": {
            "sourceField": "offershop_source",
            "available": true
      },
      "offernet_medium": {
            "sourceField": "offernet_medium",
            "available": true
      },
      "valid_lead": {
            "sourceField": "valid_lead",
            "available": true
      },
      "valid_idno": {
            "sourceField": "valid_idno",
            "available": true
      },
      "phone_valid": {
            "sourceField": "phone_valid",
            "available": true
      },
      "hlc.vendor": {
            "sourceField": "hlc_details.vendor",
            "available": true
      },
      "hlc.delivered": {
            "sourceField": "hlc_details.delivered",
            "available": true
      },
      "hlc.first_call_date": {
            "sourceField": "hlc_details.first_call_date",
            "available": true
      },
      "hlc.rpc": {
            "sourceField": "hlc_details.rpc",
            "available": true
      },
      "hlc.sale": {
            "sourceField": "hlc_details.sale",
            "available": true
      },
      "hlc.activated": {
            "sourceField": "hlc_details.activated",
            "available": true
      },
      "hlcRecords": {
            "sourceField": "hlc_details",
            "available": true
      }
},
    "scope": {
      "clientId": "synthetic-a",
      "startDate": "2026-09-01",
      "endDate": "2026-09-14",
      "previousStart": "2026-08-18",
      "previousEnd": "2026-08-31",
      "days": 14,
      "interval": "week",
      "classValue": null,
      "colourValue": null,
      "filters": {}
    },
    "evidence": {
      "version": "cx.vetting.1.0.0",
      "table": "synthetic regression fixture",
      "jobId": "mock-vetting-job-123",
      "referencedTables": [
        "synthetic regression fixture"
      ],
      "bytesProcessed": "1024000",
      "generatedAt": "2026-09-26T20:00:00.000Z",
      "snapshotPinned": false,
      "validationStatus": "SOURCE_QUERY_NOT_INDEPENDENTLY_RECONCILED"
    },
    "notes": [
      "No snapshot is pinned. Existing regression fixture counts; no live source was queried. Grouped classifications were not supplied."
    ]
  },
  "/api/analytics/warehouse/overview": {
    "generatedAt": "2026-09-30T06:00:00Z",
    "evidence": {
      "status": "CATALOGUE_ONLY",
      "snapshotDate": "2026-09-29",
      "liveDataQueried": false,
      "reason": "Synthetic saved catalogue; source access is unmeasured."
    },
    "kpis": {
      "totalProjects": 1,
      "totalDatasets": 1,
      "totalWarehouseObjects": 1
    },
    "datasets": [
      {
        "project": "synthetic-project",
        "dataset": "synthetic_dataset",
        "totalObjects": 1,
        "tablesCount": 1,
        "viewsCount": 0,
        "totalColumns": 1,
        "families": [],
        "sampleObjects": [
          "synthetic_table"
        ],
        "status": "CATALOGUE_ONLY",
        "description": "Synthetic registered schema evidence."
      }
    ],
    "projects": [],
    "tableInventoryPreview": []
  },
  "/api/analytics/warehouse/tables": [
    {
      "project": "synthetic-project",
      "dataset": "synthetic_dataset",
      "tableName": "synthetic_table",
      "tableType": "TABLE",
      "columns": [
        {
          "name": "synthetic_field",
          "type": "STRING"
        }
      ],
      "family": "synthetic",
      "disposition": "synthetic",
      "analyticalGrain": "Synthetic source rows",
      "dateFields": [],
      "candidateKeys": [],
      "sensitiveFields": []
    }
  ]
,
  "/api/analytics/cohorts": Array.from({ length: 16 }, (_, index) => ({ ...cohortRegressionRow, cohort: `C${index}` })),
  "/api/analytics/cli-performance": { ...cliRegressionReport, metricDefinitions: CLI_METRIC_DEFINITIONS },
};

export const secondaryMaturityScopes: Record<string, string> = {
  '/vetting': '?clientId=synthetic-a&startDate=2026-09-01&endDate=2026-09-14',
  '/cli-performance': '?clientId=synthetic-a&startDate=2026-09-20&endDate=2026-09-21',
};
