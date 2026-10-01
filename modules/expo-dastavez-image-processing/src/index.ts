import ExpoDastavezImageProcessingModule from './ExpoDastavezImageProcessingModule';
import {
  renderWeb,
  clearCacheWeb,
  getCacheSizeWeb,
  detectBordersWeb,
  cropAndDeskewWeb
} from './ExpoDastavezImageProcessingModule.web';
import {
  ImagePreset,
  RenderOptions,
  RenderResult,
  CacheInfo,
  DocumentCorners,
  BorderDetectionResult
} from './ExpoDastavezImageProcessing.types';

export * from './ExpoDastavezImageProcessing.types';

/**
 * Renders an image using native GPU & SIMD acceleration:
 * - iOS: Swift + Core Image + Accelerate framework
 * - Android: Kotlin Bitmap + Coroutines multi-threading
 * - Web: WebGL hardware shader pipeline
 */
export async function render(
  uri: string,
  preset: ImagePreset,
  options?: RenderOptions
): Promise<RenderResult> {
  if (ExpoDastavezImageProcessingModule && ExpoDastavezImageProcessingModule.render) {
    return await ExpoDastavezImageProcessingModule.render(uri, preset, options ?? null);
  }
  return await renderWeb(uri, preset, options, false, 0);
}

/**
 * Generates an ultra-fast real-time preview thumbnail downsampled at decode time
 */
export async function renderThumbnail(
  uri: string,
  preset: ImagePreset,
  maxDimension: number = 320
): Promise<RenderResult> {
  if (ExpoDastavezImageProcessingModule && ExpoDastavezImageProcessingModule.renderThumbnail) {
    return await ExpoDastavezImageProcessingModule.renderThumbnail(uri, preset, maxDimension);
  }
  return await renderWeb(uri, preset, undefined, true, maxDimension);
}

/**
 * Automatically detects quadrilateral document boundaries and corner coordinates
 * - iOS: VNDetectRectanglesRequest / CIRectangleDetector
 * - Android: Canny edge gradient & contour envelope
 * - Web: Gradient thresholding & convex bounding
 */
export async function detectBorders(uri: string): Promise<BorderDetectionResult> {
  if (ExpoDastavezImageProcessingModule && ExpoDastavezImageProcessingModule.detectBorders) {
    return await ExpoDastavezImageProcessingModule.detectBorders(uri);
  }
  return await detectBordersWeb(uri);
}

/**
 * Performs perspective correction (deskewing) based on 4 corner coordinates,
 * transforming skewed/angled camera captures into perfectly rectangular scans.
 *
 * - iOS: Metal GPU CIPerspectiveCorrection
 * - Android: Matrix.setPolyToPoly hardware rasterization
 * - Web: WebGL homography perspective shader
 *
 * @param uri Image URI
 * @param corners Quadrilateral corner coordinates (topLeft, topRight, bottomRight, bottomLeft)
 * @param preset Image transformation preset to apply after deskewing ('original' | 'grayscale' | 'highContrast')
 * @param options Contrast, brightness, and threshold options
 */
export async function cropAndDeskew(
  uri: string,
  corners: DocumentCorners,
  preset: ImagePreset = 'highContrast',
  options?: RenderOptions
): Promise<RenderResult> {
  if (ExpoDastavezImageProcessingModule && ExpoDastavezImageProcessingModule.cropAndDeskew) {
    return await ExpoDastavezImageProcessingModule.cropAndDeskew(uri, corners, preset, options ?? null);
  }
  return await cropAndDeskewWeb(uri, corners, preset, options);
}

/**
 * Purges both in-memory LRU cache and persistent disk cache.
 */
export async function clearCache(): Promise<{ success: boolean }> {
  if (ExpoDastavezImageProcessingModule && ExpoDastavezImageProcessingModule.clearCache) {
    return await ExpoDastavezImageProcessingModule.clearCache();
  }
  return clearCacheWeb();
}

/**
 * Returns current disk and memory cache footprint in bytes and count.
 */
export async function getCacheSize(): Promise<CacheInfo> {
  if (ExpoDastavezImageProcessingModule && ExpoDastavezImageProcessingModule.getCacheSize) {
    return await ExpoDastavezImageProcessingModule.getCacheSize();
  }
  return getCacheSizeWeb();
}
