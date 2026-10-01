export type ImagePreset = 'original' | 'grayscale' | 'highContrast';

export interface Point {
  /**
   * Normalized coordinate between 0.0 and 1.0 (relative to image width)
   */
  x: number;

  /**
   * Normalized coordinate between 0.0 and 1.0 (relative to image height)
   */
  y: number;
}

export interface DocumentCorners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface BorderDetectionResult {
  /**
   * Detected quadrilateral corners of the document
   */
  corners: DocumentCorners;

  /**
   * Detection confidence score (0.0 to 1.0)
   */
  confidence: number;

  /**
   * Image width in pixels
   */
  width: number;

  /**
   * Image height in pixels
   */
  height: number;

  /**
   * Time taken to detect borders in milliseconds
   */
  detectionTimeMs: number;
}

export interface RenderOptions {
  /**
   * Contrast multiplier (1.0 = normal, 2.0 = double, default 1.8 for highContrast)
   */
  contrast?: number;

  /**
   * Brightness offset (-1.0 to 1.0, default 0.05)
   */
  brightness?: number;

  /**
   * Binarization cutoff (0.0 to 1.0). Omitted by default — pass it explicitly to
   * opt in to a hard black/white threshold applied after the contrast stage.
   */
  threshold?: number;

  /**
   * Output JPEG quality (0.1 to 1.0, default 0.88)
   */
  quality?: number;
}

export interface RenderResult {
  /**
   * File URI of the processed image (e.g. file:///... or blob URL on web)
   * Guaranteed not to block the React Native bridge with megabyte base64 strings.
   */
  uri: string;

  /**
   * Output image width in pixels
   */
  width: number;

  /**
   * Output image height in pixels
   */
  height: number;

  /**
   * Output file size in bytes
   */
  fileSize: number;

  /**
   * MIME format of the output (usually image/jpeg)
   */
  mimeType: string;

  /**
   * The preset applied
   */
  preset: ImagePreset;

  /**
   * Whether the image was resolved immediately from the automatic cache
   */
  cached: boolean;

  /**
   * Execution duration in milliseconds
   */
  processingTimeMs: number;

  /**
   * Whether perspective deskew was applied
   */
  deskewed?: boolean;
}

export interface ThumbnailOptions {
  /**
   * Max dimension (width or height) in pixels. Default is 320px.
   */
  maxDimension?: number;
}

export interface CacheInfo {
  sizeBytes: number;
  memoryItemsCount: number;
}
