import { sourceTable } from './sourceCatalog';
import { flatSchema, sourceAccess, type SourceAccess } from './sourceAccess';

export async function parameterCoverage(clientId: string, access: SourceAccess = sourceAccess(clientId)) {
  const table = sourceTable(clientId, 'leads');
  let unavailable = 0;
  const parameters: any[] = [];

  const expectedFields = [
    'sub_source', 'campaign_id', 'adset_id', 'creative_id', 'click_id', 'gclid', 'fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'
  ];

  try {
    if (table) {
      const meta = await access.metadata(table);
      const fields = flatSchema(meta.schema?.fields || []);
      for (const field of expectedFields) {
        if (!fields.has(field)) {
          unavailable++;
          parameters.push({
            parameter: field,
            status: 'UNAVAILABLE',
            mappedField: null,
            coverage: null,
          });
        } else {
          parameters.push({
            parameter: field,
            status: 'PRESENT_UNVERIFIED',
            mappedField: field,
            coverage: null,
          });
        }
      }
    } else {
      unavailable = expectedFields.length;
      for (const field of expectedFields) {
        parameters.push({
          parameter: field,
          status: 'UNAVAILABLE',
          mappedField: null,
          coverage: null,
        });
      }
    }
  } catch {
    unavailable = expectedFields.length;
    for (const field of expectedFields) {
      parameters.push({
        parameter: field,
        status: 'UNAVAILABLE',
        mappedField: null,
        coverage: null,
      });
    }
  }

  return {
    parameters,
    summary: {
      total: expectedFields.length,
      unavailable,
      populated: null,
      populationStatus: 'NOT_MEASURED',
    },
  };
}
