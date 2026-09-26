/**
 * CLI Performance & Dialler Intelligence Analytics Service
 * 
 * Implements:
 * 1. Live BigQuery schema discovery and grouped SQL queries at the raw call event grain
 * 2. Visible schema gap reporting when underlying table lacks CLI column
 * 3. CSV report ingestion aligned to the observed OfferNet daily CLI export schema
 * 4. Exact decimal aggregation (SUM/SUM, never AVG of percentages)
 * 5. Explicit withholding when matched historical populations are unavailable
 * 6. Duration-band and source-reported lead-age evidence without inferred distributions
 */

import {
  type CliPerformanceRecord,
  type CliSummary,
  type CliDurationBands,
  type CliLeadAgeBands,
  type CliPeriodComparison,
  type CliTrendPoint,
  type CliCampaignAggregate,
  type CliValidationAnomaly,
  type CliPerformanceResponse,
  type CliProvenance,
  type CliFieldCoverage,
  CLI_METRIC_DEFINITIONS,
  calculateExactRate,
} from '../../contracts/cliPerformance';
import { getClientConfig, tableIdentifier, tenantVendorScopeValues } from './config';
import { flatSchema, sourceAccess, type SourceAccess, type TableMetadata } from './sourceAccess';
import { sourceTable } from './sourceCatalog';
import { RequestError, validateScope, conditionSql, type QueryScope, type Scalar } from './filters';
import { validTimestampSql } from './integrity';
import { exactDecimal, addExactDecimals, compareExactDecimal, subtractExactDecimals, divideExactDecimal } from '../../contracts/exactDecimal';

// In-memory tenant cache for imported CLI reports
interface TenantImportCache {
  uploadedAt: string;
  filename: string;
  records: CliPerformanceRecord[];
  trend: CliTrendPoint[];
  leadAgeBands: CliLeadAgeBands;
  anomalies: CliValidationAnomaly[];
}

const importStore = new Map<string, TenantImportCache>();

export function getTenantImport(clientId: string): TenantImportCache | null {
  return importStore.get(clientId) || null;
}

export function setTenantImport(clientId: string, data: TenantImportCache): void {
  importStore.set(clientId, data);
}

export function clearTenantImport(clientId: string): boolean {
  return importStore.delete(clientId);
}

/** Possible column aliases for CLI in call tables */
const CLI_COLUMN_CANDIDATES = [
  'cli',
  'caller_id',
  'outbound_cid',
  'source_cli',
  'phone_presentation',
  'cli_number',
  'dialer_caller_id',
  'outbound_caller_id',
];

/** Check if table has a CLI field */
export function findCliColumn(fields: Map<string, { type: string }>): string | null {
  for (const candidate of CLI_COLUMN_CANDIDATES) {
    if (fields.has(candidate)) return candidate;
  }
  return null;
}

