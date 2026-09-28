import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Define the 'users' table linking to Firebase Auth UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Records pulled from Google Cloud BigQuery and cached in Cloud SQL
export const syncedRecords = pgTable('synced_records', {
  id: serial('id').primaryKey(),
  project: text('project').notNull(),
  dataset: text('dataset').notNull(),
  tableName: text('table_name').notNull(),
  recordKey: text('record_key'),
  data: text('data').notNull(), // JSON stringified data
  syncedAt: timestamp('synced_at').defaultNow(),
  syncedBy: text('synced_by'),
});

