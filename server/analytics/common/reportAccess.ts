/** Aggregate reports must not smuggle administrator-only record samples to ordinary viewers. */
export function redactReportRecords<T>(report: T, isAdmin: boolean): T {
  if (isAdmin || !report || typeof report !== 'object' || Array.isArray(report)) return report;
  const result = { ...report } as Record<string, unknown>;
  let redacted = false;
  for (const field of ['missingSample', 'repeatConsumersSample']) {
    if (field in result) { result[field] = []; redacted = true; }
  }
  if (redacted) result.recordDetailsStatus = 'ADMIN_REQUIRED';
  return result as T;
}