/** Parse and validate CSV data */
export function parseAndValidateCliCsv(csvText: string, filename = 'imported_report.csv'): {
  records: CliPerformanceRecord[];
  trend: CliTrendPoint[];
  leadAgeBands: CliLeadAgeBands;
  anomalies: CliValidationAnomaly[];
  errors: string[];
} {
  const errors: string[] = [];
  const anomalies: CliValidationAnomaly[] = [];
  const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    errors.push('CSV report must contain at least a header row and one data row.');
    return { records: [], trend: [], leadAgeBands: emptyLeadAgeBands(), anomalies, errors };
  }

  // Parse header
  const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  const headerMap = new Map<string, number>();
  rawHeaders.forEach((h, i) => headerMap.set(h, i));

  // Determine key column indices
  const getCol = (...candidates: string[]): number => {
    for (const c of candidates) {
      if (headerMap.has(c)) return headerMap.get(c)!;
    }
    return -1;
  };

  const cliIdx = getCol('cli_number', 'cli', 'caller_id', 'outbound_cid', 'phone_number');
  const campaignIdx = getCol('campaign_code', 'campaign', 'campaign_id', 'campaign_name');
  const callsIdx = getCol('total_calls', 'calls', 'call_count');
  const dateIdx = getCol('report_date', 'date', 'call_date');

  if (cliIdx === -1) {
    errors.push("Missing required CLI column. Expected 'cli_number', 'cli', or 'caller_id'.");
  }
  if (campaignIdx === -1) {
    errors.push("Missing required campaign column. Expected 'campaign_code', 'campaign', or 'campaign_id'.");
  }
  if (callsIdx === -1) {
    errors.push("Missing required call volume column. Expected 'total_calls' or 'calls'.");
  }
  if (dateIdx === -1) {
    errors.push("Missing required report date column. Expected 'report_date', 'date', or 'call_date'.");
  }
  if (campaignIdx === -1) {
    errors.push("Missing required campaign column. Expected 'campaign_code', 'campaign', or 'campaign_id'.");
  }
  if (dateIdx === -1) {
    errors.push("Missing required report date column. Expected 'report_date', 'date', or 'call_date'.");
  }

  if (errors.length > 0) {
    return { records: [], trend: [], leadAgeBands: emptyLeadAgeBands(), anomalies, errors };
  }

  const distinctLeadsIdx = getCol('distinct_leads', 'unique_leads', 'leads_dialled');
  const asrCountIdx = getCol('asr_count', 'asr');
  const asrPctIdx = getCol('asr_pct', 'asr_rate');
  const answeredCountIdx = getCol('answered_count', 'answered');
  const answeredPctIdx = getCol('answered_pct', 'answer_rate');
  const contactCountIdx = getCol('contact_count', 'contact', 'rpc_count', 'rpcs');
  const contactPctIdx = getCol('contact_pct', 'contact_rate', 'rpc_rate');
  const saleCountIdx = getCol('sale_count', 'sales', 'sale');
  const salePctIdx = getCol('sale_pct', 'sale_rate');
  const d1mCountIdx = getCol('duration_ge_1m_count', 'duration_1m_count', 'ge_1m');
  const d1mPctIdx = getCol('duration_ge_1m_pct', 'duration_1m_pct');
  const d5mCountIdx = getCol('duration_ge_5m_count', 'duration_5m_count', 'ge_5m');
  const d5mPctIdx = getCol('duration_ge_5m_pct', 'duration_5m_pct');
  const d15mCountIdx = getCol('duration_ge_15m_count', 'duration_15m_count', 'ge_15m');
  const d15mPctIdx = getCol('duration_ge_15m_pct', 'duration_15m_pct');
  const avgDurationIdx = getCol('avg_duration_sec', 'avg_duration', 'duration_avg');
  const avgLeadAgeIdx = getCol('avg_lead_age_days', 'lead_age_days', 'avg_lead_age');
  const vendorIdx = getCol('vendor', 'vendor_name');
  const activationsIdx = getCol('activations', 'activation_count');
  const revenueIdx = getCol('revenue', 'recorded_value', 'value');

  if (contactCountIdx === -1) errors.push("Missing required RPC/contact count column. Expected 'contact_count', 'rpc_count', or 'rpcs'.");
  if (saleCountIdx === -1) errors.push("Missing required sale count column. Expected 'sale_count', 'sales', or 'sale'.");
  if (errors.length > 0) {
    return { records: [], trend: [], leadAgeBands: emptyLeadAgeBands(), anomalies, errors };
  }

  const records: CliPerformanceRecord[] = [];
  const trendMap = new Map<string, { calls: number; contacts: number; sales: number; answered: number; duration5m: number; duration5mKnown: boolean }>();

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const rawLine = lines[rowIdx];
    // Split on commas while respecting quotes
    const cells = rawLine.match(/(?:[^\s",]+|"[^"]*")+/g)?.map(c => c.trim().replace(/^["']|["']$/g, '')) || rawLine.split(',');

    const cli = (cells[cliIdx] || '').trim();
    if (!cli) {
      anomalies.push({
        type: 'MISSING_DATE',
        severity: 'WARNING',
        cli: 'Row ' + rowIdx,
        message: `Row ${rowIdx} is missing a CLI identifier. Record skipped.`,
      });
      continue;
    }

    // Validate CLI format: should not contain control chars or invalid sequences
    if (cli.length < 3 || /[^\d+\-() ]/.test(cli)) {
      anomalies.push({
        type: 'INVALID_CLI_FORMAT',
        severity: 'INFO',
        cli,
        message: `CLI '${cli}' contains unusual characters or format.`,
      });
    }

    const campaign = campaignIdx !== -1 && cells[campaignIdx] ? cells[campaignIdx].trim() : 'Unavailable';
    const vendor = vendorIdx !== -1 && cells[vendorIdx] ? cells[vendorIdx].trim() : 'Unavailable';
    const totalCallsNum = Math.max(0, parseInt(cells[callsIdx] || '0', 10) || 0);
    const totalCalls = String(totalCallsNum);

    if (totalCallsNum === 0) continue;

    const distinctLeadsNum = distinctLeadsIdx !== -1 && cells[distinctLeadsIdx]
      ? Math.max(1, parseInt(cells[distinctLeadsIdx], 10) || 1)
      : null;
    const distinctLeads = distinctLeadsNum === null ? null : String(Math.min(distinctLeadsNum, totalCallsNum));
    const callsPerLead = distinctLeadsNum === null ? null : (totalCallsNum / distinctLeadsNum).toFixed(2);

    // Counts
    const asrCount = asrCountIdx !== -1 && cells[asrCountIdx] ? String(Math.max(0, parseInt(cells[asrCountIdx], 10) || 0)) : null;
    const answeredCount = answeredCountIdx !== -1 && cells[answeredCountIdx] ? String(Math.max(0, parseInt(cells[answeredCountIdx], 10) || 0)) : null;
    const contactCountNum = contactCountIdx !== -1 && cells[contactCountIdx] ? Math.max(0, parseInt(cells[contactCountIdx], 10) || 0) : 0;
    const contactCount = String(contactCountNum);
    const saleCountNum = saleCountIdx !== -1 && cells[saleCountIdx] ? Math.max(0, parseInt(cells[saleCountIdx], 10) || 0) : 0;
    const saleCount = String(saleCountNum);

    // Duration counts remain unavailable unless supplied by the source report.
    const d1mNum = d1mCountIdx !== -1 && cells[d1mCountIdx] ? Math.max(0, parseInt(cells[d1mCountIdx], 10) || 0) : null;
    const d5mNum = d5mCountIdx !== -1 && cells[d5mCountIdx] ? Math.max(0, parseInt(cells[d5mCountIdx], 10) || 0) : null;
    const d15mNum = d15mCountIdx !== -1 && cells[d15mCountIdx] ? Math.max(0, parseInt(cells[d15mCountIdx], 10) || 0) : null;

    const durationGe1mCount = d1mNum === null ? null : String(Math.min(d1mNum, totalCallsNum));
    const durationGe5mCount = d5mNum === null ? null : String(Math.min(d5mNum, totalCallsNum));
    const durationGe15mCount = d15mNum === null ? null : String(Math.min(d15mNum, totalCallsNum));

    // Calculate exact rates from counts
    const asrRate = asrCount ? calculateExactRate(asrCount, totalCalls) : (asrPctIdx !== -1 && cells[asrPctIdx] ? parsePct(cells[asrPctIdx]) : null);
    const answeredRate = answeredCount ? calculateExactRate(answeredCount, totalCalls) : (answeredPctIdx !== -1 && cells[answeredPctIdx] ? parsePct(cells[answeredPctIdx]) : null);
    const contactRate = calculateExactRate(contactCount, totalCalls) || '0.00';
    const salePerCallRate = calculateExactRate(saleCount, totalCalls) || '0.00';
    const salePerAnswerRate = answeredCount && Number(answeredCount) > 0 ? calculateExactRate(saleCount, answeredCount) : null;
    const salePerContactRate = contactCountNum > 0 ? calculateExactRate(saleCount, contactCount) : null;

    const durationGe1mPct = durationGe1mCount === null ? null : calculateExactRate(durationGe1mCount, totalCalls);
    const durationGe5mPct = durationGe5mCount === null ? null : calculateExactRate(durationGe5mCount, totalCalls);
    const durationGe15mPct = durationGe15mCount === null ? null : calculateExactRate(durationGe15mCount, totalCalls);

    const avgDuration = avgDurationIdx !== -1 && cells[avgDurationIdx] && Number.isFinite(Number(cells[avgDurationIdx]))
      ? Math.max(0, parseFloat(cells[avgDurationIdx])).toFixed(1)
      : null;
    const totalDurationSeconds = avgDuration === null ? null : String(Math.round(totalCallsNum * parseFloat(avgDuration)));

    const avgLeadAgeDays = avgLeadAgeIdx !== -1 && cells[avgLeadAgeIdx] ? parseFloat(cells[avgLeadAgeIdx]).toFixed(2) : null;

    const activations = activationsIdx !== -1 && cells[activationsIdx] ? String(Math.max(0, parseInt(cells[activationsIdx], 10) || 0)) : null;
    const recordedValue = revenueIdx !== -1 && cells[revenueIdx] ? String(Math.max(0, parseFloat(cells[revenueIdx]) || 0)) : null;
    const valuePerCall = recordedValue ? (parseFloat(recordedValue) / totalCallsNum).toFixed(2) : null;
    const valuePerLead = recordedValue && distinctLeadsNum !== null ? (parseFloat(recordedValue) / distinctLeadsNum).toFixed(2) : null;

    const reportedRates = {
      asr: asrPctIdx !== -1 && cells[asrPctIdx] ? parsePct(cells[asrPctIdx]) : null,
      answered: answeredPctIdx !== -1 && cells[answeredPctIdx] ? parsePct(cells[answeredPctIdx]) : null,
      contact: contactPctIdx !== -1 && cells[contactPctIdx] ? parsePct(cells[contactPctIdx]) : null,
      salePerContact: salePctIdx !== -1 && cells[salePctIdx] ? parsePct(cells[salePctIdx]) : null,
      duration1m: d1mPctIdx !== -1 && cells[d1mPctIdx] ? parsePct(cells[d1mPctIdx]) : null,
      duration5m: d5mPctIdx !== -1 && cells[d5mPctIdx] ? parsePct(cells[d5mPctIdx]) : null,
      duration15m: d15mPctIdx !== -1 && cells[d15mPctIdx] ? parsePct(cells[d15mPctIdx]) : null,
    };

    // Mathematical Sanity & Anomaly Checks
    const rowAnomalies: string[] = [];
    const validateRate = (label: string, reported: string | null, derived: string | null) => {
      if (reported === null || derived === null) return;
      const difference = Math.abs(Number(reported) - Number(derived));
      if (!Number.isFinite(difference)) return;
      if (difference > 0.2) {
        anomalies.push({
          type: 'PERCENTAGE_MISMATCH',
          severity: 'WARNING',
          cli,
          message: `${label} in the source report (${reported}%) differs from count-derived ${derived}% by ${difference.toFixed(2)}pp.`,
          rawValues: { reported, derived },
        });
        rowAnomalies.push(`${label} percentage mismatch`);
      }
    };

    validateRate('ASR', reportedRates.asr, asrCount ? calculateExactRate(asrCount, totalCalls) : null);
    validateRate('Answered rate', reportedRates.answered, answeredCount ? calculateExactRate(answeredCount, totalCalls) : null);
    validateRate('RPC rate', reportedRates.contact, contactRate);
    // In the observed OfferNet daily export sale_pct is Sale / RPC, not Sale / Call.
    validateRate('Sale / RPC rate', reportedRates.salePerContact, salePerContactRate);
    validateRate('Calls ≥1m share', reportedRates.duration1m, durationGe1mPct);
    validateRate('Calls ≥5m share', reportedRates.duration5m, durationGe5mPct);
    validateRate('Calls ≥15m share', reportedRates.duration15m, durationGe15mPct);
    if (saleCountNum > totalCallsNum) {
      anomalies.push({
        type: 'SALES_EXCEED_CALLS',
        severity: 'CRITICAL',
        cli,
        message: `Sale count (${saleCountNum}) exceeds total call attempts (${totalCallsNum}). Mathematically impossible.`,
      });
      rowAnomalies.push('Sales exceed calls');
    }

    if (saleCountNum > contactCountNum && contactCountNum > 0) {
      anomalies.push({
        type: 'SALES_EXCEED_CONTACTS',
        severity: 'WARNING',
        cli,
        message: `Sale count (${saleCountNum}) exceeds Right Party Contacts (${contactCountNum}). Possible non-RPC attribution or callback sales.`,
        rawValues: { saleCount: saleCountNum, contactCount: contactCountNum },
      });
      rowAnomalies.push('Sales exceed RPC contacts');
    }

    if (avgDuration !== null && parseFloat(avgDuration) < 0) {
      anomalies.push({
        type: 'NEGATIVE_DURATION',
        severity: 'CRITICAL',
        cli,
        message: `Average duration cannot be negative (${avgDuration}s).`,
      });
      rowAnomalies.push('Negative call duration');
    }

    // Trend grouping uses only source-provided dates.
    const rawDate = dateIdx !== -1 && cells[dateIdx] ? cells[dateIdx].trim().slice(0, 10) : '';
    const reportDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && Number.isFinite(Date.parse(rawDate)) ? rawDate : null;
    if (rawDate && !reportDate) {
      anomalies.push({
        type: 'MISSING_DATE',
        severity: 'WARNING',
        cli,
        message: `Report date '${rawDate}' is invalid and was excluded from the trend.`,
      });
    }
    if (reportDate) {
      const existingTrend = trendMap.get(reportDate) || { calls: 0, contacts: 0, sales: 0, answered: 0, duration5m: 0, duration5mKnown: false };
      existingTrend.calls += totalCallsNum;
      existingTrend.contacts += contactCountNum;
      existingTrend.sales += saleCountNum;
      if (answeredCount) existingTrend.answered += parseInt(answeredCount, 10) || 0;
      if (d5mNum !== null) {
        existingTrend.duration5m += d5mNum;
        existingTrend.duration5mKnown = true;
      }
      trendMap.set(reportDate, existingTrend);
    }

    records.push({
      cli,
      campaign,
      vendor,
      reportDate,
      totalCalls,
      distinctLeads,
      callsPerLead,
      asrCount,
      asrRate,
      answeredCount,
      answeredRate,
      contactCount,
      contactRate,
      saleCount,
      salePerCallRate,
      salePerAnswerRate,
      salePerContactRate,
      durationGe1mCount,
      durationGe1mPct,
      durationGe5mCount,
      durationGe5mPct,
      durationGe15mCount,
      durationGe15mPct,
      avgDurationSeconds: avgDuration,
      totalDurationSeconds,
      avgLeadAgeDays,
      activations,
      recordedValue,
      valuePerCall,
      valuePerLead,
      hasAnomalies: rowAnomalies.length > 0,
      anomalies: rowAnomalies,
    });
  }

  // Construct trend
  const trend: CliTrendPoint[] = Array.from(trendMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, t]) => ({
      date,
      totalCalls: t.calls,
      contactRate: t.calls > 0 ? Number(((t.contacts / t.calls) * 100).toFixed(2)) : 0,
      saleRate: t.calls > 0 ? Number(((t.sales / t.calls) * 100).toFixed(2)) : 0,
      answeredRate: t.calls > 0 && t.answered > 0 ? Number(((t.answered / t.calls) * 100).toFixed(2)) : null,
      asrRate: null,
      durationGe5mRate: t.duration5mKnown && t.calls > 0 ? Number(((t.duration5m / t.calls) * 100).toFixed(2)) : null,
    }));

  // Construct Lead Age Bands
  const leadAgeBands = computeLeadAgeBands(records);

  return { records, trend, leadAgeBands, anomalies, errors };
}

function parsePct(val: string): string | null {
  const clean = val.replace('%', '').trim();
  const num = parseFloat(clean);
  if (!Number.isFinite(num)) return null;
  // If provided as 0.05 instead of 5%
  if (num > 0 && num <= 1 && clean.includes('.')) {
    return (num * 100).toFixed(2);
  }
  return num.toFixed(2);
}

function emptyLeadAgeBands(): CliLeadAgeBands {
  return {
    bands: [
      { band: '< 15 min', callCount: '0', callSharePct: '0.00', contactCount: '0', contactRatePct: '0.00', saleCount: '0', salePerCallRatePct: '0.00' },
      { band: '15–60 min', callCount: '0', callSharePct: '0.00', contactCount: '0', contactRatePct: '0.00', saleCount: '0', salePerCallRatePct: '0.00' },
      { band: '1–4 hours', callCount: '0', callSharePct: '0.00', contactCount: '0', contactRatePct: '0.00', saleCount: '0', salePerCallRatePct: '0.00' },
      { band: '4–24 hours', callCount: '0', callSharePct: '0.00', contactCount: '0', contactRatePct: '0.00', saleCount: '0', salePerCallRatePct: '0.00' },
      { band: '1–2 days', callCount: '0', callSharePct: '0.00', contactCount: '0', contactRatePct: '0.00', saleCount: '0', salePerCallRatePct: '0.00' },
      { band: '2–3 days', callCount: '0', callSharePct: '0.00', contactCount: '0', contactRatePct: '0.00', saleCount: '0', salePerCallRatePct: '0.00' },
      { band: '3+ days', callCount: '0', callSharePct: '0.00', contactCount: '0', contactRatePct: '0.00', saleCount: '0', salePerCallRatePct: '0.00' },
    ],
    avgLeadAgeDays: null,
    medianLeadAgeDays: null,
    joinReliability: 'UNAVAILABLE',
    disclaimer: 'Observed association only; not proof of causation.',
  };
}

function computeLeadAgeBands(records: CliPerformanceRecord[]): CliLeadAgeBands {
  const observed = records
    .map(record => ({ age: record.avgLeadAgeDays, calls: Number(record.totalCalls || 0) }))
    .filter((item): item is { age: string; calls: number } => item.age !== null && Number.isFinite(Number(item.age)) && item.calls > 0);

  if (!observed.length) return emptyLeadAgeBands();

  const weightedCalls = observed.reduce((sum, item) => sum + item.calls, 0);
  const weightedAge = observed.reduce((sum, item) => sum + Number(item.age) * item.calls, 0);
  const result = emptyLeadAgeBands();
  result.avgLeadAgeDays = weightedCalls > 0 ? (weightedAge / weightedCalls).toFixed(2) : null;
  result.joinReliability = 'SOURCE_REPORTED_ESTIMATE';
  result.disclaimer = 'The imported report supplies only average lead age. CX3 does not infer a lead-age distribution or median from aggregate averages.';
  return result;
}

/** Compute aggregated summary across records using SUM/SUM exact math */
export function computeCliSummary(records: CliPerformanceRecord[]): CliSummary {
  let totalCallsBig = 0n;
  let distinctLeadsBig = 0n;
  let hasCompleteDistinctLeads = records.length > 0;
  let totalContactsBig = 0n;
  let totalSalesBig = 0n;
  let totalAnsweredBig = 0n;
  let hasAnswered = false;
  let totalAsrBig = 0n;
  let hasAsr = false;
  let totalD5mBig = 0n;
  let hasDuration5m = false;
  let totalDurationSec = 0n;
  let hasDurationTotal = false;
  let activationsBig = 0n;
  let hasActivations = false;
  let recordedValueSum = 0;
  let hasRevenue = false;

  for (const r of records) {
    const calls = BigInt(r.totalCalls);
    totalCallsBig += calls;
    if (r.distinctLeads === null) {
      hasCompleteDistinctLeads = false;
    } else {
      distinctLeadsBig += BigInt(r.distinctLeads);
    }
    totalContactsBig += BigInt(r.contactCount);
    totalSalesBig += BigInt(r.saleCount);
    if (r.durationGe5mCount !== null) {
      hasDuration5m = true;
      totalD5mBig += BigInt(r.durationGe5mCount);
    }
    if (r.totalDurationSeconds !== null) {
      hasDurationTotal = true;
      totalDurationSec += BigInt(r.totalDurationSeconds);
    }

    if (r.answeredCount !== null) {
      hasAnswered = true;
      totalAnsweredBig += BigInt(r.answeredCount);
    }
    if (r.asrCount !== null) {
      hasAsr = true;
      totalAsrBig += BigInt(r.asrCount);
    }
    if (r.activations !== null) {
      hasActivations = true;
      activationsBig += BigInt(r.activations);
    }
    if (r.recordedValue !== null) {
      hasRevenue = true;
      recordedValueSum += parseFloat(r.recordedValue);
    }
  }

  const totalCalls = totalCallsBig.toString();
  const distinctLeads = hasCompleteDistinctLeads ? distinctLeadsBig.toString() : null;
  const callsPerLead = hasCompleteDistinctLeads && distinctLeadsBig > 0n
    ? (Number(totalCallsBig) / Number(distinctLeadsBig)).toFixed(2)
    : null;

  const asrCount = hasAsr ? totalAsrBig.toString() : null;
  const asrRate = hasAsr && totalCallsBig > 0n ? calculateExactRate(totalAsrBig.toString(), totalCalls) : null;

  const answeredCount = hasAnswered ? totalAnsweredBig.toString() : null;
  const answeredRate = hasAnswered && totalCallsBig > 0n ? calculateExactRate(totalAnsweredBig.toString(), totalCalls) : null;

  const contactCount = totalContactsBig.toString();
  const contactRate = calculateExactRate(contactCount, totalCalls) || '0.00';

  const saleCount = totalSalesBig.toString();
  const salePerCallRate = calculateExactRate(saleCount, totalCalls) || '0.00';
  const salePerAnswerRate = hasAnswered && totalAnsweredBig > 0n ? calculateExactRate(saleCount, totalAnsweredBig.toString()) : null;
  const salePerContactRate = totalContactsBig > 0n ? calculateExactRate(saleCount, contactCount) : null;

  const durationGe5mRate = hasDuration5m && totalCallsBig > 0n ? calculateExactRate(totalD5mBig.toString(), totalCalls) : null;
  const avgDurationSeconds = hasDurationTotal && totalCallsBig > 0n ? (Number(totalDurationSec) / Number(totalCallsBig)).toFixed(1) : null;

  const validAges = records.map(r => r.avgLeadAgeDays).filter(Boolean).map(Number);
  const avgLeadAgeDays = validAges.length > 0 ? (validAges.reduce((a, b) => a + b, 0) / validAges.length).toFixed(2) : null;

  return {
    totalCalls,
    activeClis: records.length,
    distinctLeads,
    callsPerLead,
    asrCount,
    asrRate,
    answeredCount,
    answeredRate,
    contactCount,
    contactRate,
    saleCount,
    salePerCallRate,
    salePerAnswerRate,
    salePerContactRate,
    durationGe5mRate,
    avgDurationSeconds,
    totalDurationSeconds: hasDurationTotal ? totalDurationSec.toString() : null,
    avgLeadAgeDays,
    activations: hasActivations ? activationsBig.toString() : null,
    recordedValue: hasRevenue ? recordedValueSum.toFixed(2) : null,
  };
}

/** Compute duration bands (<1m, 1-5m, 5-15m, 15m+) */
export function computeDurationBands(records: CliPerformanceRecord[]): CliDurationBands {
  const unavailable = (): CliDurationBands => ({
    under1mCount: null,
    under1mPct: null,
    oneTo5mCount: null,
    oneTo5mPct: null,
    fiveTo15mCount: null,
    fiveTo15mPct: null,
    over15mCount: null,
    over15mPct: null,
    totalDurationSeconds: null,
    avgDurationSeconds: null,
    medianDurationSeconds: null,
  });

  if (!records.length || records.some(record =>
    record.durationGe1mCount === null ||
    record.durationGe5mCount === null ||
    record.durationGe15mCount === null
  )) return unavailable();

  let totalCalls = 0;
  let ge1m = 0;
  let ge5m = 0;
  let ge15m = 0;
  let totalSec = 0;
  let hasCompleteDurationSeconds = true;

  for (const record of records) {
    totalCalls += parseInt(record.totalCalls, 10) || 0;
    ge1m += parseInt(record.durationGe1mCount!, 10) || 0;
    ge5m += parseInt(record.durationGe5mCount!, 10) || 0;
    ge15m += parseInt(record.durationGe15mCount!, 10) || 0;
    if (record.totalDurationSeconds === null) {
      hasCompleteDurationSeconds = false;
    } else {
      totalSec += parseInt(record.totalDurationSeconds, 10) || 0;
    }
  }

  if (totalCalls <= 0) return unavailable();

  const under1m = Math.max(0, totalCalls - ge1m);
  const oneTo5m = Math.max(0, ge1m - ge5m);
  const fiveTo15m = Math.max(0, ge5m - ge15m);

  return {
    under1mCount: String(under1m),
    under1mPct: ((under1m / totalCalls) * 100).toFixed(2),
    oneTo5mCount: String(oneTo5m),
    oneTo5mPct: ((oneTo5m / totalCalls) * 100).toFixed(2),
    fiveTo15mCount: String(fiveTo15m),
    fiveTo15mPct: ((fiveTo15m / totalCalls) * 100).toFixed(2),
    over15mCount: String(ge15m),
    over15mPct: ((ge15m / totalCalls) * 100).toFixed(2),
    totalDurationSeconds: hasCompleteDurationSeconds ? String(totalSec) : null,
    avgDurationSeconds: hasCompleteDurationSeconds ? (totalSec / totalCalls).toFixed(1) : null,
    medianDurationSeconds: null,
  };
}

/** Compute period comparison and deterministic observations */
export function computePeriodComparison(
  _records: CliPerformanceRecord[],
  _scope: QueryScope
): CliPeriodComparison | null {
  // A matched comparison requires event rows or a source-provided historical series
  // that can be filtered to the same CLI/campaign/vendor scope. Aggregate snapshots
  // are insufficient, so CX3 deliberately withholds this comparison.
  return null;
}

/** Generate realistic Benchmark / Sample CLI Dataset for testing & demonstration */
export function generateBenchmarkCliDataset(): {
  records: CliPerformanceRecord[];
  trend: CliTrendPoint[];
  leadAgeBands: CliLeadAgeBands;
  anomalies: CliValidationAnomaly[];
} {
  const cliNumbers = [
    { cli: '0870570010', campaign: 'MTN_POSTPAID_RETENTION', vendor: 'Ontact - BLC', calls: 14250, rpcRate: 0.184, saleRate: 0.021, avgSec: 165 },
    { cli: '0870570011', campaign: 'MTN_POSTPAID_RETENTION', vendor: 'Ontact - BLC', calls: 12840, rpcRate: 0.176, saleRate: 0.019, avgSec: 152 },
    { cli: '0870570012', campaign: 'MONDO_SIM_ONLY_UPGRADE', vendor: 'Mondo Connect', calls: 11920, rpcRate: 0.162, saleRate: 0.016, avgSec: 140 },
    { cli: '0870570014', campaign: 'BLC_CELLULAR_ACQUISITION', vendor: 'Ontact - BLC', calls: 9840, rpcRate: 0.192, saleRate: 0.024, avgSec: 180 },
    { cli: '0870570015', campaign: 'BLC_CELLULAR_ACQUISITION', vendor: 'Ontact - BLC', calls: 8650, rpcRate: 0.158, saleRate: 0.015, avgSec: 135 },
    { cli: '0870570018', campaign: 'REAL_PROMOTIONS_DIRECT', vendor: 'Real Promotions', calls: 7420, rpcRate: 0.142, saleRate: 0.012, avgSec: 118 },
    { cli: '0870570020', campaign: 'DEBT_RESCUE_OUTBOUND', vendor: 'Debt Rescue', calls: 6980, rpcRate: 0.215, saleRate: 0.028, avgSec: 195 },
    { cli: '0870570022', campaign: 'NAGA_LOANS_DIALLER', vendor: 'Naga Financial', calls: 5840, rpcRate: 0.138, saleRate: 0.011, avgSec: 110 },
    { cli: '0870570025', campaign: 'GETSAVVI_HEALTH_UPGRADE', vendor: 'GetSavvi', calls: 4720, rpcRate: 0.188, saleRate: 0.022, avgSec: 172 },
    { cli: '0870570028', campaign: 'DISCHEM_REWARDS_OUTBOUND', vendor: 'Dis-Chem Rewards', calls: 4150, rpcRate: 0.149, saleRate: 0.014, avgSec: 125 },
    { cli: '0870570030', campaign: 'BIZVOIP_ENTERPRISE_CALLS', vendor: 'BizVoip Direct', calls: 3620, rpcRate: 0.125, saleRate: 0.009, avgSec: 98 },
    { cli: '0870570035', campaign: 'AFFILIATE_GENERAL_CAMPAIGN', vendor: 'Affiliate Network', calls: 2890, rpcRate: 0.108, saleRate: 0.007, avgSec: 85 },
  ];

  const anomalies: CliValidationAnomaly[] = [];

  const records: CliPerformanceRecord[] = cliNumbers.map(item => {
    const distinctLeads = Math.round(item.calls * 0.72);
    const contactCount = Math.round(item.calls * item.rpcRate);
    const saleCount = Math.round(item.calls * item.saleRate);
    const d1mCount = Math.round(contactCount * 0.92);
    const d5mCount = Math.round(saleCount * 1.6);
    const d15mCount = Math.round(saleCount * 0.45);
    const totalSec = item.calls * item.avgSec;

    // Derived exact rates
    const contactRate = calculateExactRate(contactCount, item.calls) || '0.00';
    const salePerCallRate = calculateExactRate(saleCount, item.calls) || '0.00';
    const salePerContactRate = contactCount > 0 ? calculateExactRate(saleCount, contactCount) : null;
    const durationGe1mPct = calculateExactRate(d1mCount, item.calls) || '0.00';
    const durationGe5mPct = calculateExactRate(d5mCount, item.calls) || '0.00';
    const durationGe15mPct = calculateExactRate(d15mCount, item.calls) || '0.00';

    const activations = String(Math.round(saleCount * 0.68));
    const recordedValue = String(Math.round(saleCount * 850));

    return {
      cli: item.cli,
      campaign: item.campaign,
      vendor: item.vendor,
      totalCalls: String(item.calls),
      distinctLeads: String(distinctLeads),
      callsPerLead: (item.calls / distinctLeads).toFixed(2),
      asrCount: String(Math.round(item.calls * 0.76)),
      asrRate: '76.00',
      answeredCount: String(Math.round(item.calls * 0.54)),
      answeredRate: '54.00',
      contactCount: String(contactCount),
      contactRate,
      saleCount: String(saleCount),
      salePerCallRate,
      salePerAnswerRate: calculateExactRate(saleCount, Math.round(item.calls * 0.54)),
      salePerContactRate,
      durationGe1mCount: String(d1mCount),
      durationGe1mPct,
      durationGe5mCount: String(d5mCount),
      durationGe5mPct,
      durationGe15mCount: String(d15mCount),
      durationGe15mPct,
      avgDurationSeconds: item.avgSec.toFixed(1),
      totalDurationSeconds: String(totalSec),
      avgLeadAgeDays: '1.24',
      activations,
      recordedValue,
      valuePerCall: (Number(recordedValue) / item.calls).toFixed(2),
      valuePerLead: (Number(recordedValue) / distinctLeads).toFixed(2),
      hasAnomalies: false,
      anomalies: [],
    };
  });

  // Trend dates (last 14 days)
  const trend: CliTrendPoint[] = [];
  const baseDate = new Date('2026-09-08');
  for (let d = 0; d < 14; d++) {
    const cur = new Date(baseDate.getTime() + d * 86400000);
    const dateStr = cur.toISOString().slice(0, 10);
    const dailyCalls = Math.round(6200 + Math.sin(d) * 800);
    const dailyContacts = Math.round(dailyCalls * 0.168);
    const dailySales = Math.round(dailyCalls * 0.018);

    trend.push({
      date: dateStr,
      totalCalls: dailyCalls,
      contactRate: Number(((dailyContacts / dailyCalls) * 100).toFixed(2)),
      saleRate: Number(((dailySales / dailyCalls) * 100).toFixed(2)),
      answeredRate: 53.8,
      asrRate: 75.4,
      durationGe5mRate: 2.85,
    });
  }

  const leadAgeBands = computeLeadAgeBands(records);

  return { records, trend, leadAgeBands, anomalies };
}

/** Field coverage report for documentation and UI lineage */
export function getCliFieldCoverage(
  table: string,
  cliColumn: string | null,
  fields: Map<string, { type: string }>
): CliFieldCoverage[] {
  return [
    {
      field: 'cli',
      label: 'Outbound Caller ID (CLI)',
      status: cliColumn ? 'MEASURED' : 'UNAVAILABLE',
      sourceColumn: cliColumn,
      definition: 'Outbound presentation phone number used by dialler to place call.',
      note: cliColumn ? `Mapped to column '${cliColumn}'.` : `Table '${table}' does not contain a CLI / caller ID field.`,
    },
    {
      field: 'campaign_id',
      label: 'Campaign Code',
      status: fields.has('campaign_id') ? 'MEASURED' : 'UNAVAILABLE',
      sourceColumn: fields.has('campaign_id') ? 'campaign_id' : null,
      definition: 'Dialler campaign identifier or campaign name.',
    },
    {
      field: 'total_calls',
      label: 'Total Calls',
      status: 'MEASURED',
      sourceColumn: 'COUNT(*)',
      definition: 'Physical call attempt events at the dialler grain.',
    },
    {
      field: 'distinct_leads',
      label: 'Distinct Leads Dialled',
      status: fields.has('dialer_lead_id') ? 'MEASURED' : 'UNAVAILABLE',
      sourceColumn: fields.has('dialer_lead_id') ? 'dialer_lead_id' : null,
      definition: 'COUNT(DISTINCT dialer_lead_id)',
    },
    {
      field: 'is_rpc',
      label: 'Right Party Contact (RPC)',
      status: fields.has('is_rpc') ? 'MEASURED' : 'UNAVAILABLE',
      sourceColumn: fields.has('is_rpc') ? 'is_rpc' : null,
      definition: 'Verified contact with the intended consumer.',
    },
    {
      field: 'is_sale',
      label: 'Sales Recorded',
      status: fields.has('is_sale') ? 'MEASURED' : 'UNAVAILABLE',
      sourceColumn: fields.has('is_sale') ? 'is_sale' : null,
      definition: 'Call-level flag denoting verified sale.',
    },
    {
      field: 'length_in_sec',
      label: 'Call Duration',
      status: fields.has('length_in_sec') ? 'MEASURED' : 'UNAVAILABLE',
      sourceColumn: fields.has('length_in_sec') ? 'length_in_sec' : null,
      definition: 'Recorded call length in seconds from call start to termination.',
    },
    {
      field: 'asr',
      label: 'Answer Seizure Ratio (ASR)',
      status: 'UNAVAILABLE',
      sourceColumn: null,
      definition: 'Carrier-level Answer Seizure Ratio. Only shown when explicitly provided by telecom gateway.',
      note: 'Not provided in lead_ledger_all_vicidial_insights. Not synthesized or guessed.',
    },
    {
      field: 'lead_age',
      label: 'Lead Age at Dial',
      status: 'PARTIAL',
      sourceColumn: 'TIMESTAMP_DIFF(call_start, fetched, HOUR)',
      definition: 'Elapsed duration between lead capture/delivery and observed call attempt.',
      note: 'Requires joining dialler_lead_id to lead ledger fetched timestamp.',
    },
  ];
}

/** Primary analytical API query handler */
export async function getCliPerformance(
  input: QueryScope,
  access?: SourceAccess
): Promise<CliPerformanceResponse> {
  const scope = validateScope(input);
  const clientConfig = getClientConfig(scope.clientId);
  const configuredTable = clientConfig.semanticMappings.tables.cliPerformance || clientConfig.semanticMappings.tables.calls || 'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights';

  // 1. Inspect table metadata
  let metadata: TableMetadata | null = null;
  let fieldsMap = new Map<string, { type: string }>();
  let schemaChecked = false;
  let cliColumn: string | null = null;

  try {
    const sa = access || sourceAccess(scope.clientId);
    metadata = await sa.metadata(configuredTable);
    fieldsMap = flatSchema(metadata.schema?.fields || []);
    schemaChecked = true;
    cliColumn = findCliColumn(fieldsMap);
  } catch (err: any) {
    // If table inspection fails or permissions not granted
    schemaChecked = false;
  }

  // 2. Check for tenant-imported report data
  const tenantImport = getTenantImport(scope.clientId);

  // If live CLI column is available in BigQuery, execute live SQL query
  if (schemaChecked && cliColumn) {
    return executeLiveCliQuery(scope, configuredTable, cliColumn, fieldsMap);
  }

  // If an imported report is available, serve it with IMPORTED_REPORT provenance
  if (tenantImport) {
    let records = tenantImport.records;

    if ((scope.startDate || scope.endDate) && !records.some(record => record.reportDate)) {
      throw new RequestError('This imported CLI report has no report-date field, so the selected date scope cannot be applied safely.', 422);
    }
    if (scope.startDate) records = records.filter(record => record.reportDate && record.reportDate >= scope.startDate!);
    if (scope.endDate) records = records.filter(record => record.reportDate && record.reportDate <= scope.endDate!);

    // Apply filters to imported records
    if (scope.filters) {
      if (scope.filters.cli && scope.filters.cli.operator === 'in') {
        const allowed = new Set(scope.filters.cli.values!.map(String));
        records = records.filter(r => allowed.has(r.cli));
      }
      if (scope.filters.campaign && scope.filters.campaign.operator === 'in') {
        const allowed = new Set(scope.filters.campaign.values!.map(String));
        records = records.filter(r => allowed.has(r.campaign));
      }
      if (scope.filters.vendor) {
        const rawVals = scope.filters.vendor.operator === 'in' 
          ? scope.filters.vendor.values || [] 
          : scope.filters.vendor.value !== undefined ? [scope.filters.vendor.value] : [];
        const allowed = new Set(rawVals.map(v => String(v).trim().toLowerCase()).filter(v => !['all', 'all vendors'].includes(v)));
        if (allowed.size > 0) {
          records = records.filter(r => r.vendor && allowed.has(r.vendor.trim().toLowerCase()));
        }
      }
    }

    const summary = computeCliSummary(records);
    const durationBands = computeDurationBands(records);
    const periodComparison = computePeriodComparison(records, scope);
    const campaigns = aggregateCampaigns(records);
    const fieldCoverage = getCliFieldCoverage(configuredTable, cliColumn, fieldsMap);

    return {
      provenance: 'IMPORTED_REPORT',
      status: 'AVAILABLE',
      sourceStatus: {
        table: configuredTable,
        configured: true,
        schemaChecked: true,
        cliFieldPresent: false,
        totalColumnsFound: fieldsMap.size,
        reason: `Live BigQuery table '${configuredTable}' lacks an outbound CLI column. Data is sourced from validated imported report '${tenantImport.filename}' (uploaded ${tenantImport.uploadedAt}).`,
      },
      summary,
      cliPerformance: records,
      trend: tenantImport.trend,
      durationBands,
      leadAgeBands: tenantImport.leadAgeBands,
      campaigns,
      periodComparison,
      fieldCoverage,
      anomalies: tenantImport.anomalies,
      metricDefinitions: CLI_METRIC_DEFINITIONS,
      metadata: {
        clientId: scope.clientId,
        startDate: scope.startDate || null,
        endDate: scope.endDate || null,
        filters: scope.filters || {},
        modelVersion: 'cx.cli.1.0.0',
        generatedAt: new Date().toISOString(),
        rowCount: records.length,
        validationStatus: tenantImport.anomalies.length > 0 ? 'VALIDATED_WITH_ANOMALIES' : 'VALIDATED_REPORT',
      },
    };
  }

  // If no live CLI column and no imported report exists:
  // Return explicit SCHEMA_UNAVAILABLE status with diagnostic schema info
  const fieldCoverage = getCliFieldCoverage(configuredTable, cliColumn, fieldsMap);

  return {
    provenance: 'LIVE_BIGQUERY',
    status: 'SCHEMA_UNAVAILABLE',
    sourceStatus: {
      table: configuredTable,
      configured: true,
      schemaChecked,
      cliFieldPresent: false,
      totalColumnsFound: fieldsMap.size,
      reason: `The configured call source '${configuredTable}' contains ${fieldsMap.size} fields (calls, campaigns, agents, durations, dispositions), but does NOT contain an outbound CLI (Caller ID) column. To analyse CLI performance, configure a dedicated CLI table or upload a standard VICIdial CLI CSV report.`,
    },
    summary: null,
    cliPerformance: [],
    trend: [],
    durationBands: {
      under1mCount: null,
      under1mPct: null,
      oneTo5mCount: null,
      oneTo5mPct: null,
      fiveTo15mCount: null,
      fiveTo15mPct: null,
      over15mCount: null,
      over15mPct: null,
      totalDurationSeconds: null,
      avgDurationSeconds: null,
      medianDurationSeconds: null,
    },
    leadAgeBands: emptyLeadAgeBands(),
    campaigns: [],
    periodComparison: null,
    fieldCoverage,
    anomalies: [],
    metricDefinitions: CLI_METRIC_DEFINITIONS,
    metadata: {
      clientId: scope.clientId,
      startDate: scope.startDate || null,
      endDate: scope.endDate || null,
      filters: scope.filters || {},
      modelVersion: 'cx.cli.1.0.0',
      generatedAt: new Date().toISOString(),
      rowCount: 0,
      validationStatus: 'SCHEMA_GAP_DETECTED',
    },
  };
}

/** Execute Live BigQuery query when CLI field is present */
async function executeLiveCliQuery(
  scope: QueryScope,
  table: string,
  cliCol: string,
  fields: Map<string, { type: string }>
): Promise<CliPerformanceResponse> {
  const clientConfig = getClientConfig(scope.clientId);
  const client = sourceAccess(scope.clientId);

  const campaignCol = fields.has('campaign_id') ? 'campaign_id' : fields.has('campaign_name') ? 'campaign_name' : null;
  const vendorCol = fields.has('vendor') ? 'vendor' : null;
  const dateCol = fields.has('call_start_date') ? 'call_start_date' : fields.has('date') ? 'date' : null;
  const hasLeadId = fields.has('dialer_lead_id');

  for (const required of ['is_rpc', 'is_sale', 'length_in_sec']) {
    if (!fields.has(required)) {
      throw new RequestError(`CLI analytics requires the source field '${required}' to avoid inferred performance values.`, 422);
    }
  }
  if ((scope.startDate || scope.endDate) && !dateCol) {
    throw new RequestError('The CLI source has no supported call date field, so the selected date scope cannot be applied safely.', 422);
  }

  const params: Record<string, any> = {
    tenantTimezone: clientConfig.timezone || 'Africa/Johannesburg',
  };
  const clauses: string[] = [];

  if (clientConfig.id !== 'default_tenant' && clientConfig.id !== 'offernet_master') {
    const tenantVendors = tenantVendorScopeValues(clientConfig);
    if (!vendorCol || tenantVendors.length === 0) {
      throw new RequestError('The configured CLI source cannot be safely scoped to this tenant because a vendor mapping is unavailable.', 422);
    }
    clauses.push(`LOWER(CAST(s.\`${vendorCol}\` AS STRING)) IN UNNEST(@tenantVendors)`);
    params.tenantVendors = tenantVendors;
  }

  if (scope.startDate) {
    clauses.push(`DATE(${validTimestampSql(`s.\`${dateCol!}\``)}, @tenantTimezone) >= @startDate`);
    params.startDate = scope.startDate;
  }
  if (scope.endDate) {
    clauses.push(`DATE(${validTimestampSql(`s.\`${dateCol!}\``)}, @tenantTimezone) <= @endDate`);
    params.endDate = scope.endDate;
  }

  if (scope.filters?.cli) {
    clauses.push(conditionSql(`CAST(s.\`${cliCol}\` AS STRING)`, scope.filters.cli, 'filter_cli', params));
  }
  if (scope.filters?.campaign && campaignCol) {
    clauses.push(conditionSql(`CAST(s.\`${campaignCol}\` AS STRING)`, scope.filters.campaign, 'filter_camp', params));
  }
  if (scope.filters?.vendor && vendorCol) {
    clauses.push(conditionSql(`CAST(s.\`${vendorCol}\` AS STRING)`, scope.filters.vendor, 'filter_vendor', params));
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const distinctLeadExpr = fields.has('dialer_lead_id') ? 'COUNT(DISTINCT dialer_lead_id)' : 'CAST(NULL AS INT64)';
  const contactExpr = fields.has('is_rpc') ? 'COUNTIF(is_rpc IS TRUE)' : 'CAST(NULL AS INT64)';
  const saleExpr = fields.has('is_sale') ? 'COUNTIF(is_sale IS TRUE)' : 'CAST(NULL AS INT64)';
  const durationTotalExpr = fields.has('length_in_sec') ? 'SUM(SAFE_CAST(length_in_sec AS INT64))' : 'CAST(NULL AS INT64)';
  const avgDurationExpr = fields.has('length_in_sec') ? 'ROUND(AVG(SAFE_CAST(length_in_sec AS INT64)), 1)' : 'CAST(NULL AS FLOAT64)';
  const duration1mExpr = fields.has('length_in_sec') ? 'COUNTIF(SAFE_CAST(length_in_sec AS INT64) >= 60)' : 'CAST(NULL AS INT64)';
  const duration5mExpr = fields.has('length_in_sec') ? 'COUNTIF(SAFE_CAST(length_in_sec AS INT64) >= 300)' : 'CAST(NULL AS INT64)';
  const duration15mExpr = fields.has('length_in_sec') ? 'COUNTIF(SAFE_CAST(length_in_sec AS INT64) >= 900)' : 'CAST(NULL AS INT64)';

  const query = `
    SELECT
      CAST(s.\`${cliCol}\` AS STRING) AS cli,
      ${campaignCol ? `CAST(s.\`${campaignCol}\` AS STRING)` : "'Unknown Campaign'"} AS campaign,
      ${vendorCol ? `CAST(s.\`${vendorCol}\` AS STRING)` : "'Unknown Vendor'"} AS vendor,
      COUNT(*) AS total_calls,
      ${hasLeadId ? 'COUNT(DISTINCT dialer_lead_id)' : 'CAST(NULL AS INT64)'} AS distinct_leads,
      COUNTIF(is_rpc IS TRUE) AS contact_count,
      COUNTIF(is_sale IS TRUE) AS sale_count,
      SUM(SAFE_CAST(length_in_sec AS INT64)) AS total_duration,
      ROUND(AVG(SAFE_CAST(length_in_sec AS INT64)), 1) AS avg_duration,
      COUNTIF(SAFE_CAST(length_in_sec AS INT64) >= 60) AS duration_ge_1m,
      COUNTIF(SAFE_CAST(length_in_sec AS INT64) >= 300) AS duration_ge_5m,
      COUNTIF(SAFE_CAST(length_in_sec AS INT64) >= 900) AS duration_ge_15m
    FROM ${tableIdentifier(table)} s
    ${whereSql}
    GROUP BY cli, campaign, vendor
    ORDER BY total_calls DESC
    LIMIT 2000
  `;

  if (!fields.has('is_rpc') || !fields.has('is_sale')) {
    throw new RequestError('The configured CLI source is missing required is_rpc or is_sale fields; CX3 will not infer contact or sale outcomes.', 422);
  }

  const result = await client.execute({ query, params });
  const records: CliPerformanceRecord[] = result.rows.map(r => {
    const totalCalls = String(r.total_calls || '0');
    const distinctLeads = r.distinct_leads === null || r.distinct_leads === undefined ? null : String(r.distinct_leads);
    const contactCount = String(r.contact_count || '0');
    const saleCount = String(r.sale_count || '0');
    const d1m = String(r.duration_ge_1m || '0');
    const d5m = String(r.duration_ge_5m || '0');
    const d15m = String(r.duration_ge_15m || '0');

    return {
      cli: r.cli || 'Unknown CLI',
      campaign: r.campaign || 'Unknown',
      vendor: r.vendor || 'Unknown',
      totalCalls,
      distinctLeads,
      callsPerLead: distinctLeads && distinctLeads !== '0' ? (Number(totalCalls) / Number(distinctLeads)).toFixed(2) : null,
      asrCount: null,
      asrRate: null,
      answeredCount: null,
      answeredRate: null,
      contactCount,
      contactRate: calculateExactRate(contactCount, totalCalls) || '0.00',
      saleCount,
      salePerCallRate: calculateExactRate(saleCount, totalCalls) || '0.00',
      salePerAnswerRate: null,
      salePerContactRate: Number(contactCount) > 0 ? calculateExactRate(saleCount, contactCount) : null,
      durationGe1mCount: d1m,
      durationGe1mPct: d1m === null ? null : calculateExactRate(d1m, totalCalls),
      durationGe5mCount: d5m,
      durationGe5mPct: d5m === null ? null : calculateExactRate(d5m, totalCalls),
      durationGe15mCount: d15m,
      durationGe15mPct: d15m === null ? null : calculateExactRate(d15m, totalCalls),
      avgDurationSeconds: r.avg_duration === null || r.avg_duration === undefined ? null : String(r.avg_duration),
      totalDurationSeconds: r.total_duration === null || r.total_duration === undefined ? null : String(r.total_duration),
      avgLeadAgeDays: null,
      activations: null,
      recordedValue: null,
      valuePerCall: null,
      valuePerLead: null,
      hasAnomalies: false,
      anomalies: [],
    };
  });

  const summary = computeCliSummary(records);
  const durationBands = computeDurationBands(records);
  const periodComparison = computePeriodComparison(records, scope);
  const campaigns = aggregateCampaigns(records);
  const fieldCoverage = getCliFieldCoverage(table, cliCol, fields);

  return {
    provenance: 'LIVE_BIGQUERY',
    status: 'AVAILABLE',
    sourceStatus: {
      table,
      configured: true,
      schemaChecked: true,
      cliFieldPresent: true,
      cliFieldName: cliCol,
      totalColumnsFound: fields.size,
    },
    summary,
    cliPerformance: records,
    trend: [],
    durationBands,
    leadAgeBands: emptyLeadAgeBands(),
    campaigns,
    periodComparison,
    fieldCoverage,
    anomalies: [],
    metricDefinitions: CLI_METRIC_DEFINITIONS,
    metadata: {
      clientId: scope.clientId,
      startDate: scope.startDate || null,
      endDate: scope.endDate || null,
      filters: scope.filters || {},
      modelVersion: 'cx.cli.1.0.0',
      generatedAt: new Date().toISOString(),
      rowCount: records.length,
      validationStatus: 'LIVE_SQL_AGGREGATED',
    },
  };
}

function aggregateCampaigns(records: CliPerformanceRecord[]): CliCampaignAggregate[] {
  const map = new Map<string, { calls: bigint; contacts: bigint; sales: bigint; clis: Set<string> }>();

  for (const r of records) {
    const existing = map.get(r.campaign) || { calls: 0n, contacts: 0n, sales: 0n, clis: new Set() };
    existing.calls += BigInt(r.totalCalls);
    existing.contacts += BigInt(r.contactCount);
    existing.sales += BigInt(r.saleCount);
    existing.clis.add(r.cli);
    map.set(r.campaign, existing);
  }

  return Array.from(map.entries()).map(([campaign, data]) => {
    const calls = data.calls.toString();
    const contacts = data.contacts.toString();
    const sales = data.sales.toString();
    return {
      campaign,
      calls,
      contacts,
      contactRate: calculateExactRate(contacts, calls) || '0.00',
      sales,
      saleRate: calculateExactRate(sales, calls) || '0.00',
      cliCount: data.clis.size,
    };
  }).sort((a, b) => Number(b.calls) - Number(a.calls));
}
