export const privateScopeKeys = new Set<string>(['lead_id', 'consumer_id']);

export function isPrivateScopeKey(key: string): boolean {
  return privateScopeKeys.has(key);
}

export function maskScopeValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  return '••••••••';
}
