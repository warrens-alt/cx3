export const CHART_PALETTE = [
  'var(--cx-visual-category-1)', // primary blue
  'var(--cx-visual-category-2)', // cyan
  'var(--cx-visual-category-3)', // emerald
  'var(--cx-visual-category-4)', // amber
  'var(--cx-visual-category-5)', // red
  'var(--cx-visual-category-6)', // violet
  'var(--cx-visual-category-7)', // pink
  'var(--cx-visual-category-8)', // slate
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
