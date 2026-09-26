import type { OffernetQueryParams } from '../common/types';

// AI OPERATIONAL INSIGHTS (Gemini API with @google/genai)
export async function getAiInsightsAnalytics(_params: OffernetQueryParams) {
  return {
    insights: [],
    source: 'disabled',
    status: 'UNAVAILABLE',
    reason: 'AI operational summaries are disabled until every upstream metric supplied to the model is independently validated.'
  };
}
