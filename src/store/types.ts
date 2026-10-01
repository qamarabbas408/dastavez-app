/**
 * Domain types for the Dastavez prototype.
 *
 * Everything here is fictional and in-memory. There are no real files, no real
 * OCR, and no persistence — a document is a record in the store's array and
 * nothing else.
 */

export type FileKind = 'pdf' | 'jpeg';

export type OcrStatus = 'pending' | 'complete' | 'failed' | 'unavailable';

/** A single captured or imported page. `imageTint` stands in for the preview. */
export type MockPage = {
  id: string;
  /** Index within the owning draft or document, 0-based. */
  order: number;
  label: string;
  /** Rotation in degrees: 0, 90, 180, or 270. */
  rotation: number;
  /** Simulated filter treatment applied in Edit & Save. */
  filter: PageFilter;
};

export type PageFilter = 'original' | 'greyscale' | 'highContrast';

export type MockDocument = {
  id: string;
  title: string;
  /** ISO date string, e.g. '2026-08-14'. */
  date: string;
  fileType: FileKind;
  pages: MockPage[];
  ocrStatus: OcrStatus;
  /** Sample recognised text. Fictional, and intentionally short. */
  ocrText: string;
};

/**
 * A document being built. Lives in the store only while the user is working on
 * it; discarded drafts simply stop being referenced.
 */
export type Draft = {
  /** How the draft was started, which decides the Back target. */
  origin: 'scan' | 'import';
  pages: MockPage[];
  title: string;
  /** Multipage PDF toggle from Edit & Save. */
  exportAsPdf: boolean;
  ocrEnabled: boolean;
  ocrStatus: OcrStatus;
  ocrText: string;
};

/** Item offered by the mock Photos or PDFs picker. */
export type MockSourceItem = {
  id: string;
  title: string;
  subtitle: string;
  /** Number of pages the item would contribute to the draft. */
  pageCount: number;
  kind: FileKind;
};

export type SourceKind = 'photos' | 'pdfs';

/**
 * Developer toggles that force the prototype into a specific state so a
 * reviewer can reach every failure and empty state. All default to `false`;
 * `__DEV__` only, and none of them exist in a release build.
 */
export type FailureFlags = {
  emptyLibrary: boolean;
  permissionDenied: boolean;
  unlockCancelled: boolean;
  ocrFailure: boolean;
  lowStorage: boolean;
  exportCancelled: boolean;
};

/** Transient status line shown after a cancelled or failed action. */
export type StatusMessage = {
  tone: 'info' | 'warning' | 'danger' | 'success';
  text: string;
} | null;