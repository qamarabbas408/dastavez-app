/**
 * Normalises whatever a platform API throws into a `DataError`.
 *
 * Storage-full is the one case worth naming at the call site, because the UI
 * already has a dedicated low-storage state. Everything else falls back to the
 * caller's code, so an unrecognised failure is still labelled by context.
 */

import type { DataError, DataErrorCode } from './types';

const STORAGE_FULL_PATTERNS = [/no space left/i, /enospc/i, /not enough space/i, /disk full/i];

export function toDataError(error: unknown, fallback: DataErrorCode = 'unknown'): DataError {
  const message = error instanceof Error ? error.message : String(error);
  const isStorageFull = STORAGE_FULL_PATTERNS.some((pattern) => pattern.test(message));

  return {
    code: isStorageFull ? 'storage-full' : fallback,
    message,
    cause: error,
  };
}
