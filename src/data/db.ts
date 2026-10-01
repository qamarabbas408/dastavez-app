/**
 * Database connection setup and schema.
 *
 * The schema is created once and versioned with SQLite's own `user_version`
 * pragma, which is the pattern Expo documents. When the shape changes, add a
 * branch below and bump `SCHEMA_VERSION` rather than editing an existing step:
 * existing installs only ever run steps newer than their stored version.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'dastavez.db';

const SCHEMA_VERSION = 1;

/**
 * Runs on every database connection, not just the first launch.
 *
 * `foreign_keys` is per-connection in SQLite, so it has to be re-issued each
 * time or `ON DELETE CASCADE` silently stops working.
 */
export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE documents (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        file_type TEXT NOT NULL,
        ocr_status TEXT NOT NULL,
        ocr_text TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );

      CREATE TABLE pages (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        order_index INTEGER NOT NULL,
        uri TEXT NOT NULL,
        rotation INTEGER NOT NULL DEFAULT 0,
        filter TEXT NOT NULL DEFAULT 'original'
      );

      CREATE INDEX idx_pages_document ON pages(document_id, order_index);
      CREATE INDEX idx_documents_created ON documents(created_at DESC);
    `);
  }

  // SCHEMA_VERSION is a module constant, never user input.
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
