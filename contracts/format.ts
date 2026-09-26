/** Exact decimal-string formatting. Never convert warehouse NUMERIC/INT64 strings to JavaScript Number. */
export function exactNumber(value: string | null, minimumDecimals = 0): string {
  if (value === null) return 'Unavailable';
  if (!/^-?\d+(\.\d+)?$/.test(value)) return 'Invalid value';
  const [integer, fraction = ''] = value.split('.');
  const digits = fraction.replace(/0+$/, '').padEnd(minimumDecimals, '0');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (digits ? '.' + digits : '');
}
