/** Opaque color pairs keep numeric labels legible at every heatmap intensity. */
const INTENSITY_COLORS = [
  { backgroundColor: '#EDF2FD', color: '#17243B' },
  { backgroundColor: '#DCE6FC', color: '#17243B' },
  { backgroundColor: '#BACDF4', color: '#17243B' },
  { backgroundColor: '#8EADEB', color: '#17243B' },
  { backgroundColor: '#4169C1', color: '#FFFFFF' },
  { backgroundColor: '#315BCB', color: '#FFFFFF' },
] as const;

export function heatmapColors(value: number | null | undefined, maximum: number) {
  if (value == null || !Number.isFinite(value)) {
    return { backgroundColor: '#F5F7FB', color: '#52637A' };
  }
  if (value <= 0) return { backgroundColor: '#FFFFFF', color: '#52637A' };
  const scale = Number.isFinite(maximum) && maximum > 0 ? maximum : value;
  const intensity = Math.min(1, value / scale);
  const index = Math.max(0, Math.min(INTENSITY_COLORS.length - 1, Math.ceil(intensity * INTENSITY_COLORS.length) - 1));
  return INTENSITY_COLORS[index];
}
