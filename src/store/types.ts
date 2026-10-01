/**
 * Session state types for the store.
 *
 * Persisted documents are described by `DocumentRecord` and `Page` in
 * `src/data/types`. This file covers the unfinished draft and the UI states
 * around it.
 */

import type { FileKind, OcrStatus, PageFilter } from '@/data/types';

/**
 * Canonical definitions live in `src/data/types`; re-exported here so screens
 * can import the shared enums from either place.
 */
export type { FileKind, OcrStatus, PageFilter };

/**
 * A page while it is part of an unfinished draft.
 *
 * `uri` is present once the page has a real image — imported photos today, real
 * captures later. It is absent for mock-captured pages, which have no file.
 */
export type DraftPage = {
  id: string;
  /** Index within the draft, 0-based. */
  order: number;
  label: string;
  uri?: string;
  /** Rotation in degrees: 0, 90, 180, or 270. */
  rotation: number;
  /** Filter treatment. Not yet applied to real images. */
  filter: PageFilter;
};

/**
 * A document being built. Lives in the store only while the user is working on
 * it; a draft that is discarded or saved simply stops being referenced.
 */
export type Draft = {
  /** How the draft was started, which decides the Back target. */
  origin: 'scan' | 'import';
  pages: DraftPage[];
  title: string;
  /** Multipage PDF toggle from Edit & Save. */
  exportAsPdf: boolean;
  ocrEnabled: boolean;
  ocrStatus: OcrStatus;
  ocrText: string;
};

/** Item offered by the simulated PDF picker, which is still fictional. */
export type MockSourceItem = {
  id: string;
  title: string;
  subtitle: string;
  /** Number of pages the item would contribute to the draft. */
  pageCount: number;
  kind: FileKind;
};

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
