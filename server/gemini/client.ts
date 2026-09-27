import { GoogleGenAI } from '@google/genai';

/**
 * Server-side Google Gemini client for ConversionX.
 * Follows Google AI Studio build guidelines:
 * - Uses modern @google/genai SDK
 * - Telemetry User-Agent 'aistudio-build'
 * - Model 'gemini-3.8-flash' (or fallback 'gemini-flash-latest')
 * - Grounded strictly on measured BigQuery analytical outputs
 */

let cachedAiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAiClient;
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}

export interface GeminiHealthStatus {
  status: 'Connected' | 'Not Configured' | 'Error';
  model: string;
  hasKey: boolean;
  latencyMs?: number;
  error?: string;
}

export async function checkGeminiHealth(): Promise<GeminiHealthStatus> {
  const hasKey = hasGeminiKey();
  if (!hasKey) {
    return {
      status: 'Not Configured',
      model: 'gemini-3.8-flash',
      hasKey: false,
      error: 'GEMINI_API_KEY environment variable is not set. Deterministic rule-based insights active.',
    };
  }

  const start = Date.now();
  try {
    const ai = getGeminiClient();
    if (!ai) {
      return { status: 'Not Configured', model: 'gemini-3.8-flash', hasKey: false };
    }
    // Lightweight ping to verify model connection
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Respond with exactly "OK" if operational.',
    });
    const latencyMs = Date.now() - start;
    if (response && response.text) {
      return { status: 'Connected', model: 'gemini-3.8-flash', hasKey: true, latencyMs };
    }
    return { status: 'Connected', model: 'gemini-3.8-flash', hasKey: true, latencyMs };
  } catch (err: any) {
    return {
      status: 'Error',
      model: 'gemini-3.8-flash',
      hasKey: true,
      latencyMs: Date.now() - start,
      error: err?.message || 'Failed to communicate with Gemini API',
    };
  }
}

export interface OperationalContext {
  clientName: string;
  currency?: string;
  currentWindow?: { startDate?: string; endDate?: string };
  previousWindow?: { startDate?: string; endDate?: string };
  overviewMetrics?: Record<string, any>;
  exceptions?: Array<{ id: string; title: string; count: number; severity: string; detail: string }>;
  drivers?: Array<{ dimension: string; name: string; delta?: number; contribution?: number }>;
  funnelStages?: Array<{ stage: string; count: number; conversionRate?: number }>;
}

export interface GroundedAiInsightsResult {
  executiveSummary: string;
  strategicFocus: string;
  insights: Array<{
    category: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    finding: string;
    metricReference: string;
    directive: string;
  }>;
}

export async function generateGroundedAiInsights(
  context: OperationalContext,
  deterministicFallback: GroundedAiInsightsResult
): Promise<{ result: GroundedAiInsightsResult; source: 'GOOGLE_GEMINI_AI' | 'DETERMINISTIC_MEASURED_ANALYTICS'; model?: string }> {
  const ai = getGeminiClient();
  if (!ai) {
    return { result: deterministicFallback, source: 'DETERMINISTIC_MEASURED_ANALYTICS' };
  }

  try {
    const prompt = `You are a Principal Revenue Operations and Analytics Architect evaluating operational performance for client "${context.clientName}".
You are provided with verified BigQuery operational metrics, matched-period changes, exceptions, and driver decompositions.

STRICT ACCURACY RULES:
1. Every number, percentage, count, and date you mention MUST come directly from the data below.
2. NEVER invent synthetic benchmarks, conversion rates, or fabricated totals.
3. Every insight must cite its metric reference path.
4. Keep the executive summary crisp, authoritative, and focused on operational turnaround and SLA compliance.

MEASURED DATA:
${JSON.stringify(context, null, 2)}

Provide your analysis strictly as a valid JSON object matching this schema:
{
  "executiveSummary": "2-3 sentences summarizing the key performance shift and conversion efficiency across the measured window.",
  "strategicFocus": "1 sentence defining the highest-priority operational intervention required.",
  "insights": [
    {
      "category": "Matched-period change" | "Vendor SLA compliance" | "Funnel leakage" | "Contact turnaround" | "Exception queue",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "finding": "Clear concise observation citing the exact numbers.",
      "metricReference": "The metric path e.g. root-cause.leadToSaleRate or exceptions.zero-call-leads",
      "directive": "Actionable, precise recommendation for contact center and operations leads."
    }
  ]
}
Return only the JSON object. Do not wrap in markdown or backticks if possible, or use standard json formatting.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text?.trim() || '';
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned) as GroundedAiInsightsResult;

    if (parsed && parsed.executiveSummary && Array.isArray(parsed.insights) && parsed.insights.length > 0) {
      return {
        result: {
          executiveSummary: parsed.executiveSummary,
          strategicFocus: parsed.strategicFocus || 'Maintain tight contact SLA monitoring across high-volume vendor feeds.',
          insights: parsed.insights.slice(0, 6).map(item => ({
            category: item.category || 'Operational Insight',
            severity: ['HIGH', 'MEDIUM', 'LOW'].includes(item.severity) ? item.severity : 'MEDIUM',
            finding: item.finding,
            metricReference: item.metricReference || 'operational.measured',
            directive: item.directive,
          })),
        },
        source: 'GOOGLE_GEMINI_AI',
        model: 'gemini-3.8-flash',
      };
    }
  } catch (error) {
    console.warn('Gemini operational insights generation fell back to deterministic summaries:', error);
  }

  return { result: deterministicFallback, source: 'DETERMINISTIC_MEASURED_ANALYTICS' };
}

export async function askGeminiAnalytics(
  question: string,
  context: OperationalContext
): Promise<{ answer: string; model: string; citations: string[] }> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      answer: `Gemini AI key is not currently configured on this server. To enable real-time conversational analysis, configure GEMINI_API_KEY. Based on measured records for ${context.clientName}, observe the verified funnel and exception indicators directly.`,
      model: 'deterministic-fallback',
      citations: context.exceptions?.map(e => `${e.title}: ${e.count.toLocaleString()} leads`) || [],
    };
  }

  const prompt = `You are the ConversionX Google Gemini Analytics Assistant.
Client workspace: "${context.clientName}".
Question from operator: "${question}".

MEASURED BIGQUERY CONTEXT:
${JSON.stringify(context, null, 2)}

GUIDELINES:
1. Answer the operator's question directly, clearly, and concisely (2-4 paragraphs max).
2. Reference ONLY the numbers and dimensions present in the provided context. If data is not present to answer a question, explicitly state that the metric is unavailable or not independently verified.
3. List 1 to 4 exact metric citations supporting your answer.

Format your response as a JSON object:
{
  "answer": "Your comprehensive, grounded response.",
  "citations": ["citation 1", "citation 2"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const raw = response.text?.trim() || '';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      answer: parsed.answer || 'Analysis complete based on measured workspace records.',
      model: 'gemini-3.8-flash',
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
    };
  } catch (err: any) {
    return {
      answer: `Could not process query via Gemini API: ${err?.message || 'Service request failed'}. Please consult the measured data panels directly.`,
      model: 'gemini-3.8-flash',
      citations: [],
    };
  }
}
