// odam_maska — videodan odam maskasi (Apple Vision, offline) + yuz o'rni.
// Ishlatish: odam_maska <kirish.mp4> <maska.mp4> <yuz.json>
//   maska.mp4 — oq = odam, qora = fon (kirish bilan bir xil o'lcham/fps), keyin ffmpeg alphamerge qilinadi
//   yuz.json  — [{"t": soniya, "x","y","w","h" (0..1, chap-yuqori), "tepa": odamning eng yuqori nuqtasi (0..1)}]
import AVFoundation
import CoreImage
import Foundation
import Vision

let args = CommandLine.arguments
guard args.count == 4 else {
    FileHandle.standardError.write("Ishlatish: odam_maska <kirish.mp4> <maska.mp4> <yuz.json>\n".data(using: .utf8)!)
    exit(1)
}
let kirish = URL(fileURLWithPath: args[1])
let chiqish = URL(fileURLWithPath: args[2])
let yuzFayl = URL(fileURLWithPath: args[3])
try? FileManager.default.removeItem(at: chiqish)

let asset = AVURLAsset(url: kirish)
let sem = DispatchSemaphore(value: 0)
var trackOpt: AVAssetTrack?
Task {
    trackOpt = try? await asset.loadTracks(withMediaType: .video).first
    sem.signal()
}
sem.wait()
guard let track = trackOpt else { print("XATO: video oqimi yo'q"); exit(1) }
var natSize = CGSize.zero
var fps: Float = 30
var transform = CGAffineTransform.identity
Task {
    natSize = (try? await track.load(.naturalSize)) ?? .zero
    fps = (try? await track.load(.nominalFrameRate)) ?? 30
    transform = (try? await track.load(.preferredTransform)) ?? .identity
    sem.signal()
}
sem.wait()
let r = CGRect(origin: .zero, size: natSize).applying(transform)
let W = Int(abs(r.width)), H = Int(abs(r.height))

let reader = try AVAssetReader(asset: asset)
let out = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
out.alwaysCopiesSampleData = false
reader.add(out)

let writer = try AVAssetWriter(outputURL: chiqish, fileType: .mp4)
let winput = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 6_000_000],
])
winput.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: winput, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H,
])
writer.add(winput)
reader.startReading()
writer.startWriting()
writer.startSession(atSourceTime: .zero)

let ctx = CIContext(options: [.cacheIntermediates: false])
let segReq = VNGeneratePersonSegmentationRequest()
segReq.qualityLevel = .balanced
segReq.outputPixelFormat = kCVPixelFormatType_OneComponent8
let yuzReq = VNDetectFaceRectanglesRequest()
var yuzlar: [[String: Double]] = []
var n = 0

while let sb = out.copyNextSampleBuffer() {
    guard let pb = CMSampleBufferGetImageBuffer(sb) else { continue }
    let pts = CMSampleBufferGetPresentationTimeStamp(sb)
    let orient: CGImagePropertyOrientation = transform.b == 1 ? .right : transform.b == -1 ? .left : .up
    let h = VNImageRequestHandler(cvPixelBuffer: pb, orientation: orient, options: [:])
    var reqs: [VNRequest] = [segReq]
    if n % 3 == 0 { reqs.append(yuzReq) }
    try? h.perform(reqs)

    var tepa = 1.0
    if let mask = segReq.results?.first?.pixelBuffer {
        var img = CIImage(cvPixelBuffer: mask)
        let sx = CGFloat(W) / img.extent.width, sy = CGFloat(H) / img.extent.height
        img = img.transformed(by: CGAffineTransform(scaleX: sx, y: sy))
        // oq-qora (r=g=b=maska)
        let gray = img.applyingFilter("CIColorMatrix", parameters: [
            "inputRVector": CIVector(x: 1, y: 0, z: 0, w: 0), "inputGVector": CIVector(x: 1, y: 0, z: 0, w: 0),
            "inputBVector": CIVector(x: 1, y: 0, z: 0, w: 0), "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
        ])
        if n % 3 == 0 {
            // odamning eng yuqori nuqtasi (bosh tepasi) — maska satrlarini tekshiramiz
            CVPixelBufferLockBaseAddress(mask, .readOnly)
            let mw = CVPixelBufferGetWidth(mask), mh = CVPixelBufferGetHeight(mask)
            let bpr = CVPixelBufferGetBytesPerRow(mask)
            if let base = CVPixelBufferGetBaseAddress(mask)?.assumingMemoryBound(to: UInt8.self) {
                outer: for y in stride(from: 0, to: mh, by: 2) {
                    var c = 0
                    for x in stride(from: 0, to: mw, by: 4) where base[y * bpr + x] > 128 { c += 1 }
                    if c > mw / 60 { tepa = Double(y) / Double(mh); break outer }
                }
            }
            CVPixelBufferUnlockBaseAddress(mask, .readOnly)
        }
        while !winput.isReadyForMoreMediaData { usleep(2000) }
        if let pool = adaptor.pixelBufferPool {
            var outPB: CVPixelBuffer?
            CVPixelBufferPoolCreatePixelBuffer(nil, pool, &outPB)
            if let o = outPB {
                ctx.render(gray, to: o, bounds: CGRect(x: 0, y: 0, width: W, height: H), colorSpace: nil)
                adaptor.append(o, withPresentationTime: pts)
            }
        }
    }
    if n % 3 == 0 {
        var yz: [String: Double] = ["t": CMTimeGetSeconds(pts), "tepa": tepa]
        if let f = (yuzReq.results ?? []).max(by: { $0.boundingBox.width < $1.boundingBox.width }) {
            let b = f.boundingBox  // chap-past koordinata → chap-yuqori
            yz["x"] = b.minX; yz["y"] = 1 - b.maxY; yz["w"] = b.width; yz["h"] = b.height
        }
        yuzlar.append(yz)
    }
    n += 1
    if n % 150 == 0 { print("   maska: \(n) kadr"); fflush(stdout) }
}
winput.markAsFinished()
writer.finishWriting { sem.signal() }
sem.wait()
let json = try JSONSerialization.data(withJSONObject: yuzlar, options: [])
try json.write(to: yuzFayl)
print("ok \(n) kadr, \(W)x\(H), yuz: \(yuzlar.filter { $0["w"] != nil }.count)/\(yuzlar.count)")
