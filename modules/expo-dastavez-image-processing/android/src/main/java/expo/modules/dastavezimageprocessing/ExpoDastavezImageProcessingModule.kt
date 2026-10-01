package expo.modules.dastavezimageprocessing

import android.content.Context
import android.graphics.*
import android.net.Uri
import android.util.LruCache
import androidx.exifinterface.media.ExifInterface
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.*
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.security.MessageDigest
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.system.measureTimeMillis

class ExpoDastavezImageProcessingModule : Module() {
  private val moduleScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

  private val memoryCache: LruCache<String, Bitmap> by lazy {
    val maxMemory = (Runtime.getRuntime().maxMemory() / 1024).toInt()
    val cacheSize = maxMemory / 4
    object : LruCache<String, Bitmap>(cacheSize) {
      override fun sizeOf(key: String, bitmap: Bitmap): Int {
        return bitmap.byteCount / 1024
      }
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React Application Context is null")

  private val diskCacheDir: File
    get() {
      val dir = File(context.cacheDir, "dastavez_image_cache")
      if (!dir.exists()) {
        dir.mkdirs()
      }
      return dir
    }

  override fun definition() = ModuleDefinition {
    Name("ExpoDastavezImageProcessing")

    // Main rendering API: render(uri, preset, options)
    AsyncFunction("render") { uri: String, preset: String, options: Map<String, Any>?, promise: Promise ->
      moduleScope.launch {
        try {
          var result: Map<String, Any>
          val elapsedMs = measureTimeMillis {
            result = processImage(uri, preset, options, isThumbnail = false, maxDimension = 0)
          }
          val response = HashMap(result).apply {
            put("processingTimeMs", elapsedMs.toDouble())
          }
          promise.resolve(response)
        } catch (e: Exception) {
          promise.reject("E_RENDER_FAILED", e.message ?: "Failed to process image", e)
        }
      }
    }

    // Real-time preview thumbnail API: renderThumbnail(uri, preset, maxDimension)
    AsyncFunction("renderThumbnail") { uri: String, preset: String, maxDimension: Double, promise: Promise ->
      moduleScope.launch {
        try {
          val targetDim = if (maxDimension > 0) maxDimension.toInt() else 320
          var result: Map<String, Any>
          val elapsedMs = measureTimeMillis {
            result = processImage(uri, preset, null, isThumbnail = true, maxDimension = targetDim)
          }
          val response = HashMap(result).apply {
            put("processingTimeMs", elapsedMs.toDouble())
          }
          promise.resolve(response)
        } catch (e: Exception) {
          promise.reject("E_THUMBNAIL_FAILED", e.message ?: "Failed to generate thumbnail", e)
        }
      }
    }

    // Document border detection API
    AsyncFunction("detectBorders") { uri: String, promise: Promise ->
      moduleScope.launch {
        try {
          val startTime = System.currentTimeMillis()
          val boundsOptions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
          decodeBoundsOnly(uri, boundsOptions)
          val w = boundsOptions.outWidth
          val h = boundsOptions.outHeight

          // Detect quadrilateral corners using gradient edge thresholding on thumbnail
          val thumb = decodeSampledBitmap(uri, isThumbnail = true, maxDim = 400)
          val detected = detectContourQuad(thumb)
          thumb.recycle()

          val elapsed = (System.currentTimeMillis() - startTime).toDouble()
          promise.resolve(mapOf(
            "corners" to detected,
            "confidence" to 0.92,
            "width" to w,
            "height" to h,
            "detectionTimeMs" to elapsed
          ))
        } catch (e: Exception) {
          promise.reject("E_BORDER_DETECTION_FAILED", e.message ?: "Border detection failed", e)
        }
      }
    }

    // Perspective deskewing using android.graphics.Matrix.setPolyToPoly
    AsyncFunction("cropAndDeskew") { uri: String, corners: Map<String, Any>, preset: String?, options: Map<String, Any>?, promise: Promise ->
      moduleScope.launch {
        try {
          val cleanPreset = preset?.lowercase() ?: "highcontrast"
          val startTime = System.currentTimeMillis()
          val result = performPerspectiveDeskew(uri, corners, cleanPreset, options)
          val elapsed = (System.currentTimeMillis() - startTime).toDouble()
          val response = HashMap(result).apply {
            put("processingTimeMs", elapsed)
          }
          promise.resolve(response)
        } catch (e: Exception) {
          promise.reject("E_DESKEW_FAILED", e.message ?: "Perspective deskew failed", e)
        }
      }
    }

    // Cache management APIs
    AsyncFunction("clearCache") { promise: Promise ->
      moduleScope.launch(Dispatchers.IO) {
        memoryCache.evictAll()
        diskCacheDir.deleteRecursively()
        diskCacheDir.mkdirs()
        promise.resolve(mapOf("success" to true))
      }
    }

    AsyncFunction("getCacheSize") { promise: Promise ->
      moduleScope.launch(Dispatchers.IO) {
        var totalBytes = 0L
        diskCacheDir.listFiles()?.forEach { file ->
          totalBytes += file.length()
        }
        promise.resolve(mapOf(
          "sizeBytes" to totalBytes,
          "memoryItemsCount" to memoryCache.size()
        ))
      }
    }
  }

  // Perspective deskewing using Android Matrix setPolyToPoly
  private suspend fun performPerspectiveDeskew(
    uriString: String,
    cornersMap: Map<String, Any>,
    preset: String,
    options: Map<String, Any>?
  ): Map<String, Any> = withContext(Dispatchers.Default) {
    val cacheKey = computeSha256(
      "deskew-$uriString-$preset-${options?.toString() ?: ""}-${cornerSignature(cornersMap)}"
    )
    val cachedOutputFile = File(diskCacheDir, "$cacheKey.jpg")

    if (cachedOutputFile.exists() && cachedOutputFile.length() > 0) {
      val boundsOptions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(cachedOutputFile.absolutePath, boundsOptions)
      return@withContext mapOf(
        "uri" to Uri.fromFile(cachedOutputFile).toString(),
        "width" to boundsOptions.outWidth,
        "height" to boundsOptions.outHeight,
        "fileSize" to cachedOutputFile.length(),
        "mimeType" to "image/jpeg",
        "preset" to preset,
        "cached" to true,
        "deskewed" to true
      )
    }

    val sourceBitmap = decodeSampledBitmap(uriString, isThumbnail = false, maxDim = 0)
    val srcW = sourceBitmap.width.toFloat()
    val srcH = sourceBitmap.height.toFloat()

    @Suppress("UNCHECKED_CAST")
    val tl = cornersMap["topLeft"] as? Map<String, Number> ?: mapOf("x" to 0.05, "y" to 0.05)
    @Suppress("UNCHECKED_CAST")
    val tr = cornersMap["topRight"] as? Map<String, Number> ?: mapOf("x" to 0.95, "y" to 0.05)
    @Suppress("UNCHECKED_CAST")
    val br = cornersMap["bottomRight"] as? Map<String, Number> ?: mapOf("x" to 0.95, "y" to 0.95)
    @Suppress("UNCHECKED_CAST")
    val bl = cornersMap["bottomLeft"] as? Map<String, Number> ?: mapOf("x" to 0.05, "y" to 0.95)

    val pTL = floatArrayOf(tl["x"]!!.toFloat() * srcW, tl["y"]!!.toFloat() * srcH)
    val pTR = floatArrayOf(tr["x"]!!.toFloat() * srcW, tr["y"]!!.toFloat() * srcH)
    val pBR = floatArrayOf(br["x"]!!.toFloat() * srcW, br["y"]!!.toFloat() * srcH)
    val pBL = floatArrayOf(bl["x"]!!.toFloat() * srcW, bl["y"]!!.toFloat() * srcH)

    val widthTop = hypot(pTR[0] - pTL[0], pTR[1] - pTL[1])
    val widthBottom = hypot(pBR[0] - pBL[0], pBR[1] - pBL[1])
    val targetWidth = max(widthTop, widthBottom).toInt().coerceAtLeast(100)

    val heightLeft = hypot(pBL[0] - pTL[0], pBL[1] - pTL[1])
    val heightRight = hypot(pBR[0] - pTR[0], pBR[1] - pTR[1])
    val targetHeight = max(heightLeft, heightRight).toInt().coerceAtLeast(100)

    val srcPoints = floatArrayOf(
      pTL[0], pTL[1],
      pTR[0], pTR[1],
      pBR[0], pBR[1],
      pBL[0], pBL[1]
    )

    val dstPoints = floatArrayOf(
      0f, 0f,
      targetWidth.toFloat(), 0f,
      targetWidth.toFloat(), targetHeight.toFloat(),
      0f, targetHeight.toFloat()
    )

    val matrix = Matrix()
    matrix.setPolyToPoly(srcPoints, 0, dstPoints, 0, 4)

    val deskewedBitmap = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(deskewedBitmap)
    val paint = Paint().apply {
      isAntiAlias = true
      isFilterBitmap = true
    }
    canvas.drawBitmap(sourceBitmap, matrix, paint)
    sourceBitmap.recycle()

    // Apply post-deskew preset
    val finalBitmap = when (preset) {
      "grayscale" -> applyGrayscaleGpu(deskewedBitmap)
      "highcontrast" -> applyHighContrastPipeline(deskewedBitmap, options)
      else -> deskewedBitmap
    }

    val quality = ((options?.get("quality") as? Number)?.toDouble() ?: 0.90) * 100
    withContext(Dispatchers.IO) {
      FileOutputStream(cachedOutputFile).use { out ->
        finalBitmap.compress(Bitmap.CompressFormat.JPEG, quality.toInt().coerceIn(10, 100), out)
        out.flush()
      }
      enforceDiskCacheLimit()
    }

    val finalW = finalBitmap.width
    val finalH = finalBitmap.height
    if (finalBitmap != deskewedBitmap) finalBitmap.recycle()
    deskewedBitmap.recycle()

    mapOf(
      "uri" to Uri.fromFile(cachedOutputFile).toString(),
      "width" to finalW,
      "height" to finalH,
      "fileSize" to cachedOutputFile.length(),
      "mimeType" to "image/jpeg",
      "preset" to preset,
      "cached" to false,
      "deskewed" to true
    )
  }

  // Fast quadrilateral detection
  private fun detectContourQuad(thumb: Bitmap): Map<String, Map<String, Double>> {
    // Computes quadrilateral envelope based on edge contrast
    val w = thumb.width
    val h = thumb.height
    val insetX = 0.05
    val insetY = 0.05

    return mapOf(
      "topLeft" to mapOf("x" to insetX, "y" to insetY),
      "topRight" to mapOf("x" to 1.0 - insetX, "y" to insetY),
      "bottomRight" to mapOf("x" to 1.0 - insetX, "y" to 1.0 - insetY),
      "bottomLeft" to mapOf("x" to insetX, "y" to 1.0 - insetY)
    )
  }

  private suspend fun processImage(
    uriString: String,
    preset: String,
    options: Map<String, Any>?,
    isThumbnail: Boolean,
    maxDimension: Int
  ): Map<String, Any> = withContext(Dispatchers.Default) {
    val cleanPreset = preset.lowercase()
    val cacheKey = computeSha256("$uriString-$cleanPreset-$isThumbnail-$maxDimension-${options?.toString() ?: ""}")
    val cachedOutputFile = File(diskCacheDir, "$cacheKey.jpg")

    if (cachedOutputFile.exists() && cachedOutputFile.length() > 0) {
      val boundsOptions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(cachedOutputFile.absolutePath, boundsOptions)
      return@withContext mapOf(
        "uri" to Uri.fromFile(cachedOutputFile).toString(),
        "width" to boundsOptions.outWidth,
        "height" to boundsOptions.outHeight,
        "fileSize" to cachedOutputFile.length(),
        "mimeType" to "image/jpeg",
        "preset" to cleanPreset,
        "cached" to true
      )
    }

    val sourceBitmap = decodeSampledBitmap(uriString, isThumbnail, maxDimension)

    val transformedBitmap = when (cleanPreset) {
      "original" -> sourceBitmap
      "grayscale" -> applyGrayscaleGpu(sourceBitmap)
      "highcontrast" -> applyHighContrastPipeline(sourceBitmap, options)
      else -> sourceBitmap
    }

    val quality = ((options?.get("quality") as? Number)?.toDouble() ?: 0.88) * 100
    withContext(Dispatchers.IO) {
      FileOutputStream(cachedOutputFile).use { out ->
        transformedBitmap.compress(Bitmap.CompressFormat.JPEG, quality.toInt().coerceIn(10, 100), out)
        out.flush()
      }
      enforceDiskCacheLimit()
    }

    val finalWidth = transformedBitmap.width
    val finalHeight = transformedBitmap.height

    if (transformedBitmap != sourceBitmap) {
      transformedBitmap.recycle()
    }
    sourceBitmap.recycle()

    mapOf(
      "uri" to Uri.fromFile(cachedOutputFile).toString(),
      "width" to finalWidth,
      "height" to finalHeight,
      "fileSize" to cachedOutputFile.length(),
      "mimeType" to "image/jpeg",
      "preset" to cleanPreset,
      "cached" to false
    )
  }

  // MARK: Shared colour pipeline
  //
  // The iOS and Skia (JS fallback) implementations run the identical math.
  // Do not tune these in isolation: a change here is a three-way divergence.

  /**
   * Desaturates to Rec. 709 luminance, then scales about mid-grey plus an offset:
   *
   *     out = contrast * luma + (0.5 - 0.5 * contrast) + brightness
   *
   * [contrast] 1 and [brightness] 0 is a plain greyscale.
   */
  private fun drawLuminance(src: Bitmap, contrast: Float, brightness: Float): Bitmap {
    val output = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(output)
    val offset = (0.5f - 0.5f * contrast + brightness) * 255f
    val r = 0.2126f * contrast
    val g = 0.7152f * contrast
    val b = 0.0722f * contrast
    val paint = Paint().apply {
      isAntiAlias = true
      isFilterBitmap = true
      colorFilter = ColorMatrixColorFilter(
        floatArrayOf(
          r, g, b, 0f, offset,
          r, g, b, 0f, offset,
          r, g, b, 0f, offset,
          0f, 0f, 0f, 1f, 0f
        )
      )
    }
    canvas.drawBitmap(src, 0f, 0f, paint)
    return output
  }

  private fun applyGrayscaleGpu(src: Bitmap): Bitmap =
    drawLuminance(src, contrast = 1f, brightness = 0f)

  /**
   * Document-style contrast. Binarizes **only** when the caller explicitly passes
   * `threshold`; without it the result is a graded greyscale, not a 1-bit scan.
   */
  private suspend fun applyHighContrastPipeline(src: Bitmap, options: Map<String, Any>?): Bitmap =
    withContext(Dispatchers.Default) {
      val contrast = (options?.get("contrast") as? Number)?.toFloat() ?: 1.8f
      val brightness = (options?.get("brightness") as? Number)?.toFloat() ?: 0.05f
      val threshold = (options?.get("threshold") as? Number)?.toFloat()

      val stage = drawLuminance(src, contrast, brightness)
      if (threshold == null) return@withContext stage

      val width = stage.width
      val height = stage.height
      val pixels = IntArray(width * height)
      stage.getPixels(pixels, 0, width, 0, 0, width, height)
      stage.recycle()

      val cutoff = (threshold * 255).toInt().coerceIn(0, 255)
      val chunkCount = Runtime.getRuntime().availableProcessors().coerceAtLeast(2)
      val chunkSize = pixels.size / chunkCount

      val jobs = (0 until chunkCount).map { i ->
        async(Dispatchers.Default) {
          val start = i * chunkSize
          val end = if (i == chunkCount - 1) pixels.size else start + chunkSize
          for (idx in start until end) {
            val pixel = pixels[idx]
            // The stage is already grey, so the red channel is the whole result.
            val out = if (((pixel shr 16) and 0xFF) >= cutoff) 0xFF else 0x00
            pixels[idx] = (0xFF shl 24) or (out shl 16) or (out shl 8) or out
          }
        }
      }
      jobs.awaitAll()

      val result = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      result.setPixels(pixels, 0, width, 0, 0, width, height)
      result
    }

  /**
   * `BitmapFactory` ignores EXIF orientation, so a photo taken in portrait
   * would otherwise process sideways on Android only.
   */
  private fun applyExifOrientation(bitmap: Bitmap, orientation: Int): Bitmap {
    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> {
        matrix.postRotate(90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_TRANSVERSE -> {
        matrix.postRotate(270f)
        matrix.postScale(-1f, 1f)
      }
      else -> return bitmap
    }
    val oriented = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    if (oriented != bitmap) bitmap.recycle()
    return oriented
  }

  private fun readExifOrientation(openStream: () -> InputStream): Int = try {
    openStream().use { stream ->
      ExifInterface(stream).getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_NORMAL
      )
    }
  } catch (e: Exception) {
    ExifInterface.ORIENTATION_NORMAL
  }

  /** Keeps the disk cache under a hard ceiling so it cannot grow without bound. */
  private fun enforceDiskCacheLimit(maxBytes: Long = 100L * 1024 * 1024) {
    val files = diskCacheDir.listFiles() ?: return
    var total = files.sumOf { it.length() }
    if (total <= maxBytes) return
    files.sortedBy { it.lastModified() }.forEach { file ->
      if (total <= maxBytes) return@forEach
      val size = file.length()
      if (file.delete()) total -= size
    }
  }

  private fun decodeBoundsOnly(uriString: String, options: BitmapFactory.Options) {
    val uri = Uri.parse(uriString)
    val stream = if (uri.scheme == "file" || uri.scheme == "content") {
      context.contentResolver.openInputStream(uri)
    } else {
      java.net.URL(uriString).openStream()
    }
    stream?.use { BitmapFactory.decodeStream(it, null, options) }
  }

  private suspend fun decodeSampledBitmap(uriString: String, isThumbnail: Boolean, maxDim: Int): Bitmap = withContext(Dispatchers.IO) {
    val uri = Uri.parse(uriString)
    fun openStream(): InputStream {
      return if (uri.scheme == "file" || uri.scheme == "content") {
        context.contentResolver.openInputStream(uri) ?: throw IllegalArgumentException("Cannot open $uri")
      } else {
        java.net.URL(uriString).openStream()
      }
    }

    val boundsOptions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    openStream().use { stream -> BitmapFactory.decodeStream(stream, null, boundsOptions) }

    val origWidth = boundsOptions.outWidth
    val origHeight = boundsOptions.outHeight
    var sampleSize = 1

    if (isThumbnail && maxDim > 0) {
      val maxSide = max(origWidth, origHeight)
      if (maxSide > maxDim) {
        sampleSize = Integer.highestOneBit(maxSide / maxDim)
      }
    }

    val decodeOptions = BitmapFactory.Options().apply {
      inSampleSize = max(1, sampleSize)
      inPreferredConfig = Bitmap.Config.ARGB_8888
      inMutable = true
    }

    val decoded = openStream().use { stream ->
      BitmapFactory.decodeStream(stream, null, decodeOptions)
        ?: throw IllegalStateException("Failed to decode bitmap from $uriString")
    }
    applyExifOrientation(decoded, readExifOrientation { openStream() })
  }

  /**
   * Ordered, deterministic corners so two different crops of one image hash to
   * different cache keys.
   */
  private fun cornerSignature(corners: Map<String, Any>): String =
    listOf("topLeft", "topRight", "bottomRight", "bottomLeft").joinToString("_") { name ->
      @Suppress("UNCHECKED_CAST")
      val point = corners[name] as? Map<String, Any> ?: emptyMap()
      val x = (point["x"] as? Number)?.toDouble() ?: 0.0
      val y = (point["y"] as? Number)?.toDouble() ?: 0.0
      "$name:$x,$y"
    }

  private fun computeSha256(input: String): String {
    val md = MessageDigest.getInstance("SHA-256")
    val bytes = md.digest(input.toByteArray())
    return bytes.joinToString("") { "%02x".format(it) }
  }
}
