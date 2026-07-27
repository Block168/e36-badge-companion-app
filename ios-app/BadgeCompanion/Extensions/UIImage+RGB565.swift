import UIKit
import CoreGraphics

extension UIImage {
    /// Renders this image into a fixed `size`x`size` RGB565 (little-endian,
    /// 5-6-5 bit packing) buffer matching the ESP32's framebuffer format.
    /// Callers are expected to have already cropped/scaled to a square via
    /// the circular crop editor before calling this.
    func rgb565Bytes(size: Int = 480) -> [UInt8]? {
        guard let cgImage else { return nil }

        var pixels = [UInt8](repeating: 0, count: size * size * 4)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(
            data: &pixels,
            width: size,
            height: size,
            bitsPerComponent: 8,
            bytesPerRow: size * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }

        ctx.interpolationQuality = .high
        ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: size, height: size))

        var out = [UInt8]()
        out.reserveCapacity(size * size * 2)

        var i = 0
        while i < pixels.count {
            let r = pixels[i] >> 3        // 5 bits
            let g = pixels[i + 1] >> 2    // 6 bits
            let b = pixels[i + 2] >> 3    // 5 bits
            let value: UInt16 = (UInt16(r) << 11) | (UInt16(g) << 5) | UInt16(b)
            // Little-endian byte order expected by the ESP32 display driver.
            out.append(UInt8(value & 0xFF))
            out.append(UInt8(value >> 8))
            i += 4
        }
        return out
    }

    /// Convenience: crop to a centered circle of `diameter`, filling
    /// transparent corners with black (badge display has no alpha channel).
    func maskedToCircle(diameter: CGFloat) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: diameter, height: diameter))
        return renderer.image { ctx in
            UIColor.black.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: diameter, height: diameter))
            let path = UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: diameter, height: diameter))
            path.addClip()
            draw(in: CGRect(x: 0, y: 0, width: diameter, height: diameter))
        }
    }
}
