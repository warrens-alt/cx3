/** Opaque color pairs keep numeric labels legible at every heatmap intensity. */
const INTENSITY_COLORS = [
  { backgroundColor: 'var(--cx-heatmap-1-bg)', color: 'var(--cx-heatmap-low-ink)' },
  { backgroundColor: 'var(--cx-heatmap-2-bg)', color: 'var(--cx-heatmap-low-ink)' },
  { backgroundColor: 'var(--cx-heatmap-3-bg)', color: 'var(--cx-heatmap-low-ink)' },
  { backgroundColor: 'var(--cx-heatmap-4-bg)', color: 'var(--cx-heatmap-low-ink)' },
  { backgroundColor: 'var(--cx-heatmap-5-bg)', color: 'var(--cx-heatmap-high-ink)' },
  { backgroundColor: 'var(--cx-heatmap-6-bg)', color: 'var(--cx-heatmap-high-ink)' },
] as const;

export function heatmapColors(value: number | null | undefined, maximum: number) {
  if (value == null || !Number.isFinite(value)) {
    return { backgroundColor: 'var(--cx-surface-subtle)', color: 'var(--cx-text-secondary)' };
  }
  if (value <= 0) return { backgroundColor: 'var(--cx-surface)', color: 'var(--cx-text-secondary)' };
  const scale = Number.isFinite(maximum) && maximum > 0 ? maximum : value;
  const intensity = Math.min(1, value / scale);
  const index = Math.max(0, Math.min(INTENSITY_COLORS.length - 1, Math.ceil(intensity * INTENSITY_COLORS.length) - 1));
  return INTENSITY_COLORS[index];
}
