export const CHART_PALETTE = [
  '#3562B3', // primary blue
  '#0284c7', // cyan
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#7c3aed', // violet
  '#db2777', // pink
  '#475569', // slate
];

const colourCache = new Map<string, string>();

export function categoryColour(label: string, categoryKey?: string): string {
  const key = categoryKey || label;
  if (colourCache.has(key)) return colourCache.get(key)!;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CHART_PALETTE.length;
  const col = CHART_PALETTE[index];
  colourCache.set(key, col);
  return col;
}
