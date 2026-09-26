import { RequestError } from './filters';
import { validTimestampSql } from './integrity';

/** Preserve source-metric UTC semantics while keeping native date columns unwrapped.
 * The CSV does not prove partitioning: this enables pruning where configured, not a
 * claim that a particular source is partitioned. String dates retain safe parsing.
 */
export function sourceDateFilter(column: string, type: string): { sql: string; strategy: string } {
  if (!/^s\.\`[A-Za-z_][A-Za-z0-9_]*\`$/.test(column)) throw new RequestError('Invalid source date column', 503);
  const native = type.toUpperCase();
  const noSentinel = `EXTRACT(YEAR FROM ${column}) NOT IN (1900, 1970)`;
  if (native === 'DATE') return {
    sql: `${column} BETWEEN DATE(@startDate) AND DATE(@endDate) AND ${noSentinel}`,
    strategy: 'native_date_range',
  };
  if (native === 'TIMESTAMP' || native === 'DATETIME') return {
    sql: `${column} >= ${native}(@startDate) AND ${column} < ${native}(DATE_ADD(DATE(@endDate), INTERVAL 1 DAY)) AND ${noSentinel}`,
    strategy: `native_${native.toLowerCase()}_range`,
  };
  if (native === 'STRING') return {
    sql: `DATE(${validTimestampSql(column)}) BETWEEN @startDate AND @endDate`,
    strategy: 'safe_string_timestamp_range',
  };
  throw new RequestError('Unsupported source date type', 422);
}
