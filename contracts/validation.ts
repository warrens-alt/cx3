/** OfferShop ID/mobile validity: 1=valid, 2=invalid. Legacy explicit booleans retain their meaning; code 0 is unknown. */
export const VALIDATION_CODE_VERSION = '2026-09-29.1';
export function validationValue(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  const code = typeof value === 'string' ? value.trim().toLowerCase() : String(value);
  if (code === '1' || code === 'true') return true;
  if (code === '2' || code === 'false') return false;
  return null;
}
/** Expressions are supplied by server query compilers, never request text. */
export function validationSql(expression: string): string {
  return `CASE LOWER(TRIM(CAST(${expression} AS STRING))) WHEN '1' THEN TRUE WHEN 'true' THEN TRUE WHEN '2' THEN FALSE WHEN 'false' THEN FALSE ELSE NULL END`;
}
