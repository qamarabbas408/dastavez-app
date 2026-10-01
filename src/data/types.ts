/**
 * Canonical domain types for persisted documents.
 *
 * These are the real equivalents of the `Mock*` types in `src/store/types.ts`:
 * a page now has a `uri` pointing at an image file on disk and a `documentId`,
 * and a document carries a `createdAt` for ordering. There is no `label`,
 * because a page's label is derived from its position.
 *
 * The shared enums live here and are re-exported by the store, so there is one
 * definition of each.
 */

export type FileKind = 'pdf' | 'jpeg';

export type OcrStatus = 'pending' | 'complete' | 'failed' | 'unavailable';

export type PageFilter = 'original' | 'greyscale' | 'highContrast';

/** A point normalized 0..1 against the source image's width and height. */
export type NormalizedPoint = { x: number; y: number };

/**
 * The four corners of a page's crop region, in source-image space.
 *
 * Source space rather than display space so rotation and crop stay independent:
 * the corners keep naming the same pixels whichever way the page is turned.
 * Baked into the image on save, so no persisted record carries them.
 */
export type PageCorners = {
  topLeft: NormalizedPoint;
  topRight: NormalizedPoint;
  bottomRight: NormalizedPoint;
  bottomLeft: NormalizedPoint;
};

/** A page whose image is stored on disk. */
export type Page = {
  id: string;
  documentId: string;
  order: number;
  /** `file://` URI of the image in app storage. */
  uri: string;
  /** Rotation in degrees: 0, 90, 180, or 270. */
  rotation: number;
  filter: PageFilter;
};

export type DocumentRecord = {
  id: string;
  title: string;
  /** ISO date, e.g. '2026-08-14'. */
  date: string;
  fileType: FileKind;
  ocrStatus: OcrStatus;
  ocrText: string;
  /** Epoch milliseconds; the library is ordered by this. */
  createdAt: number;
  pages: Page[];
};

/**
 * A page ready to be persisted.
 *
 * The id comes from the caller because it is also the image file's name — the
 * repository cannot assign one without disagreeing with what is on disk.
 */
export type NewPage = {
  id: string;
  uri: string;
  order?: number;
  rotation?: number;
  filter?: PageFilter;
};

/** A document before persistence. */
export type NewDocument = {
  id: string;
  title: string;
  date: string;
  fileType: FileKind;
  ocrStatus?: OcrStatus;
  ocrText?: string;
  pages: NewPage[];
};

/**
 * Failure surface for data operations. Real errors need codes, not just
 * messages, because screens react differently to a full disk than to a missing
 * record.
 */
export type DataErrorCode =
  | 'not-found'
  | 'storage-full'
  | 'read-failed'
  | 'write-failed'
  | 'unknown';

export type DataError = {
  code: DataErrorCode;
  message: string;
  cause?: unknown;
};
