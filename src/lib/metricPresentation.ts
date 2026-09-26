/** Keep missing telemetry distinct from a recorded zero, including in aggregates. */
export function sumRecordedValues(values: Array<number | null | undefined>): number | null {
  if (!values.length || values.some(value => value == null || !Number.isFinite(value))) return null;
  return values.reduce<number>((sum, value) => sum + value!, 0);
}

export function formatOperatingWindow(context: {
  start: string;
  end: string;
  timezone: string;
  workdays: number[];
}): string {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = [...new Set(context.workdays)].filter(day => Number.isInteger(day) && day >= 1 && day <= 7).sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let index = 0; index < days.length; index++) {
    const start = days[index];
    let end = start;
    while (days[index + 1] === end + 1) end = days[++index];
    ranges.push(start === end ? labels[start - 1] : `${labels[start - 1]}–${labels[end - 1]}`);
  }
  return `${ranges.join(', ') || 'No configured workdays'} · ${context.start}–${context.end} (${context.timezone})`;
}
