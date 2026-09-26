export interface ExploreMetric {
  id: string;
  label: string;
  unit?: string;
  additive?: boolean;
  definition?: string;
  formula?: string;
}

export interface ExploreDimension {
  id: string;
  label: string;
}

export const METRICS: ExploreMetric[] = [
  { id: 'leads', label: 'Captured Leads', unit: 'records', additive: true, definition: 'Unique captured leads in the period.', formula: 'COUNT(DISTINCT lead_id)' },
  { id: 'delivered', label: 'Delivered Episodes', unit: 'records', additive: true, definition: 'Delivered leads forwarded to call centers.', formula: 'COUNT(DISTINCT delivered_id)' },
  { id: 'called', label: 'Dialled Leads', unit: 'records', additive: true, definition: 'Delivered leads with at least one observed dial.', formula: 'COUNT(DISTINCT called_lead_id)' },
  { id: 'rpcs', label: 'RPC Contacts', unit: 'records', additive: true, definition: 'Dials reaching right-party contact.', formula: 'COUNT(DISTINCT rpc_id)' },
  { id: 'sales', label: 'Verified Sales', unit: 'records', additive: true, definition: 'Sales approved by QA and underwriting.', formula: 'COUNT(DISTINCT sale_id)' },
  { id: 'billableSales', label: 'Billable Sales', unit: 'records', additive: true, definition: 'Sales matched to commercial billing records.', formula: 'COUNT(DISTINCT billable_sale_id)' },
  { id: 'activations', label: 'Policy Activations', unit: 'records', additive: true, definition: 'Policies confirmed active post first payment.', formula: 'COUNT(DISTINCT activation_id)' },
  { id: 'revenue', label: 'Recorded Revenue', unit: 'currency', additive: true, definition: 'Ledger revenue generated.', formula: 'SUM(revenue_amount)' },
  { id: 'deliveryRate', label: 'Delivery Rate', unit: 'percent', additive: false, definition: 'Delivered / Fetched leads.', formula: 'delivered / leads * 100' },
  { id: 'callRate', label: 'Dial Rate', unit: 'percent', additive: false, definition: 'Dialled / Delivered leads.', formula: 'called / delivered * 100' },
  { id: 'rpcRate', label: 'RPC Rate', unit: 'percent', additive: false, definition: 'RPC / Dialled leads.', formula: 'rpcs / called * 100' },
  { id: 'saleRate', label: 'Sale Rate', unit: 'percent', additive: false, definition: 'Sales / RPC contacts.', formula: 'sales / rpcs * 100' },
  { id: 'leadToSaleRate', label: 'Lead-to-Sale Rate', unit: 'percent', additive: false, definition: 'Sales / Fetched leads.', formula: 'sales / leads * 100' },
  { id: 'billableSaleRate', label: 'Billable Sale Rate', unit: 'percent', additive: false, definition: 'Billable sales / Sales.', formula: 'billable / sales * 100' },
  { id: 'activationRate', label: 'Activation Rate', unit: 'percent', additive: false, definition: 'Activations / Sales.', formula: 'activations / sales * 100' },
  { id: 'revPerLead', label: 'Revenue per Lead', unit: 'currency', additive: false, definition: 'Recorded revenue per lead.', formula: 'revenue / leads' },
];

export const DIMENSIONS: ExploreDimension[] = [
  { id: 'source', label: 'Lead Source' },
  { id: 'medium', label: 'Traffic Medium' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'capture_date', label: 'Capture Date' },
  { id: 'capture_month', label: 'Capture Month' },
];

export const TEMPORAL = new Set(['capture_date', 'capture_month', 'date', 'month', 'week']);

export type Sort = 'label' | 'value_desc' | 'value_asc' | 'sample_desc';

export interface ExploreView {
  metric: string;
  dimension: string;
  secondary?: string;
  chart?: string;
}

export interface ExploreRow {
  key: string;
  label: string;
  dim1?: string;
  dim2?: string;
  series?: string;
  value: string | number | null;
  sampleSize?: number;
  fullFunnel?: Record<string, string | null>;
  precisionWarning?: boolean;
  [key: string]: any;
}

export interface ExploreResult {
  rows: ExploreRow[];
  receivedAt?: string;
  metadata: {
    currency?: string;
    totalRows?: number;
    durationMs?: number;
    source?: any;
    sourceDependencies?: any;
    validationStatus?: string;
    truncated?: boolean;
    [key: string]: any;
  };
}

