/**
 * Applies a page's chosen edits to its image.
 *
 * Two libraries, for two reasons:
 *
 * - Rotation is geometric, so `expo-image-manipulator` handles it. It is
 *   purpose-built for this and cheaper than a general renderer.
 * - Filters are tonal, and Expo's manipulator has no colour support at all, so
 *   a colour matrix is applied with Skia.
 *
 * Everything returns a **cache** URI. The caller decides whether to persist it.
 * Baking happens both for the preview and on save, so the two cannot disagree.
 */

import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ImageFormat, Skia } from '@shopify/react-native-skia';

import type { PageFilter } from './types';

/**
 * Skia colour matrices are 4x5, row-major, in the 0..1 range (unlike Android's
 * 0..255). Greyscale uses Rec. 709 luminance weights so the result matches how
 * the eye weights the channels.
 */
const COLOUR_MATRIX: Record<Exclude<PageFilter, 'original'>, number[]> = {
  greyscale: [
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0, 0, 0, 1, 0,
  ],
  highContrast: contrastMatrix(1.5),
};

/** Scales each channel about mid-grey. */
function contrastMatrix(amount: number): number[] {
  const offset = (1 - amount) / 2;
  return [
    amount, 0, 0, 0, offset,
    0, amount, 0, 0, offset,
    0, 0, amount, 0, offset,
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

/**
 * Bakes rotation and filter into the image, returning a cache URI.
 *
 * Returns `sourceUri` untouched when there is nothing to apply, which avoids a
 * pointless re-encode for the common case of an unedited import.
 */
export async function bakeImage(
  sourceUri: string,
  rotation: number,
  filter: PageFilter,
): Promise<string> {
  const rotated = rotation % 360 === 0 ? sourceUri : await rotateImage(sourceUri, rotation);
  return filter === 'original' ? rotated : await applyColourFilter(rotated, filter);
}
