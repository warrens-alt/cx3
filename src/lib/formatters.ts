export function formatKpiValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val !== 'number') {
    const parsed = Number(val);
    if (isNaN(parsed) || !isFinite(parsed)) return String(val);
    val = parsed;
  }
  if (!isFinite(val)) return '—';
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);
  if (abs >= 1000000) {
    return sign + (abs / 1000000).toFixed(2).replace(/\.00$/, '') + 'M';
  }
  if (abs >= 10000) {
    return sign + (abs / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return sign + abs.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export function formatChartAxis(val: number): string {
  if (!isFinite(val)) return '—';
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);
  if (abs >= 1000000) return sign + (abs / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 1000) return sign + (abs / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return val.toString();
}

export function formatChartTooltip(val: number, isCurrency: boolean = false, isRate: boolean = false): string {
  if (!isFinite(val)) return '—';
  if (isRate) {
    // If the value is a fraction (e.g. 0.125), scale to 12.5%. If already a percent (e.g. 12.5), display as is.
    const pctVal = (Math.abs(val) <= 1 && val !== 0) ? val * 100 : val;
    return `${pctVal.toFixed(2)}%`;
  }
  if (isCurrency) {
    const sign = val < 0 ? '-' : '';
    const abs = Math.abs(val);
    return `${sign}R ${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return val.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export function formatTableNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) return '—';
  return num.toLocaleString('en-US');
}

export function formatTableCurrency(val: number | string | null | undefined, prefix: string = 'R'): string {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) return '—';
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  return `${sign}${prefix} ${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(val: number | string | null | undefined, decimals: number = 1): string {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) return '—';
  return `${num.toFixed(decimals)}%`;
}

export function formatRatioPercent(
  numerator: number | string | null | undefined,
  denominator: number | string | null | undefined,
  decimals: number = 1,
): string {
  if (numerator === null || numerator === undefined || numerator === '' || denominator === null || denominator === undefined || denominator === '') return '—';
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return '—';
  return formatPercent((num / den) * 100, decimals);
}

export function formatCurrency(val: number | string | null | undefined, decimals: number = 2): string {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) return '—';
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  return `${sign}R ${abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function downloadCsv(filename: string, rows: (string | number | boolean | null | undefined)[][]): void {
  const quote = (val: any) => {
    if (val === null || val === undefined) return '""';
    // Numeric negatives remain numbers; source-controlled text cannot execute spreadsheet formulas.
    const raw = String(val);
    const s = typeof val === 'string' && /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return `"${s}"`;
  };

  const csvContent = '\uFEFF' + rows.map(r => r.map(quote).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
