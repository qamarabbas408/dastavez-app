/**
 * Loading state for an async read.
 *
 * Every screen that reads from the database needs the same three outcomes —
 * loading, loaded, failed — so they are modelled once here rather than as
 * ad-hoc booleans per screen.
 *
 * `load` must be memoised by the caller, usually with `useCallback`. That is
 * what lets the effect depend on it directly instead of on a hand-maintained
 * dependency list.
 */

import { useCallback, useEffect, useState } from 'react';

import { toDataError } from './errors';
import type { DataError, DataErrorCode } from './types';

export type AsyncState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: DataError };

const LOADING = { status: 'loading', data: null, error: null } as const;

export type AsyncResource<T> = AsyncState<T> & { reload: () => void };

export function useAsyncData<T>(
  load: () => Promise<T>,
  fallbackCode: DataErrorCode = 'read-failed',
): AsyncResource<T> {
  const [state, setState] = useState<AsyncState<T>>(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    load()
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', data: null, error: toDataError(error, fallbackCode) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [load, attempt, fallbackCode]);

  /**
   * Bumps the attempt counter, which re-runs the effect.
   *
   * Deliberately does not reset to `loading`: a refresh caused by returning to a
   * screen should not flash a spinner over data that is already on screen.
   */
  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  return { ...state, reload };
}
