/** Human-readable presentation only; source status codes remain unchanged. */
export function statusLabel(status: string): string {
  const text = status.trim().replace(/[_-]+/g, ' ').toLowerCase();
  return text ? text[0].toUpperCase() + text.slice(1) : 'Not verified';
}
