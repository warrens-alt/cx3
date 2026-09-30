/** Coordinates only: exact values remain in labels and evidence tables. Missing is never zero. */
export function chartCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
