/**
 * One entry point for bringing the data layer up.
 *
 * `SQLiteProvider` calls this once the connection is open, before any screen
 * renders. It creates the schema and makes sure the page image directory
 * exists, so screens can assume both without checking.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { initializeDatabase } from './db';
import { ensurePageStorage } from './page-store';

export async function bootstrapDataLayer(db: SQLiteDatabase): Promise<void> {
  await initializeDatabase(db);
  ensurePageStorage();
}
