import { RequestError } from '../bigquery/filters';
import type { ReleaseManifest } from '../../contracts/reporting';

export function validateRelease(raw: any): ReleaseManifest {
  if (!raw || typeof raw !== 'object') {
    throw new RequestError('Invalid release manifest format', 503);
  }
  if (!raw.releaseId || typeof raw.releaseId !== 'string') {
    throw new RequestError('Missing or invalid releaseId in manifest', 503);
  }
  if (!raw.tenantId || typeof raw.tenantId !== 'string') {
    throw new RequestError('Missing or invalid tenantId in manifest', 503);
  }
  if (raw.status !== 'PUBLISHED' && raw.status !== 'REVOKED') {
    throw new RequestError('Invalid release status in manifest', 503);
  }
  return raw as ReleaseManifest;
}
