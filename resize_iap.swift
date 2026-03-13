import Foundation
import AppKit

// 元画像を読み込む
let srcPath = "/private/tmp/iap_tmp.png"
let dstPath = "/Users/taka/Downloads/iap_screenshot_1284x2778.png"
let targetW: CGFloat = 1284
let targetH: CGFloat = 2778

guard let srcImage = NSImage(contentsOfFile: srcPath) else {
    print("ERROR: 元画像の読み込みに失敗しました: \(srcPath)")
    exit(1)
}

// 新しい1284x2778キャンバスを作成（ダークブルー背景）
let newBitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: Int(targetW),
    pixelsHigh: Int(targetH),
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
)!

NSGraphicsContext.saveGraphicsState()
let ctx = NSGraphicsContext(bitmapImageRep: newBitmap)!
NSGraphicsContext.current = ctx

// 背景色（濃紺）
NSColor(red: 0.06, green: 0.08, blue: 0.16, alpha: 1.0).setFill()
NSRect(x: 0, y: 0, width: targetW, height: targetH).fill()

// 元画像を中央に配置（1284x1284）
let srcSize = CGSize(width: targetW, height: targetW)
let yOffset = (targetH - targetW) / 2
let dstRect = NSRect(x: 0, y: yOffset, width: targetW, height: targetW)
srcImage.draw(in: dstRect, from: NSRect(origin: .zero, size: srcImage.size), operation: .copy, fraction: 1.0)

NSGraphicsContext.restoreGraphicsState()

// PNG保存
let pngData = newBitmap.representation(using: .png, properties: [:])!
try! pngData.write(to: URL(fileURLWithPath: dstPath))
print("SUCCESS: \(dstPath) (1284x2778)")
