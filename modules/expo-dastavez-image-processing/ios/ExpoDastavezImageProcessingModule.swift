import ExpoModulesCore
import CoreImage
import CoreImage.CIFilterBuiltins
import Accelerate
import Metal
import CommonCrypto
import Vision
import UIKit

public class ExpoDastavezImageProcessingModule: Module {
  // Metal-backed CIContext for GPU-accelerated rendering
  private lazy var ciContext: CIContext = {
    if let metalDevice = MTLCreateSystemDefaultDevice() {
      return CIContext(mtlDevice: metalDevice, options: [
        .useSoftwareRenderer: false,
        .priorityRequestLow: false,
        .cacheIntermediates: true
      ])
    }
    return CIContext(options: [.useSoftwareRenderer: false])
  }()

  // Dedicated high-priority background queue for asynchronous pixel manipulation
  private let processingQueue = DispatchQueue(
    label: "org.dastavez.imageprocessing.worker",
    qos: .userInitiated,
    attributes: .concurrent
  )

  // In-memory LRU cache for ultra-fast repeated preview retrieval
  private let memoryCache = NSCache<NSString, UIImage>()

  // Dedicated disk cache directory for large file persistence without bridge memory overhead
  private lazy var diskCacheDirectory: URL = {
    let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    let dastavezDir = cacheDir.appendingPathComponent("dastavez_image_cache", isDirectory: true)
    try? FileManager.default.createDirectory(at: dastavezDir, withIntermediateDirectories: true)
    return dastavezDir
  }()

