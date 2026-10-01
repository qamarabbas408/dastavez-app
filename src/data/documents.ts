/**
 * Document repository — the only place that reads or writes document rows.
 *
 * Screens call these functions and dispatch the result into the UI store; they
 * never write SQL themselves. Keeping the queries here means the schema and the
 * row mappings cannot drift apart, and it is the seam that would be swapped for
 * a different storage engine later.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { deletePageFile } from './page-store';
import type {
  DocumentRecord,
  FileKind,
  NewDocument,
  OcrStatus,
  Page,
  PageFilter,
} from './types';

type DocumentRow = {
  id: string;
  title: string;
  date: string;
  file_type: FileKind;
  ocr_status: OcrStatus;
  ocr_text: string;
  created_at: number;
};

type PageRow = {
  id: string;
  document_id: string;
  order_index: number;
  uri: string;
  rotation: number;
  filter: PageFilter;
};

const DOCUMENT_COLUMNS = 'id, title, date, file_type, ocr_status, ocr_text, created_at';
const PAGE_COLUMNS = 'id, document_id, order_index, uri, rotation, filter';

function toPage(row: PageRow): Page {
  return {
    id: row.id,
    documentId: row.document_id,
    order: row.order_index,
    uri: row.uri,
    rotation: row.rotation,
    filter: row.filter,
  };
}

function toDocument(row: DocumentRow, pages: Page[]): DocumentRecord {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    fileType: row.file_type,
    ocrStatus: row.ocr_status,
    ocrText: row.ocr_text,
    createdAt: row.created_at,
    pages,
  };
}

/** All documents, newest first, each with its pages attached in order. */
export async function listDocuments(db: SQLiteDatabase): Promise<DocumentRecord[]> {
  const documents = await db.getAllAsync<DocumentRow>(
    `SELECT ${DOCUMENT_COLUMNS} FROM documents ORDER BY created_at DESC`,
  );
  if (documents.length === 0) return [];

  // One extra query rather than one per document. At prototype scale the pages
  // table is small, and this avoids an N+1 that would grow with the library.
  const pages = await db.getAllAsync<PageRow>(
    `SELECT ${PAGE_COLUMNS} FROM pages ORDER BY document_id, order_index`,
  );

  const pagesByDocument = new Map<string, Page[]>();
  for (const row of pages) {
    const page = toPage(row);
    const existing = pagesByDocument.get(row.document_id);
    if (existing) existing.push(page);
    else pagesByDocument.set(row.document_id, [page]);
  }

  return documents.map((row) => toDocument(row, pagesByDocument.get(row.id) ?? []));
}

/**
 * Number of stored documents.
 *
 * Settings shows this count, and counting rows is cheaper than loading every
 * document and its pages just to look at `.length`.
 */
export async function countDocuments(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM documents');
  return row?.count ?? 0;
}

export async function getDocument(
  db: SQLiteDatabase,
  id: string,
): Promise<DocumentRecord | null> {
  const row = await db.getFirstAsync<DocumentRow>(
    `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE id = ?`,
    [id],
  );
  if (!row) return null;

  const pages = await db.getAllAsync<PageRow>(
    `SELECT ${PAGE_COLUMNS} FROM pages WHERE document_id = ? ORDER BY order_index`,
    [id],
  );

  return toDocument(row, pages.map(toPage));
}

/**
 * Inserts a document and its pages atomically. Page ids are assigned here, so
 * callers supply file locations rather than identity.
 */
export async function insertDocument(
  db: SQLiteDatabase,
  input: NewDocument,
): Promise<DocumentRecord> {
  const createdAt = Date.now();
  const record: DocumentRecord = {
    id: input.id,
    title: input.title,
    date: input.date,
    fileType: input.fileType,
    ocrStatus: input.ocrStatus ?? 'pending',
    ocrText: input.ocrText ?? '',
    createdAt,
    pages: [],
  };

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO documents (${DOCUMENT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.title,
        record.date,
        record.fileType,
        record.ocrStatus,
        record.ocrText,
        createdAt,
      ],
    );

    for (const [index, page] of input.pages.entries()) {
      const order = page.order ?? index;
      const rotation = page.rotation ?? 0;
      const filter = page.filter ?? 'original';

      await txn.runAsync(
        `INSERT INTO pages (id, document_id, order_index, uri, rotation, filter)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [page.id, record.id, order, page.uri, rotation, filter],
      );

      record.pages.push({
        id: page.id,
        documentId: record.id,
        order,
        uri: page.uri,
        rotation,
        filter,
      });
    }
  });

  return record;
}

/**
 * Removes every document and its image files.
 *
 * Used by the destructive "delete all" action in Settings. Page URIs are read
 * first because the cascade removes rows without knowing about the filesystem.
 */
export async function deleteAllDocuments(db: SQLiteDatabase): Promise<void> {
  const pages = await db.getAllAsync<PageRow>(`SELECT ${PAGE_COLUMNS} FROM pages`);

  await db.runAsync('DELETE FROM documents');

  for (const page of pages) {
    deletePageFile(page.uri);
  }
}

/**
 * Removes a document, its page rows via `ON DELETE CASCADE`, and the image
 * files behind them.
 *
 * Page URIs are read first because the cascade removes rows without knowing
 * anything about the filesystem.
 */
export async function deleteDocument(db: SQLiteDatabase, id: string): Promise<void> {
  const pages = await db.getAllAsync<PageRow>(
    `SELECT ${PAGE_COLUMNS} FROM pages WHERE document_id = ?`,
    [id],
  );

  await db.runAsync('DELETE FROM documents WHERE id = ?', [id]);

  // Best effort: an orphaned file wastes space, whereas a missing row loses data.
  for (const page of pages) {
    deletePageFile(page.uri);
  }
}
