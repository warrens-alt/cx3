import type { VettingReport, VettingGroup } from '../../contracts/vetting';

export const VETTING_MEASURES = [
  { key: 'leads', label: 'Included Leads', unit: 'records' },
  { key: 'delivered', label: 'Delivered Leads', unit: 'records' },
  { key: 'called', label: 'Dialled Leads', unit: 'records' },
  { key: 'rpc', label: 'RPC Flags', unit: 'records' },
  { key: 'sales', label: 'Verified Sales', unit: 'records' },
  { key: 'activations', label: 'Activations', unit: 'records' },
];

export function selectedGroups(report: VettingReport, section: string): VettingGroup[] {
  if (!report || !Array.isArray(report.groups)) return [];
  return report.groups.filter((g: VettingGroup) => g.section === section);
}

export function decorateGroup(group: VettingGroup, report?: VettingReport): any {
  return {
    ...group,
    key: group.key,
    label: group.series ? `${group.key} · ${group.series}` : group.key,
  };
}

export function groupDataset(rows: VettingGroup[], report: VettingReport, title: string): any {
  return {
    id: `vetting-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    title,
    rows,
  };
}

export function classMovement(report: VettingReport, section: 'class' | 'colour') {
  if (!report || !Array.isArray(report.groups)) return [];
  const groups = report.groups.filter(g => g.section === section);
  const keys = Array.from(new Set(groups.map(g => g.key)));

  return keys.map(k => {
    const curr = groups.find(g => g.key === k && g.period === 'current')?.leads ?? '0';
    const prev = groups.find(g => g.key === k && g.period === 'previous')?.leads ?? '0';
    const c = parseFloat(curr) || 0;
    const p = parseFloat(prev) || 0;
    const diff = c - p;
    return {
      key: k,
      current: curr,
      previous: prev,
      delta: diff >= 0 ? `+${diff}` : String(diff),
      percent: p !== 0 ? ((diff / p) * 100).toFixed(1) : null,
    };
  });
}

export function summaryLine(report: VettingReport): string {
  const total = report.current?.leads || '0';
  const classCount = report.current?.classRecorded || '0';
  return `${total} included leads observed, with ${classCount} class outcomes recorded in the selected period.`;
}

export function downloadVetting(content: string, filename: string, type: string = 'text/plain') {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function csvText(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const quote = (v: any) => {
    if (v === null || v === undefined) return '""';
    return `"${String(v).replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [headers.map(quote).join(','), ...rows.map(r => r.map(quote).join(','))].join('\r\n');
}