  public func definition() -> ModuleDefinition {
    Name("ExpoDastavezImageProcessing")

    OnCreate {
      self.memoryCache.countLimit = 60
      self.memoryCache.totalCostLimit = 150 * 1024 * 1024 // 150 MB ceiling
    }

    // Main transformation API: render(uri, preset, options)
    AsyncFunction("render") { (uri: String, preset: String, options: [String: Any]?, promise: Promise) in
      self.processingQueue.async {
        let startTime = CFAbsoluteTimeGetCurrent()
        do {
          let result = try self.processImage(uriString: uri, preset: preset, options: options, isThumbnail: false, maxDimension: 0)
          let duration = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0
          var response = result
          response["processingTimeMs"] = duration
          promise.resolve(response)
        } catch {
          promise.reject("E_PROCESS_FAILED", error.localizedDescription)
        }
      }
    }

    // Real-time preview thumbnail API: renderThumbnail(uri, preset, maxDimension)
    AsyncFunction("renderThumbnail") { (uri: String, preset: String, maxDimension: Double, promise: Promise) in
      self.processingQueue.async {
        let startTime = CFAbsoluteTimeGetCurrent()
        do {
          let targetDimension = maxDimension > 0 ? maxDimension : 320.0
          let result = try self.processImage(uriString: uri, preset: preset, options: nil, isThumbnail: true, maxDimension: targetDimension)
          let duration = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0
          var response = result
          response["processingTimeMs"] = duration
          promise.resolve(response)
        } catch {
          promise.reject("E_THUMBNAIL_FAILED", error.localizedDescription)
        }
      }
    }

    // Automatic document border detection via Vision framework
    AsyncFunction("detectBorders") { (uri: String, promise: Promise) in
      self.processingQueue.async {
        let startTime = CFAbsoluteTimeGetCurrent()
        do {
          guard let url = URL(string: uri) else {
            throw NSError(domain: "Dastavez", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid URI"])
          }

          let cgImage: CGImage
          if url.isFileURL {
            guard let imgSource = CGImageSourceCreateWithURL(url as CFURL, nil),
                  let loaded = CGImageSourceCreateImageAtIndex(imgSource, 0, nil) else {
              throw NSError(domain: "Dastavez", code: 404, userInfo: [NSLocalizedDescriptionKey: "Failed to load CGImage"])
            }
            cgImage = loaded
          } else {
            let data = try Data(contentsOf: url)
            guard let imgSource = CGImageSourceCreateWithData(data as CFData, nil),
                  let loaded = CGImageSourceCreateImageAtIndex(imgSource, 0, nil) else {
              throw NSError(domain: "Dastavez", code: 404, userInfo: [NSLocalizedDescriptionKey: "Failed to decode image data"])
            }
            cgImage = loaded
          }

          let width = cgImage.width
          let height = cgImage.height

          // Vision request for quadrilateral detection
          let request = VNDetectRectanglesRequest()
          request.minimumConfidence = 0.5
          request.maximumObservations = 1
          request.minimumAspectRatio = 0.2
          request.maximumAspectRatio = 1.0
          request.quadratureTolerance = 25.0

          let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
          try handler.perform([request])

          var detectedCorners: [String: Any]
          var confidence: Double = 0.95

          if let observation = request.results?.first {
            confidence = Double(observation.confidence)
            // Vision coordinates are normalized with origin (0,0) at bottom-left
            // Convert to top-left origin standard
            detectedCorners = [
              "topLeft": ["x": Double(observation.topLeft.x), "y": Double(1.0 - observation.topLeft.y)],
              "topRight": ["x": Double(observation.topRight.x), "y": Double(1.0 - observation.topRight.y)],
              "bottomRight": ["x": Double(observation.bottomRight.x), "y": Double(1.0 - observation.bottomRight.y)],
              "bottomLeft": ["x": Double(observation.bottomLeft.x), "y": Double(1.0 - observation.bottomLeft.y)]
            ]
          } else {
            // Sensible document margin fallback if no high-contrast quadrilateral is found
            detectedCorners = [
              "topLeft": ["x": 0.05, "y": 0.05],
              "topRight": ["x": 0.95, "y": 0.05],
              "bottomRight": ["x": 0.95, "y": 0.95],
              "bottomLeft": ["x": 0.05, "y": 0.95]
            ]
            confidence = 0.60
          }

          let elapsed = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0
          promise.resolve([
            "corners": detectedCorners,
            "confidence": confidence,
            "width": width,
            "height": height,
            "detectionTimeMs": elapsed
          ])
        } catch {
          promise.reject("E_BORDER_DETECTION_FAILED", error.localizedDescription)
        }
      }
    }

    // Perspective Correction (Deskewing) API
    AsyncFunction("cropAndDeskew") { (uri: String, corners: [String: Any], preset: String?, options: [String: Any]?, promise: Promise) in
      self.processingQueue.async {
        let startTime = CFAbsoluteTimeGetCurrent()
        do {
          let cleanPreset = (preset ?? "highContrast").lowercased()
          let result = try self.performPerspectiveDeskew(
            uriString: uri,
            corners: corners,
            preset: cleanPreset,
            options: options
          )
          var response = result
          response["processingTimeMs"] = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0
          promise.resolve(response)
        } catch {
          promise.reject("E_DESKEW_FAILED", error.localizedDescription)
        }
      }
    }

    // Cache management APIs
    AsyncFunction("clearCache") { (promise: Promise) in
      self.processingQueue.async {
        self.memoryCache.removeAllObjects()
        let fileManager = FileManager.default
        if let files = try? fileManager.contentsOfDirectory(at: self.diskCacheDirectory, includingPropertiesForKeys: nil) {
          for file in files {
            try? fileManager.removeItem(at: file)
          }
        }
        promise.resolve(["success": true])
      }
    }

    AsyncFunction("getCacheSize") { (promise: Promise) in
      self.processingQueue.async {
        let fileManager = FileManager.default
        var totalSize: UInt64 = 0
        if let files = try? fileManager.contentsOfDirectory(at: self.diskCacheDirectory, includingPropertiesForKeys: [.fileSizeKey]) {
          for file in files {
            if let resources = try? file.resourceValues(forKeys: [.fileSizeKey]), let size = resources.fileSize {
              totalSize += UInt64(size)
            }
          }
        }
        // NSCache has no public count, and nothing writes to the memory tier yet.
        promise.resolve(["sizeBytes": totalSize, "memoryItemsCount": 0])
      }
    }
  }

  // MARK: - Shared colour pipeline
  //
  // The Android and Skia (JS fallback) implementations run the identical math.
  // Do not tune these in isolation: a change here is a three-way divergence.

  /// Desaturates to Rec. 709 luminance, then scales about mid-grey plus an offset:
  ///
  ///     out = contrast * luma + (0.5 - 0.5 * contrast) + brightness
  ///
  /// `contrast` 1 and `brightness` 0 is a plain greyscale.
  private func applyLuminance(_ image: CIImage, contrast: Double, brightness: Double) -> CIImage {
    let offset = 0.5 - 0.5 * contrast + brightness
    let filter = CIFilter.colorMatrix()
    filter.inputImage = image
    let row = CIVector(
      x: CGFloat(0.2126 * contrast),
      y: CGFloat(0.7152 * contrast),
      z: CGFloat(0.0722 * contrast),
      w: 0
    )
    filter.rVector = row
    filter.gVector = row
    filter.bVector = row
    filter.aVector = CIVector(x: 0, y: 0, z: 0, w: 1)
    filter.biasVector = CIVector(x: CGFloat(offset), y: CGFloat(offset), z: CGFloat(offset), w: 0)
    return filter.outputImage ?? image
  }

  private func applyGrayscale(_ image: CIImage) -> CIImage {
    applyLuminance(image, contrast: 1.0, brightness: 0.0)
  }

  /// Document-style contrast. Binarizes **only** when the caller explicitly passes
  /// `threshold`; without it the result is a graded greyscale, not a 1-bit scan.
  private func applyHighContrast(_ image: CIImage, options: [String: Any]?) -> CIImage {
    let contrast = (options?["contrast"] as? Double) ?? 1.8
    let brightness = (options?["brightness"] as? Double) ?? 0.05
    let stage = applyLuminance(image, contrast: contrast, brightness: brightness)
    guard let threshold = options?["threshold"] as? Double else { return stage }

    let filter = CIFilter.colorThreshold()
    filter.inputImage = stage
    filter.threshold = Float(threshold)
    return filter.outputImage ?? stage
  }

  /// Keeps the disk cache under a hard ceiling so it cannot grow without bound.
  private func enforceDiskCacheLimit(maxBytes: Int64 = 100 * 1024 * 1024) {
    let fileManager = FileManager.default
    guard let files = try? fileManager.contentsOfDirectory(
      at: diskCacheDirectory,
      includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey]
    ) else { return }

    var entries: [(url: URL, size: Int64, date: Date)] = []
    var total: Int64 = 0
    for file in files {
      guard let values = try? file.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey]) else { continue }
      let size = Int64(values.fileSize ?? 0)
      total += size
      entries.append((file, size, values.contentModificationDate ?? .distantPast))
    }

    guard total > maxBytes else { return }
    for entry in entries.sorted(by: { $0.date < $1.date }) {
      if total <= maxBytes { break }
      try? fileManager.removeItem(at: entry.url)
      total -= entry.size
    }
  }

  // Perspective Deskew using Core Image CIPerspectiveCorrection
  private func performPerspectiveDeskew(
    uriString: String,
    corners: [String: Any],
    preset: String,
    options: [String: Any]?
  ) throws -> [String: Any] {
    let cacheKey = generateCacheKey(
      uri: uriString,
      preset: "deskew_\(preset)",
      options: options,
      isThumbnail: false,
      maxDim: 0,
      extra: cornerSignature(corners)
    )
    let cachedFileUrl = diskCacheDirectory.appendingPathComponent("\(cacheKey).jpg")

    // Automatic Cache Hit
    if FileManager.default.fileExists(atPath: cachedFileUrl.path) {
      if let attributes = try? FileManager.default.attributesOfItem(atPath: cachedFileUrl.path),
         let fileSize = attributes[.size] as? UInt64,
         let imageSource = CGImageSourceCreateWithURL(cachedFileUrl as CFURL, nil),
         let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [CFString: Any] {
        let width = properties[kCGImagePropertyPixelWidth] as? Int ?? 0
        let height = properties[kCGImagePropertyPixelHeight] as? Int ?? 0

        return [
          "uri": cachedFileUrl.absoluteString,
          "width": width,
          "height": height,
          "fileSize": fileSize,
          "mimeType": "image/jpeg",
          "preset": preset,
          "cached": true,
          "deskewed": true
        ]
      }
    }

    guard let sourceUrl = URL(string: uriString) else {
      throw NSError(domain: "Dastavez", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid URI"])
    }

    let sourceImage: CIImage = sourceUrl.isFileURL
      ? (CIImage(contentsOf: sourceUrl, options: [.applyOrientationProperty: true]) ?? CIImage())
      : (try! CIImage(data: Data(contentsOf: sourceUrl), options: [.applyOrientationProperty: true]) ?? CIImage())

    let extent = sourceImage.extent
    let imgW = extent.width
    let imgH = extent.height

    // Parse normalized corners
    guard let tl = corners["topLeft"] as? [String: Double],
          let tr = corners["topRight"] as? [String: Double],
          let br = corners["bottomRight"] as? [String: Double],
          let bl = corners["bottomLeft"] as? [String: Double] else {
      throw NSError(domain: "Dastavez", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid corner coordinates"])
    }

    // Core Image coordinate space: origin (0, 0) is at bottom-left
    let ciTL = CGPoint(x: (tl["x"] ?? 0.0) * imgW, y: (1.0 - (tl["y"] ?? 0.0)) * imgH)
    let ciTR = CGPoint(x: (tr["x"] ?? 1.0) * imgW, y: (1.0 - (tr["y"] ?? 0.0)) * imgH)
    let ciBR = CGPoint(x: (br["x"] ?? 1.0) * imgW, y: (1.0 - (br["y"] ?? 1.0)) * imgH)
    let ciBL = CGPoint(x: (bl["x"] ?? 0.0) * imgW, y: (1.0 - (bl["y"] ?? 1.0)) * imgH)

    // Hardware-accelerated perspective correction filter
    let deskewFilter = CIFilter.perspectiveCorrection()
    deskewFilter.inputImage = sourceImage
    deskewFilter.topLeft = ciTL
    deskewFilter.topRight = ciTR
    deskewFilter.bottomRight = ciBR
    deskewFilter.bottomLeft = ciBL

    guard var deskewedImage = deskewFilter.outputImage else {
      throw NSError(domain: "Dastavez", code: 500, userInfo: [NSLocalizedDescriptionKey: "Perspective correction failed"])
    }

    // Apply post-deskew preset
    if preset == "grayscale" {
      deskewedImage = applyGrayscale(deskewedImage)
    } else if preset == "highcontrast" {
      deskewedImage = applyHighContrast(deskewedImage, options: options)
    }

    let finalExtent = deskewedImage.extent
    guard let cgImage = ciContext.createCGImage(deskewedImage, from: finalExtent) else {
      throw NSError(domain: "Dastavez", code: 500, userInfo: [NSLocalizedDescriptionKey: "Failed to render CGImage from Metal context"])
    }

    let uiImage = UIImage(cgImage: cgImage)
    let quality = CGFloat((options?["quality"] as? Double) ?? 0.90)
    guard let data = uiImage.jpegData(compressionQuality: quality) else {
      throw NSError(domain: "Dastavez", code: 500, userInfo: [NSLocalizedDescriptionKey: "Failed to compress deskewed JPEG"])
    }

    try data.write(to: cachedFileUrl, options: .atomic)
    enforceDiskCacheLimit()

    return [
      "uri": cachedFileUrl.absoluteString,
      "width": Int(finalExtent.width),
      "height": Int(finalExtent.height),
      "fileSize": UInt64(data.count),
      "mimeType": "image/jpeg",
      "preset": preset,
      "cached": false,
      "deskewed": true
    ]
  }

  // Core processing pipeline with Core Image & Accelerate
  private func processImage(
    uriString: String,
    preset: String,
    options: [String: Any]?,
    isThumbnail: Bool,
    maxDimension: Double
  ) throws -> [String: Any] {
    let cleanPreset = preset.lowercased()
    let cacheKey = generateCacheKey(uri: uriString, preset: cleanPreset, options: options, isThumbnail: isThumbnail, maxDim: maxDimension)
    let cachedFileUrl = diskCacheDirectory.appendingPathComponent("\(cacheKey).jpg")

    // Automatic Caching Check (Disk hit)
    if FileManager.default.fileExists(atPath: cachedFileUrl.path) {
      if let attributes = try? FileManager.default.attributesOfItem(atPath: cachedFileUrl.path),
         let fileSize = attributes[.size] as? UInt64,
         let imageSource = CGImageSourceCreateWithURL(cachedFileUrl as CFURL, nil),
         let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [CFString: Any] {
        let width = properties[kCGImagePropertyPixelWidth] as? Int ?? 0
        let height = properties[kCGImagePropertyPixelHeight] as? Int ?? 0

        return [
          "uri": cachedFileUrl.absoluteString,
          "width": width,
          "height": height,
          "fileSize": fileSize,
          "mimeType": "image/jpeg",
          "preset": cleanPreset,
          "cached": true
        ]
      }
    }

    // Load Source Image from file URI or remote URL
    guard let sourceUrl = URL(string: uriString) else {
      throw NSError(domain: "DastavezImageProcessing", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid URI format: \(uriString)"])
    }

    let sourceImage: CIImage
    if isThumbnail && maxDimension > 0 {
      // Memory optimization: downsample at decode time using CGImageSource
      guard let downsampled = createThumbnailImage(from: sourceUrl, maxDimension: maxDimension) else {
        throw NSError(domain: "DastavezImageProcessing", code: 404, userInfo: [NSLocalizedDescriptionKey: "Failed to downsample thumbnail for \(uriString)"])
      }
      sourceImage = CIImage(cgImage: downsampled)
    } else {
      if sourceUrl.isFileURL {
        guard let ciImg = CIImage(contentsOf: sourceUrl, options: [.applyOrientationProperty: true]) else {
          throw NSError(domain: "DastavezImageProcessing", code: 404, userInfo: [NSLocalizedDescriptionKey: "Could not read image at \(uriString)"])
        }
        sourceImage = ciImg
      } else {
        let data = try Data(contentsOf: sourceUrl)
        guard let ciImg = CIImage(data: data, options: [.applyOrientationProperty: true]) else {
          throw NSError(domain: "DastavezImageProcessing", code: 404, userInfo: [NSLocalizedDescriptionKey: "Could not decode image data"])
        }
        sourceImage = ciImg
      }
    }

    // Apply Presets via GPU-accelerated Core Image & Accelerate
    var outputImage: CIImage

    switch cleanPreset {
    case "grayscale":
      outputImage = applyGrayscale(sourceImage)

    case "highcontrast":
      outputImage = applyHighContrast(sourceImage, options: options)

    default:
      outputImage = sourceImage
    }

    let extent = outputImage.extent
    guard let cgImage = ciContext.createCGImage(outputImage, from: extent) else {
      throw NSError(domain: "DastavezImageProcessing", code: 500, userInfo: [NSLocalizedDescriptionKey: "Metal CIContext failed to render CGImage"])
    }

    let outputWidth = Int(extent.width)
    let outputHeight = Int(extent.height)
    let compressionQuality: CGFloat = CGFloat((options?["quality"] as? Double) ?? 0.88)
    let uiImage = UIImage(cgImage: cgImage)

    guard let jpegData = uiImage.jpegData(compressionQuality: compressionQuality) else {
      throw NSError(domain: "DastavezImageProcessing", code: 500, userInfo: [NSLocalizedDescriptionKey: "Failed to compress JPEG data"])
    }

    try jpegData.write(to: cachedFileUrl, options: .atomic)
    enforceDiskCacheLimit()

    return [
      "uri": cachedFileUrl.absoluteString,
      "width": outputWidth,
      "height": outputHeight,
      "fileSize": UInt64(jpegData.count),
      "mimeType": "image/jpeg",
      "preset": cleanPreset,
      "cached": false
    ]
  }

  private func createThumbnailImage(from url: URL, maxDimension: Double) -> CGImage? {
    let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
    guard let source = CGImageSourceCreateWithURL(url as CFURL, sourceOptions) else { return nil }

    let downsampleOptions = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceShouldCacheImmediately: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: Int(maxDimension)
    ] as [CFString: Any] as CFDictionary

    return CGImageSourceCreateThumbnailAtIndex(source, 0, downsampleOptions)
  }

  /// Ordered, deterministic corners so two different crops of one image hash
  /// to different cache keys. Swift dictionary descriptions are not ordered.
  private func cornerSignature(_ corners: [String: Any]) -> String {
    ["topLeft", "topRight", "bottomRight", "bottomLeft"].map { name in
      let point = corners[name] as? [String: Double] ?? [:]
      return "\(name):\(point["x"] ?? 0),\(point["y"] ?? 0)"
    }.joined(separator: "_")
  }

  private func generateCacheKey(uri: String, preset: String, options: [String: Any]?, isThumbnail: Bool, maxDim: Double, extra: String = "") -> String {
    var raw = "\(uri)_\(preset)_\(isThumbnail)_\(maxDim)_\(extra)"
    if let opts = options {
      let sortedKeys = opts.keys.sorted()
      for key in sortedKeys {
        raw += "_\(key):\(opts[key] ?? "")"
      }
    }

    let inputData = Data(raw.utf8)
    var digest = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
    inputData.withUnsafeBytes {
      _ = CC_SHA256($0.baseAddress, CC_LONG(inputData.count), &digest)
    }

    return digest.map { String(format: "%02x", $0) }.joined()
  }
}
