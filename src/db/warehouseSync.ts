import { db } from './index.ts';
import { syncedRecords } from './schema.ts';
import { desc, eq, and } from 'drizzle-orm';

export interface SyncedRecordItem {
  project: string;
  dataset: string;
  tableName: string;
  recordKey?: string;
  data: Record<string, any>;
  syncedBy?: string;
}

export async function saveSyncedWarehouseRecords(
  records: SyncedRecordItem[],
  syncedBy: string = 'system'
): Promise<number> {
  if (!records || records.length === 0) return 0;

  const rowsToInsert = records.map(r => ({
    project: r.project,
    dataset: r.dataset,
    tableName: r.tableName,
    recordKey: r.recordKey || null,
    data: JSON.stringify(r.data),
    syncedBy: r.syncedBy || syncedBy,
  }));

  // Batch insert into Cloud SQL
  await db.insert(syncedRecords).values(rowsToInsert);
  return rowsToInsert.length;
}

export async function getSyncedRecords(options: {
  project?: string;
  dataset?: string;
  tableName?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { project, dataset, tableName, limit = 50, offset = 0 } = options;

  let query = db.select().from(syncedRecords);

  const conditions = [];
  if (project) conditions.push(eq(syncedRecords.project, project));
  if (dataset) conditions.push(eq(syncedRecords.dataset, dataset));
  if (tableName) conditions.push(eq(syncedRecords.tableName, tableName));

  if (conditions.length > 0) {
    query = (query as any).where(and(...conditions));
  }

  const results = await query
    .orderBy(desc(syncedRecords.syncedAt))
    .limit(limit)
    .offset(offset);

  return results.map(row => ({
    id: row.id,
    project: row.project,
    dataset: row.dataset,
    tableName: row.tableName,
    recordKey: row.recordKey,
    data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    syncedAt: row.syncedAt,
    syncedBy: row.syncedBy,
  }));
}
