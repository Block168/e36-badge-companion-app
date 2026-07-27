import UIKit
import ImageIO
import UniformTypeIdentifiers

/// Named constant so the frame budget is easy to tune against the ESP32's
/// flash storage allotment for the boot animation.
let maxBootAnimationFrames = 20

enum GIFDecoder {
    struct Frame {
        let image: UIImage
        let delaySeconds: Double
    }

    /// Decodes up to `maxBootAnimationFrames` frames from GIF data using
    /// ImageIO's `CGImageSource`, honoring each frame's own delay time.
    static func decode(data: Data) -> [Frame] {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return [] }
        let count = min(CGImageSourceGetCount(source), maxBootAnimationFrames)
        var frames: [Frame] = []
        frames.reserveCapacity(count)

        for index in 0..<count {
            guard let cgImage = CGImageSourceCreateImageAtIndex(source, index, nil) else { continue }
            let delay = frameDelay(source: source, index: index)
            frames.append(Frame(image: UIImage(cgImage: cgImage), delaySeconds: delay))
        }
        return frames
    }

    /// Accepts an ordered array of still photos as an alternative to a GIF —
    /// same frame cap applies.
    static func framesFromPhotos(_ images: [UIImage], frameDelay: Double = 0.1) -> [Frame] {
        images.prefix(maxBootAnimationFrames).map { Frame(image: $0, delaySeconds: frameDelay) }
    }

    private static func frameDelay(source: CGImageSource, index: Int) -> Double {
        guard
            let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any],
            let gifProperties = properties[kCGImagePropertyGIFDictionary] as? [CFString: Any]
        else { return 0.1 }

        let unclamped = gifProperties[kCGImagePropertyGIFUnclampedDelayTime] as? Double
        let clamped = gifProperties[kCGImagePropertyGIFDelayTime] as? Double
        return (unclamped ?? clamped ?? 0.1).clamped(to: 0.02...1.0)
    }
}

private extension Double {
    func clamped(to range: ClosedRange<Double>) -> Double {
        min(max(self, range.lowerBound), range.upperBound)
    }
}
