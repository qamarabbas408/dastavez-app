/**
 * Applies a page's chosen edits to its image.
 *
 * Three routes, for three reasons:
 *
 * - Crop and rotation are geometric. The native processor does the crop as a
 *   perspective correction; `expo-image-manipulator` handles rotation and acts
 *   as the axis-aligned fallback for the crop.
 * - Filters are tonal, and Expo's manipulator has no colour support at all.
 *   The native processor vendored in `modules/` does this on the GPU when it
 *   is linked into the build.
 * - When it is not — Expo Go, or a native failure — a colour matrix in Skia
 *   produces the same effect, so the app never depends on a dev build.
 *
 * Everything returns a **cache** URI. The caller decides whether to persist it.
 * Baking happens both for the preview and on save, so the two cannot disagree.
 */

import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ImageFormat, Skia } from '@shopify/react-native-skia';

import { applyNativeFilter, cropToCorners } from './native-image';
import type { PageCorners, PageFilter } from './types';

/**
 * Skia colour matrices are 4x5, row-major, in the 0..1 range (unlike Android's
 * 0..255). These are not taste decisions — they mirror the native processor in
 * `modules/expo-dastavez-image-processing` exactly, so a filter looks the same
 * whether the module is linked or Skia is doing the work.
 */
const COLOUR_MATRIX: Record<Exclude<PageFilter, 'original'>, number[]> = {
  greyscale: luminanceMatrix(1, 0),
  highContrast: luminanceMatrix(1.8, 0.05),
};

/**
 * Rec. 709 luminance scaled about mid-grey, plus a brightness offset:
 *
 *     out = contrast * luma + (0.5 - 0.5 * contrast) + brightness
 *
 * `contrast` 1 and `brightness` 0 is a plain greyscale. The native paths pass
 * the same two numbers and compute the same offset.
 */
function luminanceMatrix(contrast: number, brightness: number): number[] {
  const offset = 0.5 - 0.5 * contrast + brightness;
  const r = 0.2126 * contrast;
  const g = 0.7152 * contrast;
  const b = 0.0722 * contrast;
  return [
    r, g, b, 0, offset,
    r, g, b, 0, offset,
    r, g, b, 0, offset,
    0, 0, 0, 1, 0,
  ];
}

async function rotateImage(sourceUri: string, degrees: number): Promise<string> {
  const context = ImageManipulator.manipulate(sourceUri);
  context.rotate(degrees);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return saved.uri;
}

async function applyColourFilter(
  sourceUri: string,
  filter: Exclude<PageFilter, 'original'>,
): Promise<string> {
  const native = await applyNativeFilter(sourceUri, filter);
  if (native) return native;

  const data = Skia.Data.fromBytes(await new File(sourceUri).bytes());
  const image = Skia.Image.MakeImageFromEncoded(data);

  if (!image) {
    data.dispose();
    throw new Error('Could not read the page image.');
  }

  try {
    const surface = Skia.Surface.Make(image.width(), image.height());
    if (!surface) throw new Error('Could not prepare the image.');

    try {
      const paint = Skia.Paint();
      try {
        paint.setColorFilter(Skia.ColorFilter.MakeMatrix(COLOUR_MATRIX[filter]));

        surface.getCanvas().drawImage(image, 0, 0, paint);
        surface.flush();

        const snapshot = surface.makeImageSnapshot();
        try {
          const encoded = snapshot.encodeToBytes(ImageFormat.JPEG, 90);
          const output = new File(Paths.cache, `dastavez-edit-${fileToken()}.jpg`);
          output.create({ intermediates: true });
          output.write(encoded);
          return output.uri;
        } finally {
          snapshot.dispose();
        }
      } finally {
        paint.dispose();
      }
    } finally {
      surface.dispose();
    }
  } finally {
    image.dispose();
    data.dispose();
  }
}

/** Unique enough for a scratch file name. */
function fileToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const CORNER_KEYS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const;

/** The whole image: the identity crop, and what a crop is seeded from. */
export const FULL_FRAME: PageCorners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 1, y: 0 },
  bottomRight: { x: 1, y: 1 },
  bottomLeft: { x: 0, y: 1 },
};

/** Whether the corners still span the whole image, so applying would change nothing. */
function isFullFrame(corners: PageCorners): boolean {
  return CORNER_KEYS.every((key) => {
    const actual = corners[key];
    const expected = FULL_FRAME[key];
    return Math.abs(actual.x - expected.x) < 0.002 && Math.abs(actual.y - expected.y) < 0.002;
  });
}

async function imageSize(uri: string): Promise<{ width: number; height: number }> {
  const image = await Image.loadAsync(uri);
  return { width: image.width, height: image.height };
}

/**
 * Axis-aligned bounding box of the quad, used when the native processor is not
 * available. The region is still kept exactly as selected; only the perspective
 * straightening is lost.
 */
async function cropRectangle(sourceUri: string, corners: PageCorners): Promise<string> {
  const points = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));

  const size = await imageSize(sourceUri);
  const originX = Math.min(size.width - 1, Math.max(0, Math.round(left * size.width)));
  const originY = Math.min(size.height - 1, Math.max(0, Math.round(top * size.height)));
  const width = Math.max(1, Math.min(size.width - originX, Math.round((right - left) * size.width)));
  const height = Math.max(1, Math.min(size.height - originY, Math.round((bottom - top) * size.height)));

  const context = ImageManipulator.manipulate(sourceUri);
  context.crop({ originX, originY, width, height });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return saved.uri;
}

async function cropImage(sourceUri: string, corners: PageCorners): Promise<string> {
  const native = await cropToCorners(sourceUri, corners);
  if (native) return native;
  return cropRectangle(sourceUri, corners);
}

/**
 * Bakes crop, rotation, and filter into the image, returning a cache URI.
 *
 * Crop runs first because `corners` are normalized to the source image, so the
 * order of crop and rotation does not matter to the result — but running crop
 * first means the rotation step re-encodes a smaller image.
 *
 * Returns `sourceUri` untouched when there is nothing to apply, which avoids a
 * pointless re-encode for the common case of an unedited import.
 */
export async function bakeImage(
  sourceUri: string,
  rotation: number,
  filter: PageFilter,
  corners?: PageCorners,
): Promise<string> {
  const cropped =
    corners && !isFullFrame(corners) ? await cropImage(sourceUri, corners) : sourceUri;
  const rotated = rotation % 360 === 0 ? cropped : await rotateImage(cropped, rotation);
  return filter === 'original' ? rotated : await applyColourFilter(rotated, filter);
}
