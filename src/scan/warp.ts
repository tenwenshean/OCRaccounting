/**
 * Turn a photographed receipt into a flat, clean "scanned" picture:
 *  - perspective-correct the 4 detected corners into a straight rectangle
 *  - remove shadows / uneven light (divide by local background)
 *  - stretch contrast so ink is dark and paper is white
 */
import type { Point, Quad } from './detect'
import { toGray } from './detect'

/** Solve A x = b (n x n) with Gaussian elimination. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    ;[M[c], M[piv]] = [M[piv], M[c]]
    const d = M[c][c] || 1e-12
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / d
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12))
}

/** Homography mapping each `from` point to the matching `to` point. Returns 3x3 row-major. */
export function homography(from: Point[], to: Point[]): number[] {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]
    const { x: u, y: v } = to[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v)
  }
  return [...solve(A, b), 1]
}

/** Push the corners slightly outwards so no text at the edges gets cut. */
export function expandQuad(q: Quad, amount = 0.015): Quad {
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4
  const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4
  return q.map((p) => ({
    x: Math.min(1, Math.max(0, p.x + (p.x - cx) * amount * 2)),
    y: Math.min(1, Math.max(0, p.y + (p.y - cy) * amount * 2)),
  })) as Quad
}

/** Size of the flattened receipt in pixels, capped so the longest side is <= maxSide. */
export function outputSize(qPx: Quad, maxSide: number): { w: number; h: number } {
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  let w = (d(qPx[0], qPx[1]) + d(qPx[3], qPx[2])) / 2
  let h = (d(qPx[0], qPx[3]) + d(qPx[1], qPx[2])) / 2
  const s = Math.min(1, maxSide / Math.max(w, h))
  w = Math.max(32, Math.round(w * s))
  h = Math.max(32, Math.round(h * s))
  return { w, h }
}

/** Perspective-warp a gray image (sw x sh) so quad (in px) fills an outW x outH image. Bilinear. */
export function warpGray(src: Uint8Array, sw: number, sh: number, qPx: Quad, outW: number, outH: number): Uint8Array {
  const dst = [{ x: 0, y: 0 }, { x: outW - 1, y: 0 }, { x: outW - 1, y: outH - 1 }, { x: 0, y: outH - 1 }]
  const H = homography(dst, qPx) // output pixel -> source pixel
  const out = new Uint8Array(outW * outH)
  for (let v = 0; v < outH; v++) {
    for (let u = 0; u < outW; u++) {
      const z = H[6] * u + H[7] * v + H[8]
      const x = (H[0] * u + H[1] * v + H[2]) / z
      const y = (H[3] * u + H[4] * v + H[5]) / z
      const x0 = Math.floor(x), y0 = Math.floor(y)
      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) { out[v * outW + u] = 255; continue }
      const fx = x - x0, fy = y - y0
      const i = y0 * sw + x0
      const top = src[i] + (src[i + 1] - src[i]) * fx
      const bot = src[i + sw] + (src[i + sw + 1] - src[i + sw]) * fx
      out[v * outW + u] = top + (bot - top) * fy
    }
  }
  return out
}

/** Shadow removal: divide each pixel by the local average brightness, then stretch contrast. */
export function cleanUp(gray: Uint8Array, w: number, h: number): Uint8Array {
  const r = Math.max(8, Math.round(Math.min(w, h) / 24))
  // integral image
  const W = w + 1
  const integral = new Float64Array(W * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x]
      integral[(y + 1) * W + x + 1] = integral[y * W + x + 1] + row
    }
  }
  const flat = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1)
      const sum = integral[y1 * W + x1] - integral[y0 * W + x1] - integral[y1 * W + x0] + integral[y0 * W + x0]
      const mean = sum / ((x1 - x0) * (y1 - y0))
      flat[y * w + x] = gray[y * w + x] / Math.max(mean, 1)
    }
  }
  // contrast stretch between 2nd and 98th percentile
  const sorted = Float32Array.from(flat).sort()
  const lo = sorted[Math.floor(sorted.length * 0.02)]
  const hi = Math.min(1, sorted[Math.floor(sorted.length * 0.98)])
  const range = Math.max(hi - lo, 0.05)
  const out = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) {
    const v = (flat[i] - lo) / range
    // slight gamma to darken faint thermal print
    out[i] = Math.max(0, Math.min(255, Math.round(255 * Math.pow(Math.max(0, Math.min(1, v)), 1.4))))
  }
  return out
}

export function grayToCanvas(gray: Uint8Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
    img.data[j] = img.data[j + 1] = img.data[j + 2] = gray[i]
    img.data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality),
  )
}

/**
 * Full pipeline on one captured frame.
 * @param frame RGBA pixels of the full-resolution camera frame / photo
 * @param quad receipt corners in 0..1 coordinates (or null = use whole image)
 */
export function makeCleanScan(frame: ImageData, quad: Quad | null, maxSide = 2000): HTMLCanvasElement {
  const { width: fw, height: fh } = frame
  const gray = toGray(frame.data, fw * fh)
  const q = expandQuad(quad ?? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], quad ? 0.015 : 0)
  const qPx = q.map((p) => ({ x: p.x * (fw - 1), y: p.y * (fh - 1) })) as Quad
  const { w, h } = outputSize(qPx, maxSide)
  const flat = warpGray(gray, fw, fh, qPx, w, h)
  return grayToCanvas(cleanUp(flat, w, h), w, h)
}
