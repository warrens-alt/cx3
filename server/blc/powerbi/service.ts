import {
  RUBIX_DATASET_ID,
  RUBIX_REPORT_ID,
  RUBIX_MODEL_ID,
  RUBIX_ENTITY,
  RUBIX_COMPANY_PREDICATE,
  RUBIX_POWERBI_VERSION,
  type RubixQueryType,
  type RubixReportResponse,
  type RubixReportRow,
  type RubixStatusResponse,
  type RubixReconciliationResponse,
} from '../../../contracts/rubixPowerBi';
import { getRubixPowerBiConfig, type RubixPowerBiConfig } from './config';
import { RUBIX_QUERY_SPECS, RUBIX_SUPPORTED_FILTERS, RUBIX_UNSUPPORTED_FILTERS } from './queryRegistry';
import { buildPowerBiSemanticQuery, validateDateRange, type DateRangeBounds, type QueryFilters } from './queryBuilder';
import { decodePowerBiResponse } from './decoder';

interface CacheEntry {
  expiresAt: number;
  data: RubixReportResponse;
}

export class RubixPowerBiService {
  private config: RubixPowerBiConfig;
  private cache = new Map<string, CacheEntry>();
  private activeRequests = 0;
  private queue: Array<() => void> = [];

  constructor(config: RubixPowerBiConfig = getRubixPowerBiConfig()) {
    this.config = config;
  }

  public updateConfig(config: RubixPowerBiConfig) {
    this.config = config;
    this.cache.clear();
  }

  public getStatus(): RubixStatusResponse {
    const now = new Date().toISOString();
    const commonMeta = {
      checkedAt: now,
      provider: 'rubix_powerbi',
      endpoint: this.config.endpoint,
      datasetId: RUBIX_DATASET_ID,
      reportId: RUBIX_REPORT_ID,
      modelId: RUBIX_MODEL_ID,
      entity: RUBIX_ENTITY,
      mandatoryPredicate: `company_name Contains '${RUBIX_COMPANY_PREDICATE}'`,
    };

    if (!this.config.enabled) {
      return {
        enabled: false,
        configured: Boolean(this.config.resourceKey),
        status: 'DISABLED',
        note: 'Rubix Power BI connector is disabled. Enable with RUBIX_POWERBI_ENABLED=true under data-sharing governance.',
        ...commonMeta,
      };
    }
    if (!this.config.resourceKey) {
      return {
        enabled: true,
        configured: false,
        status: 'UNCONFIGURED',
        note: 'Upstream resource key is missing. No business records are substituted.',
        ...commonMeta,
      };
    }
    return {
      enabled: true,
      configured: true,
      status: 'CONFIGURED_NOT_CHECKED',
      note: 'Configured for read-only queries. Key presence does not verify upstream access, source freshness or reconciliation.',
      ...commonMeta,
    };
  }

