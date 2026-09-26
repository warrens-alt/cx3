const DECIMAL = /^[+-]?\d+(?:\.\d+)?$/;

interface Parts { coefficient: bigint; scale: number; }

function fromParts(coefficient: bigint, scale: number): string {
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, '0');
  const raw = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  const normalized = raw.includes('.') ? raw.replace(/0+$/, '').replace(/\.$/, '') : raw;
  return negative && coefficient !== 0n ? `-${normalized}` : normalized;
}

function parts(value: string): Parts {
  if (!DECIMAL.test(value)) throw new Error('Expected a plain finite decimal string.');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^[+-]/, '').split('.');
  return { coefficient: BigInt(whole + fraction) * (negative ? -1n : 1n), scale: fraction.length };
}

export function exactDecimal(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return DECIMAL.test(value) ? value.replace(/^\+/, '') : null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object' && value && typeof (value as { value?: unknown }).value === 'string') {
    const text = (value as { value: string }).value;
    return DECIMAL.test(text) ? text.replace(/^\+/, '') : null;
  }
  return null;
}

/** Exact decimal comparison without coercion to IEEE-754 coordinates. */
export function compareExactDecimal(left: string, right: string): number {
  const a = parts(left), b = parts(right), scale = Math.max(a.scale, b.scale);
  const av = a.coefficient * 10n ** BigInt(scale - a.scale);
  const bv = b.coefficient * 10n ** BigInt(scale - b.scale);
  return av === bv ? 0 : av > bv ? 1 : -1;
}

/** Exact addition/subtraction for warehouse decimal strings. */
export function addExactDecimals(left: string, right: string): string {
  const a = parts(left), b = parts(right), scale = Math.max(a.scale, b.scale);
  const av = a.coefficient * 10n ** BigInt(scale - a.scale);
  const bv = b.coefficient * 10n ** BigInt(scale - b.scale);
  return fromParts(av + bv, scale);
}

export function subtractExactDecimals(left: string, right: string): string {
  const b = parts(right);
  return addExactDecimals(left, fromParts(-b.coefficient, b.scale));
}

/** Exact division rounded half away from zero once at the requested scale. */
export function divideExactDecimal(numerator: string, denominator: string, places = 2): string | null {
  if (places < 0 || places > 9) throw new Error('Unsupported decimal scale.');
  const n = parts(numerator), d = parts(denominator);
  if (d.coefficient === 0n) return null;
  const negative = (n.coefficient < 0n) !== (d.coefficient < 0n);
  const absoluteN = n.coefficient < 0n ? -n.coefficient : n.coefficient;
  const absoluteD = d.coefficient < 0n ? -d.coefficient : d.coefficient;
  const scaledN = absoluteN * 10n ** BigInt(d.scale + places);
  const scaledD = absoluteD * 10n ** BigInt(n.scale);
  const rounded = (scaledN * 2n + scaledD) / (scaledD * 2n);
  const digits = rounded.toString().padStart(places + 1, '0');
  const value = places === 0 ? digits : `${digits.slice(0, -places)}.${digits.slice(-places)}`;
  return negative && rounded !== 0n ? `-${value}` : value;
}

export function exactPercent(numerator: string | null, denominator: string | null, places = 1): string | null {
  if (numerator === null || denominator === null) return null;
  const n = parts(numerator);
  return divideExactDecimal(fromParts(n.coefficient * 100n, n.scale), denominator, places);
}

export function subtractExactIntegers(left: string, right: string): string {
  if (!/^\d+$/.test(left) || !/^\d+$/.test(right)) throw new Error('Expected non-negative integer strings.');
  return (BigInt(left) - BigInt(right)).toString();
}
