import type { Scalar } from '../bigquery/filters';
import { REPORT_MAX_ROWS, type ReleaseManifest, type VersionedReportRequest } from '../../contracts/reporting';
import { RequestError } from '../bigquery/filters';
import { reportScopeHash } from './scope';

export interface CompiledQuery {
  query: string;
  params: Record<string, Scalar>;
}

/** Reads approved output only. Canonical fact schemas/joins are not present in this revision. */
export function compileSnapshotReport(request: VersionedReportRequest, release: ReleaseManifest, metrics = request.metrics): CompiledQuery {
  if (!release.execution || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(release.execution.snapshot.table)) throw new RequestError('Approved aggregate snapshot is unavailable', 503);
  const params: Record<string, Scalar> = { tenant: request.tenantId, release: request.releaseId, scope: reportScopeHash(request) };
  const selected = metrics.map((id, i) => { params[`metric${i}`] = id; return `@metric${i}`; });
  if (!selected.length) throw new RequestError('No supported metrics selected', 422);
  return {
    query: `SELECT tenant_id, release_id, scope_hash, metric_id, definition_version, unit, grain,
      date_basis, is_total, group_key, value, numerator, denominator, completeness, reason
      FROM \`${release.execution.snapshot.table}\`
      WHERE tenant_id = @tenant AND release_id = @release AND scope_hash = @scope
        AND metric_id IN (${selected.join(', ')})
      ORDER BY metric_id, is_total DESC, group_key
      LIMIT ${REPORT_MAX_ROWS + 1}`,
    params,
  };
}