  private async acquireConcurrencySlot(): Promise<void> {
    if (this.activeRequests < this.config.maxConcurrent) {
      this.activeRequests++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
    this.activeRequests++;
  }

  private releaseConcurrencySlot(): void {
    this.activeRequests--;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  public async executeReport(
    queryType: RubixQueryType,
    rawDates: { startDate?: string; endDate?: string },
    filters: QueryFilters,
    userContext: { clientId: string; isAdmin: boolean; subject?: string }
  ): Promise<RubixReportResponse> {
    const spec = RUBIX_QUERY_SPECS[queryType];
    if (!spec) {
      throw new Error(`Unsupported query type: ${queryType}`);
    }

    const dates = validateDateRange(rawDates.startDate, rawDates.endDate);
    const nowIso = new Date().toISOString();

    if (!this.config.enabled) {
      return this.buildPlaceholderReport(
        queryType,
        dates,
        filters,
        userContext,
        'DISABLED',
        ['Rubix Power BI connector is disabled by configuration (RUBIX_POWERBI_ENABLED=false).']
      );
    }

    // Missing credentials remain unavailable; demonstration data never enters reporting.
    if (!this.config.resourceKey) {
      return this.buildPlaceholderReport(
        queryType,
        dates,
        filters,
        userContext,
        'UNCONFIGURED',
        ['Rubix Power BI connector is not configured (missing RUBIX_POWERBI_RESOURCE_KEY).']
      );
    }

    // Cache lookup key
    const cacheKey = JSON.stringify([
      userContext.clientId, userContext.subject || '',
      queryType,
      dates.startDate,
      dates.endDate,
      filters.team || '',
      filters.segment || '',
      filters.agent || '',
      userContext.isAdmin,
    ]);

    const cached = this.cache.get(cacheKey);
    const nowEpoch = Date.now();
    if (cached && cached.expiresAt > nowEpoch) {
      const cacheAgeSeconds = Math.round((nowEpoch - (cached.expiresAt - this.config.cacheTtlSeconds * 1000)) / 1000);
      return {
        ...cached.data,
        metadata: {
          ...cached.data.metadata,
          cacheAgeSeconds,
        },
      };
    }

    const payload = buildPowerBiSemanticQuery(queryType, dates, filters);

    await this.acquireConcurrencySlot();
    let upstreamJson: unknown;
    let providerResponseTimestamp: string | null = null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'X-PowerBI-ResourceKey': this.config.resourceKey,
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        redirect: 'error',
        signal: controller.signal,
      });

      providerResponseTimestamp = new Date().toISOString();

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new Error(`Upstream rate limit exceeded (429). Retry after ${retryAfter || '30'} seconds.`);
        }
        if (response.status === 403 || response.status === 401) {
          throw new Error(`Upstream authorization rejected (HTTP ${response.status}). Verify RUBIX_POWERBI_RESOURCE_KEY.`);
        }
        throw new Error(`Upstream HTTP error ${response.status}. No records were substituted.`);
      }

      upstreamJson = await response.json();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isTimeout = errorMsg.includes('aborted') || errorMsg.includes('timeout');
      

      return this.buildPlaceholderReport(
        queryType,
        dates,
        filters,
        userContext,
        isTimeout ? 'TIMEOUT' : 'UPSTREAM_ERROR',
        [`Failed to fetch Power BI data: ${errorMsg}`]
      );
    } finally {
      clearTimeout(timer);
      this.releaseConcurrencySlot();
    }

    // Decode response
    let decoded: ReturnType<typeof decodePowerBiResponse>;
    try { decoded = decodePowerBiResponse(upstreamJson, queryType); } catch {
      return this.buildPlaceholderReport(queryType, dates, filters, userContext, 'UPSTREAM_ERROR', ['The provider response could not be decoded. No records were substituted.']);
    }
    if (decoded.completenessStatus === 'UNKNOWN') {
      return this.buildPlaceholderReport(queryType, dates, filters, userContext, 'UPSTREAM_ERROR', decoded.warnings.length ? decoded.warnings : ['Provider completeness is unknown.']);
    }

    // Apply staff detail masking for non-admins if query includes agent names
    const staffDetailsMasked = spec.staffDetailRequired && !userContext.isAdmin;
    const processedRows = decoded.rows.map((row) => {
      if (staffDetailsMasked && row.agent) {
        return {
          ...row,
          agent: maskAgentName(row.agent),
        };
      }
      return row;
    });

    const report: RubixReportResponse = {
      metadata: {
        provider: 'rubix_powerbi',
        datasetId: RUBIX_DATASET_ID,
        reportId: RUBIX_REPORT_ID,
        modelId: RUBIX_MODEL_ID,
        templateVersion: RUBIX_POWERBI_VERSION,
        queryType,
        metricId: spec.metricId,
        aggregation: spec.aggregation,
        requestedScope: {
          clientId: userContext.clientId,
          startDate: dates.startDate,
          endDate: dates.endDate,
          team: filters.team,
          segment: filters.segment,
          agent: filters.agent,
        },
        appliedScope: {
          companyFilter: 'ONtact',
          startDate: dates.startDate,
          endDate: dates.endDate,
          team: filters.team,
          segment: filters.segment,
          agent: filters.agent,
        },
        supportedFilters: RUBIX_SUPPORTED_FILTERS,
        unsupportedFilters: RUBIX_UNSUPPORTED_FILTERS,
        eventDateField: spec.eventDateField,
        intervalConvention: 'inclusive_calendar_day',
        timezoneStatus: 'source_as_reported_no_shift',
        queriedAt: nowIso,
        providerResponseTimestamp,
        sourceRefreshedAt: null, // Upstream does not certify refresh timestamp
        maxObservedEventDate: decoded.summary.maxDate,
        cacheAgeSeconds: 0,
        queryStatus: processedRows.length === 0 ? 'EMPTY' : decoded.truncation ? 'PARTIAL' : 'SUCCESS',
        completenessStatus: decoded.completenessStatus,
        truncation: decoded.truncation,
        warnings: decoded.warnings,
        reconciliationStatus: 'INDEPENDENT_SOURCE_NOT_RECONCILED',
        staffDetailsMasked,
        provenance: 'LIVE_POWERBI',
      },
      summary: decoded.summary,
      rows: processedRows,
    };

    // Store in cache
    this.cache.set(cacheKey, {
      expiresAt: Date.now() + this.config.cacheTtlSeconds * 1000,
      data: report,
    });

    return report;
  }

  public async getReconciliation(
    rawDates: { startDate?: string; endDate?: string },
    userContext: { clientId: string; isAdmin: boolean; subject?: string }
  ): Promise<RubixReconciliationResponse> {
    const dates = validateDateRange(rawDates.startDate, rawDates.endDate);
    const powerBiReport = await this.executeReport(
      'activation_by_team',
      dates,
      {},
      userContext
    );

    const live = powerBiReport.metadata.provenance === 'LIVE_POWERBI';
    return {
      version: RUBIX_POWERBI_VERSION,
      reconciledAt: new Date().toISOString(), // Check time, not a claim of reconciliation.
      clientId: userContext.clientId, dateRange: { startDate: dates.startDate, endDate: dates.endDate },
      warehouseActivations: {
        sourceTable: 'dashboards-422710.lead_ledger.tbl_blc_activations',
        verifiedMandates: null, distinctPolicies: null, currency: 'ZAR', status: 'NOT_QUERIED_NOT_RECONCILED',
      },
      powerBiActivations: {
        datasetId: RUBIX_DATASET_ID, reportId: RUBIX_REPORT_ID,
        totalReported: live ? powerBiReport.summary.totalCount : null,
        distinctTeams: live ? powerBiReport.summary.distinctTeams : null,
        distinctAgents: null, // A team query does not establish distinct agents.
        provenance: live ? 'LIVE_POWERBI' : 'UNAVAILABLE', status: powerBiReport.metadata.queryStatus,
      },
      reconciliationStatus: 'UNVERIFIED',
      variance: {
        deltaCount: null,
        explanation: 'No approved record-level identity, population and date-basis reconciliation has been executed between these sources. A banking or fulfilment explanation cannot be inferred.',
        reconciliationNotes: [
          'Warehouse totals and verified mandate counts remain unavailable until independently queried under an approved contract.',
          'Power BI results, when readable, are independent source-reported counts, not ledger-certified activations.',
          'No missing count is replaced by a historical example or a synthetic value.',
          'Report request time is not the upstream refresh time.',
        ],
      },
    };
  }

  private buildPlaceholderReport(
    queryType: RubixQueryType,
    dates: DateRangeBounds,
    filters: QueryFilters,
    userContext: { clientId: string; isAdmin: boolean },
    queryStatus: 'DISABLED' | 'UNCONFIGURED' | 'UPSTREAM_ERROR' | 'TIMEOUT' | 'UNSUPPORTED_FILTER',
    warnings: string[]
  ): RubixReportResponse {
    const spec = RUBIX_QUERY_SPECS[queryType];
    return {
      metadata: {
        provider: 'rubix_powerbi',
        datasetId: RUBIX_DATASET_ID,
        reportId: RUBIX_REPORT_ID,
        modelId: RUBIX_MODEL_ID,
        templateVersion: RUBIX_POWERBI_VERSION,
        queryType,
        metricId: spec?.metricId || 'rubix.unknown',
        aggregation: spec?.aggregation || 'CountNonNull',
        requestedScope: {
          clientId: userContext.clientId,
          startDate: dates.startDate,
          endDate: dates.endDate,
          team: filters.team,
          segment: filters.segment,
          agent: filters.agent,
        },
        appliedScope: {
          companyFilter: 'ONtact',
          startDate: dates.startDate,
          endDate: dates.endDate,
        },
        supportedFilters: RUBIX_SUPPORTED_FILTERS,
        unsupportedFilters: RUBIX_UNSUPPORTED_FILTERS,
        eventDateField: spec?.eventDateField || 'activation',
        intervalConvention: 'inclusive_calendar_day',
        timezoneStatus: 'source_as_reported_no_shift',
        queriedAt: new Date().toISOString(),
        providerResponseTimestamp: null,
        sourceRefreshedAt: null,
        maxObservedEventDate: null,
        cacheAgeSeconds: 0,
        queryStatus,
        completenessStatus: 'UNKNOWN',
        truncation: false,
        warnings,
        reconciliationStatus: 'NOT_APPLICABLE',
        provenance: 'UNAVAILABLE',
      },
      summary: {
        totalCount: null,
        rowCount: 0,
        minDate: null,
        maxDate: null,
        distinctTeams: null,
        distinctSegments: null,
        distinctAgents: null,
      },
      rows: [],
    };
  }
}

function maskAgentName(name: string): string {
  if (!name || name.trim().length === 0) return 'Agent (Unassigned)';
  // Mask name for viewers: e.g. "John Smith" -> "Agent J*** S***"
  const parts = name.trim().split(/\s+/);
  const maskedParts = parts.map(p => (p.length > 0 ? `${p[0]}***` : '***'));
  return `Agent ${maskedParts.join(' ')}`;
}

export const defaultRubixPowerBiService = new RubixPowerBiService();
