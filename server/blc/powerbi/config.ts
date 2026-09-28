/**
 * Rubix Power BI server configuration and environment settings.
 * All credentials and upstream resource keys stay strictly on the server.
 */

export interface RubixPowerBiConfig {
  enabled: boolean;
  resourceKey: string;
  endpoint: string;
  timeoutMs: number;
  cacheTtlSeconds: number;
  maxConcurrent: number;
}

const DEFAULT_ENDPOINT = 'https://wabi-south-africa-north-a-primary-api.analysis.windows.net/public/reports/querydata?synchronous=true';

export function getRubixPowerBiConfig(env: NodeJS.ProcessEnv = process.env): RubixPowerBiConfig {
  const enabled = env.RUBIX_POWERBI_ENABLED === 'true';
  const resourceKey = String(env.RUBIX_POWERBI_RESOURCE_KEY || '').trim();
  const timeoutMs = Math.max(1000, Number(env.RUBIX_POWERBI_TIMEOUT_MS) || 30000);
  const cacheTtlSeconds = Math.max(10, Number(env.RUBIX_POWERBI_CACHE_TTL_SECONDS) || 300);
  const maxConcurrent = Math.max(1, Math.min(10, Number(env.RUBIX_POWERBI_MAX_CONCURRENT) || 2));

  return {
    enabled,
    resourceKey,
    endpoint: DEFAULT_ENDPOINT,
    timeoutMs,
    cacheTtlSeconds,
    maxConcurrent,
  };
}

export function isRubixPowerBiConfigured(config: RubixPowerBiConfig = getRubixPowerBiConfig()): boolean {
  return config.enabled && Boolean(config.resourceKey);
}
