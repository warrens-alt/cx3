import React, { useId } from 'react';

export interface SparklinePoint { date: string; value: number | null | undefined }
/** SVG geometry only. Null observations break the path; no missing days or values are filled. */
export default function MetricSparkline({ label, points, color }: { label: string; points: SparklinePoint[]; color: string }) {
  const id = useId();
  const valid = points.filter(point => typeof point.value === 'number' && Number.isFinite(point.value));
  if (valid.length < 2) return null;
  const maximum = Math.max(...valid.map(point => point.value!));
  const minimum = Math.min(...valid.map(point => point.value!));
  const dates = points.map(point => Date.parse(point.date));
  if (dates.some(date => !Number.isFinite(date)) || dates.some((date, index) => index > 0 && date <= dates[index - 1])) return null;
  const extent = dates[dates.length - 1] - dates[0];
  const x = (index: number) => 4 + (dates[index] - dates[0]) / extent * 192;
  const y = (value: number) => maximum === minimum ? 22 : 39 - (value - minimum) / (maximum - minimum) * 34;
  let drawing = false;
  const path = points.map((point, index) => {
    if (typeof point.value !== 'number' || !Number.isFinite(point.value)) { drawing = false; return ''; }
    // A gap in the returned calendar series is not a continuous observed trend.
    const consecutive = index > 0 && dates[index] - dates[index - 1] <= 86400000;
    const command = drawing && consecutive ? 'L' : 'M'; drawing = true;
    return `${command}${x(index)},${y(point.value)}`;
  }).join(' ');
  return <svg className="cx-metric-sparkline" viewBox="0 0 200 44" preserveAspectRatio="none" role="img" aria-labelledby={id}>
    <title id={id}>{`${label} · returned daily observations. Exact values are in Performance trend evidence.`}</title>
    <path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    {points.map((point, index) => typeof point.value === 'number' && Number.isFinite(point.value)
      ? <circle key={`${point.date}-${index}`} cx={x(index)} cy={y(point.value)} r="2" fill={color}><title>{`${point.date}: ${point.value.toLocaleString()}`}</title></circle> : null)}
  </svg>;
}