export function sumExact(values: (string | number | null | undefined)[]): string {
  let total = 0;
  let hasValid = false;
  for (const v of values) {
    if (v !== null && v !== undefined && v !== '') {
      const num = typeof v === 'number' ? v : parseFloat(String(v));
      if (!Number.isNaN(num)) {
        total += num;
        hasValid = true;
      }
    }
  }
  return hasValid ? (Number.isInteger(total) ? String(total) : total.toFixed(2)) : '0';
}

export function formatValue(value: string | number | null | undefined, unitOrMetric?: string, currency: string = 'ZAR'): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (Number.isNaN(num)) return String(value);

  const metric = METRICS.find(m => m.id === unitOrMetric);
  const unit = metric ? metric.unit : unitOrMetric;

  if (unit === 'percent' || unitOrMetric?.endsWith('Rate')) return `${num.toFixed(1)}%`;
  if (unit === 'currency' || unitOrMetric === 'revenue' || unitOrMetric === 'revPerLead') {
    return `${currency === 'USD' ? '$' : 'R'}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return num.toLocaleString();
}

export function safeChart(view: ExploreView, rows: ExploreRow[]): string {
  return view.chart || (TEMPORAL.has(view.dimension) ? 'line' : 'bar');
}

export function canDonut(viewOrRows: any, maybeRows?: ExploreRow[]): boolean {
  const rows = Array.isArray(viewOrRows) ? viewOrRows : maybeRows || [];
  return rows.length > 0 && rows.length <= 12 && rows.every(r => (typeof r.value === 'number' ? r.value : parseFloat(String(r.value || '0'))) >= 0);
}

export function seriesNames(rows: ExploreRow[]): string[] {
  return Array.from(new Set(rows.map(r => r.series || r.label))).filter(Boolean);
}

export function seriesLabel(name: string): string {
  return name;
}

export function selectRows(
  rows: ExploreRow[],
  search: string,
  sort: Sort,
  minSample: string = '0'
): ExploreRow[] {
  const min = parseFloat(minSample) || 0;
  let filtered = rows.filter(r => (r.sampleSize ?? 1) >= min);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(r => r.label.toLowerCase().includes(q) || (r.series && r.series.toLowerCase().includes(q)));
  }

  filtered.sort((a, b) => {
    if (sort === 'label') return a.label.localeCompare(b.label);
    const va = typeof a.value === 'number' ? a.value : parseFloat(String(a.value ?? -999999));
    const vb = typeof b.value === 'number' ? b.value : parseFloat(String(b.value ?? -999999));
    if (sort === 'value_desc') return vb - va;
    if (sort === 'value_asc') return va - vb;
    if (sort === 'sample_desc') return (b.sampleSize ?? 0) - (a.sampleSize ?? 0);
    return 0;
  });

  return filtered;
}

export function saveFile(content: string, filename: string, type: string = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv(
  rowsOrHeaders: any,
  viewOrRows?: any,
  context?: any
): string {
  const quote = (v: any) => {
    if (v === null || v === undefined) return '""';
    return `"${String(v).replace(/"/g, '""')}"`;
  };

  if (Array.isArray(rowsOrHeaders) && rowsOrHeaders.length > 0 && typeof rowsOrHeaders[0] === 'object' && !Array.isArray(rowsOrHeaders[0])) {
    const rows = rowsOrHeaders as ExploreRow[];
    const headers = ['Key', 'Label', 'Dimension 1', 'Dimension 2', 'Series', 'Value', 'Sample Size'];
    const rowLines = rows.map(r => [
      quote(r.key),
      quote(r.label),
      quote(r.dim1),
      quote(r.dim2),
      quote(r.series),
      quote(r.value),
      quote(r.sampleSize),
    ].join(','));
    return '\uFEFF' + [headers.join(','), ...rowLines].join('\r\n');
  }

  const headers = Array.isArray(rowsOrHeaders) ? rowsOrHeaders : [];
  const rows = Array.isArray(viewOrRows) ? viewOrRows : [];
  return '\uFEFF' + [headers.map(quote).join(','), ...rows.map((r: any[]) => r.map(quote).join(','))].join('\r\n');
}
