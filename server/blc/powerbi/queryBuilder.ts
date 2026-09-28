import {
  RUBIX_DATASET_ID,
  RUBIX_REPORT_ID,
  RUBIX_MODEL_ID,
  RUBIX_ENTITY,
  RUBIX_COMPANY_PREDICATE,
  type RubixQueryType,
} from '../../../contracts/rubixPowerBi';
import { RUBIX_QUERY_SPECS } from './queryRegistry';

export interface DateRangeBounds {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface QueryFilters {
  team?: string;
  segment?: string;
  agent?: string;
}

export interface PowerBiSemanticQueryPayload {
  version: string;
  queries: Array<{
    Query: {
      Commands: Array<{
        SemanticQueryDataShapeCommand: {
          Query: {
            Version: number;
            From: Array<{ Name: string; Entity: string; Type: number }>;
            Select: Array<Record<string, unknown>>;
            Where?: Array<{ Condition: Record<string, unknown> }>;
            OrderBy?: Array<{ Direction: number; Expression: Record<string, unknown> }>;
          };
          Binding: {
            Primary: {
              Groupings: Array<{ Projections: number[] }>;
            };
            DataReduction: {
              DataVolume: number;
              Primary: {
                Window: {
                  Count: number;
                };
              };
            };
            Version: number;
          };
          ExecutionMetricsKind: number;
        };
      }>;
    };
    ApplicationContext: {
      DatasetId: string;
      Sources: Array<{
        ReportId: string;
        VisualId?: string;
      }>;
    };
  }>;
  cancelQueries: unknown[];
  modelId: number;
}

const VISUAL_IDS: Record<RubixQueryType, string> = {
  activation_over_time: 'visual_act_over_time_v1',
  activation_by_team: 'visual_act_by_team_v1',
  activation_by_segment: 'visual_act_by_segment_v1',
  activation_by_agent_and_team: 'visual_act_by_agent_team_v1',
  capture_complete_over_time: 'visual_cap_over_time_v1',
  capture_complete_by_team: 'visual_cap_by_team_v1',
  capture_complete_by_segment: 'visual_cap_by_segment_v1',
  capture_complete_by_agent_and_team: 'visual_cap_by_agent_team_v1',
};

/**
 * Validates and normalizes date range.
 * Bounded between 1 and 366 days.
 * End date is inclusive.
 */
export function validateDateRange(startStr?: string, endStr?: string): DateRangeBounds {
  const now = new Date();
  const defaultEnd = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const defaultStart = thirtyDaysAgo.toISOString().slice(0, 10);

  const startDate = startStr && /^\d{4}-\d{2}-\d{2}$/.test(startStr) ? startStr : defaultStart;
  const endDate = endStr && /^\d{4}-\d{2}-\d{2}$/.test(endStr) ? endStr : defaultEnd;

  const tStart = Date.parse(`${startDate}T00:00:00Z`);
  const tEnd = Date.parse(`${endDate}T00:00:00Z`);

  if (isNaN(tStart) || isNaN(tEnd)) {
    throw new Error('Invalid date parameters. Dates must be YYYY-MM-DD.');
  }
  if (tStart > tEnd) {
    throw new Error('Start date must be before or equal to end date.');
  }

  const diffDays = Math.round((tEnd - tStart) / 86400000) + 1;
  if (diffDays > 366) {
    throw new Error('Date window exceeds maximum allowed window of 366 days.');
  }

  return { startDate, endDate };
}

/**
 * Builds the mandatory company filter condition: `company_name Contains 'ONtact'`.
 */
export function buildCompanyCondition(): { Condition: Record<string, unknown> } {
  return {
    Condition: {
      In: {
        Expressions: [
          {
            Column: {
              Expression: { SourceRef: { Source: 'b' } },
              Property: 'company_name',
            },
          },
        ],
        Values: [
          [
            {
              Literal: { Value: `'${RUBIX_COMPANY_PREDICATE}'` },
            },
          ],
        ],
      },
    },
  };
}

/**
 * Builds date range filter condition on eventDateField (inclusive start of day to end of day).
 */
export function buildDateRangeCondition(
  eventDateField: 'activation' | 'capture_complete',
  dates: DateRangeBounds
): { Condition: Record<string, unknown> } {
  return {
    Condition: {
      Between: {
        Expression: {
          Column: {
            Expression: { SourceRef: { Source: 'b' } },
            Property: eventDateField,
          },
        },
        LowerBound: {
          Literal: { Value: `datetime'${dates.startDate}T00:00:00'` },
        },
        UpperBound: {
          Literal: { Value: `datetime'${dates.endDate}T23:59:59.999'` },
        },
      },
    },
  };
}

/**
 * Builds equality filter condition for dimension string values (team, segment, agent).
 */
export function buildEqualityCondition(property: string, value: string): { Condition: Record<string, unknown> } {
  // Escape single quotes to prevent injection
  const escaped = value.replace(/'/g, "''");
  return {
    Condition: {
      Comparison: {
        ComparisonKind: 0,
        Left: {
          Column: {
            Expression: { SourceRef: { Source: 'b' } },
            Property: property,
          },
        },
        Right: {
          Literal: { Value: `'${escaped}'` },
        },
      },
    },
  };
}

/**
 * Builds a typed Power BI SemanticQueryDataShapeCommand request payload.
 */
export function buildPowerBiSemanticQuery(
  queryType: RubixQueryType,
  dates: DateRangeBounds,
  filters: QueryFilters = {}
): PowerBiSemanticQueryPayload {
  const spec = RUBIX_QUERY_SPECS[queryType];
  if (!spec) {
    throw new Error(`Unsupported query type: ${queryType}`);
  }

  const { eventDateField } = spec;
  const whereConditions: Array<{ Condition: Record<string, unknown> }> = [
    buildCompanyCondition(),
    buildDateRangeCondition(eventDateField, dates),
  ];

  if (filters.team) {
    whereConditions.push(buildEqualityCondition('team_name', filters.team));
  }
  if (filters.segment) {
    whereConditions.push(buildEqualityCondition('segment', filters.segment));
  }
  if (filters.agent) {
    whereConditions.push(buildEqualityCondition('full_name', filters.agent));
  }

  let select: Array<Record<string, unknown>> = [];
  let orderBy: Array<{ Direction: number; Expression: Record<string, unknown> }> = [];
  let groupings: Array<{ Projections: number[] }> = [];

  const sourceRef = { SourceRef: { Source: 'b' } };

  if (queryType.endsWith('_over_time')) {
    select = [
      {
        Column: {
          Expression: sourceRef,
          Property: eventDateField,
        },
        Name: `${RUBIX_ENTITY}.${eventDateField}`,
        NativeReferenceName: eventDateField,
      },
      {
        Aggregation: {
          Expression: {
            Column: {
              Expression: sourceRef,
              Property: eventDateField,
            },
          },
          Function: 5, // CountNonNull
        },
        Name: `CountNonNull(${RUBIX_ENTITY}.${eventDateField})`,
        NativeReferenceName: 'count',
      },
    ];
    orderBy = [
      {
        Direction: 1, // ASC
        Expression: {
          Column: {
            Expression: sourceRef,
            Property: eventDateField,
          },
        },
      },
    ];
    groupings = [{ Projections: [0, 1] }];
  } else if (queryType.endsWith('_by_team')) {
    select = [
      {
        Column: {
          Expression: sourceRef,
          Property: 'team_name',
        },
        Name: `${RUBIX_ENTITY}.team_name`,
        NativeReferenceName: 'team_name',
      },
      {
        Aggregation: {
          Expression: {
            Column: {
              Expression: sourceRef,
              Property: eventDateField,
            },
          },
          Function: 5,
        },
        Name: `CountNonNull(${RUBIX_ENTITY}.${eventDateField})`,
        NativeReferenceName: 'count',
      },
    ];
    orderBy = [
      {
        Direction: 2, // DESC
        Expression: {
          Aggregation: {
            Expression: {
              Column: {
                Expression: sourceRef,
                Property: eventDateField,
              },
            },
            Function: 5,
          },
        },
      },
    ];
    groupings = [{ Projections: [0, 1] }];
  } else if (queryType.endsWith('_by_segment')) {
    select = [
      {
        Column: {
          Expression: sourceRef,
          Property: 'segment',
        },
        Name: `${RUBIX_ENTITY}.segment`,
        NativeReferenceName: 'segment',
      },
      {
        Aggregation: {
          Expression: {
            Column: {
              Expression: sourceRef,
              Property: eventDateField,
            },
          },
          Function: 5,
        },
        Name: `CountNonNull(${RUBIX_ENTITY}.${eventDateField})`,
        NativeReferenceName: 'count',
      },
    ];
    orderBy = [
      {
        Direction: 2,
        Expression: {
          Aggregation: {
            Expression: {
              Column: {
                Expression: sourceRef,
                Property: eventDateField,
              },
            },
            Function: 5,
          },
        },
      },
    ];
    groupings = [{ Projections: [0, 1] }];
  } else if (queryType.endsWith('_by_agent_and_team')) {
    // Note: uses contract_key with function 5 (CountNonNull).
    // Name uses captured label Sum(blue_label_reporting wow_data.contract_key) as in template.
    select = [
      {
        Column: {
          Expression: sourceRef,
          Property: 'team_name',
        },
        Name: `${RUBIX_ENTITY}.team_name`,
        NativeReferenceName: 'team_name',
      },
      {
        Column: {
          Expression: sourceRef,
          Property: 'full_name',
        },
        Name: `${RUBIX_ENTITY}.full_name`,
        NativeReferenceName: 'full_name',
      },
      {
        Aggregation: {
          Expression: {
            Column: {
              Expression: sourceRef,
              Property: 'contract_key',
            },
          },
          Function: 5,
        },
        Name: `Sum(${RUBIX_ENTITY}.contract_key)`,
        NativeReferenceName: 'count',
      },
    ];
    orderBy = [
      {
        Direction: 2,
        Expression: {
          Aggregation: {
            Expression: {
              Column: {
                Expression: sourceRef,
                Property: 'contract_key',
              },
            },
            Function: 5,
          },
        },
      },
    ];
    groupings = [{ Projections: [0, 1, 2] }];
  }

  const windowLimit = queryType.includes('agent') ? 500 : 1000;

  return {
    version: '1.0.0',
    queries: [
      {
        Query: {
          Commands: [
            {
              SemanticQueryDataShapeCommand: {
                Query: {
                  Version: 2,
                  From: [
                    {
                      Name: 'b',
                      Entity: RUBIX_ENTITY,
                      Type: 0,
                    },
                  ],
                  Select: select,
                  Where: whereConditions,
                  OrderBy: orderBy,
                },
                Binding: {
                  Primary: {
                    Groupings: groupings,
                  },
                  DataReduction: {
                    DataVolume: 3,
                    Primary: {
                      Window: {
                        Count: windowLimit,
                      },
                    },
                  },
                  Version: 1,
                },
                ExecutionMetricsKind: 1,
              },
            },
          ],
        },
        ApplicationContext: {
          DatasetId: RUBIX_DATASET_ID,
          Sources: [
            {
              ReportId: RUBIX_REPORT_ID,
              VisualId: VISUAL_IDS[queryType],
            },
          ],
        },
      },
    ],
    cancelQueries: [],
    modelId: RUBIX_MODEL_ID,
  };
}
