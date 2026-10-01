/**
 * Seam between the app and the native image processor vendored in `modules/`.
 *
 * The module is a local Expo module, so autolinking picks it up from
 * `modules/` and it needs no package dependency. Because it has native code it
 * only exists in a development or release build — Expo Go does not ship it —
 * so every entry point reports whether it actually handled the call and the
 * caller keeps its own fallback when it did not.
 *
 * Presence is checked here on purpose. The module's own loader falls through
 * to a DOM/canvas implementation when the native side is absent, which would
 * crash on iOS and Android, so it must never be reached on those platforms.
 */

import { Platform } from 'react-native';

import { cropAndDeskew, detectBorders, render } from '../../modules/expo-dastavez-image-processing/src/index';
import type { ImagePreset } from '../../modules/expo-dastavez-image-processing/src/ExpoDastavezImageProcessing.types';

import type { PageCorners, PageFilter } from './types';

/** The module spells greyscale the American way; the app does not. */
const PRESET: Record<Exclude<PageFilter, 'original'>, ImagePreset> = {
  greyscale: 'grayscale',
  highContrast: 'highContrast',
};

type NativeModule = { render?: unknown };

function nativeModule(): NativeModule | null {
  const scope = globalThis as { expo?: { modules?: Record<string, NativeModule | undefined> } };
  return scope.expo?.modules?.ExpoDastavezImageProcessing ?? null;
}

/** Whether the native processor is linked into this build. */
export function hasNativeImageProcessor(): boolean {
  return typeof nativeModule()?.render === 'function';
}

/**
 * Applies `filter` on the native side, or returns `null` so the caller falls
 * back. A native failure is not fatal: the same filter can still be done in
 * Skia, so an error only means the slower path runs.
 */
export async function applyNativeFilter(
  sourceUri: string,
  filter: Exclude<PageFilter, 'original'>,
): Promise<string | null> {
  if (!hasNativeImageProcessor()) return null;

  try {
    const result = await render(sourceUri, PRESET[filter]);
    return result.uri;
  } catch (error) {
    if (__DEV__) console.warn('Native filter failed, using Skia instead', error);
    return null;
  }
}

/**
 * Finds the document's corners in the image, in source space, to seed the crop
 * editor with. Returns `null` when detection is unavailable so the caller falls
 * back to the full image — the user drags from there either way.
 *
 * Only iOS detects for real. Android's detector is still a stub that always
 * reports a 5% inset, which would silently crop a margin off every page, so it
 * is not passed off as a result. Drop this gate when the stub becomes real.
 */
export async function detectPageCorners(sourceUri: string): Promise<PageCorners | null> {
  if (Platform.OS !== 'ios' || !hasNativeImageProcessor()) return null;

  try {
    const result = await detectBorders(sourceUri);
    return result.corners;
  } catch (error) {
    if (__DEV__) console.warn('Border detection failed, seeding the full image', error);
    return null;
  }
}

/**
 * Perspectively corrects and crops to `corners` on the native side. Returns
 * `null` when unavailable so the caller falls back to an axis-aligned crop.
 */
export async function cropToCorners(sourceUri: string, corners: PageCorners): Promise<string | null> {
  if (!hasNativeImageProcessor()) return null;

  try {
    const result = await cropAndDeskew(sourceUri, corners, 'original');
    return result.uri;
  } catch (error) {
    if (__DEV__) console.warn('Native crop failed, using a rectangle instead', error);
    return null;
  }
}
