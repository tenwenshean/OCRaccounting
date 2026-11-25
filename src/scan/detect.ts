/**
 * Lightweight live receipt detector (no OpenCV needed).
 * Works on a small copy of the camera frame (~240 px wide):
 *  1. grayscale + Otsu threshold -> bright "paper" pixels
 *  2. largest bright connected region = receipt candidate
 *  3. its 4 extreme corners = receipt outline
 *  4. accept if it is big enough and rectangle-shaped
 */

export interface Point { x: number; y: number }
/** Corners in order: top-left, top-right, bottom-right, bottom-left (0..1 of frame size) */
export type Quad = [Point, Point, Point, Point]

export interface Detection {
  quad: Quad
  /** receipt area / frame area */
  areaRatio: number
  /** region pixels / quad area (1 = perfect rectangle) */
  fill: number
  /** average brightness 0..255 of the paper */
  brightness: number
}

export function toGray(data: Uint8ClampedArray, n: number): Uint8Array {
  const g = new Uint8Array(n)
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    g[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8
  }
  return g
}

export function otsu(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++
  const total = gray.length
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * hist[t]
  let sumB = 0, wB = 0, best = 0, threshold = 127
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) { best = between; threshold = t }
  }
  return threshold
}

function quadArea(q: Quad): number {
  let a = 0
  for (let i = 0; i < 4; i++) {
    const p = q[i], r = q[(i + 1) % 4]
    a += p.x * r.y - r.x * p.y
  }
  return Math.abs(a) / 2
}

/** Detect the receipt in an RGBA image of size w x h. Returns null if none found. */
export function detectReceipt(data: Uint8ClampedArray, w: number, h: number): Detection | null {
  const n = w * h
  const gray = toGray(data, n)
  const t = otsu(gray)
  // Paper must be clearly bright; ignore very dark scenes
  const thr = Math.max(t, 90)

  const label = new Int32Array(n).fill(-1)
  const stack = new Int32Array(n)
  let bestCount = 0, bestId = -1, id = 0

  for (let start = 0; start < n; start++) {
    if (gray[start] <= thr || label[start] !== -1) continue
    let sp = 0, count = 0
    stack[sp++] = start
    label[start] = id
    while (sp > 0) {
      const p = stack[--sp]
      count++
      const x = p % w
      if (x > 0 && label[p - 1] === -1 && gray[p - 1] > thr) { label[p - 1] = id; stack[sp++] = p - 1 }
      if (x < w - 1 && label[p + 1] === -1 && gray[p + 1] > thr) { label[p + 1] = id; stack[sp++] = p + 1 }
      if (p >= w && label[p - w] === -1 && gray[p - w] > thr) { label[p - w] = id; stack[sp++] = p - w }
      if (p < n - w && label[p + w] === -1 && gray[p + w] > thr) { label[p + w] = id; stack[sp++] = p + w }
    }
    if (count > bestCount) { bestCount = count; bestId = id }
    id++
  }

  const areaRatio = bestCount / n
  if (bestId < 0 || areaRatio < 0.06 || areaRatio > 0.93) return null

  // Extreme points: TL = min(x+y), BR = max(x+y), TR = max(x-y), BL = min(x-y)
  let tl = { x: 0, y: 0, s: Infinity }, br = { x: 0, y: 0, s: -Infinity }
  let tr = { x: 0, y: 0, s: -Infinity }, bl = { x: 0, y: 0, s: Infinity }
  let bright = 0
  for (let p = 0; p < n; p++) {
    if (label[p] !== bestId) continue
    const x = p % w, y = (p - x) / w
    bright += gray[p]
    const s = x + y, d = x - y
    if (s < tl.s) tl = { x, y, s }
    if (s > br.s) br = { x, y, s }
    if (d > tr.s) tr = { x, y, s: d }
    if (d < bl.s) bl = { x, y, s: d }
  }

  const quad: Quad = [
    { x: tl.x / w, y: tl.y / h },
    { x: (tr.x + 1) / w, y: tr.y / h },
    { x: (br.x + 1) / w, y: (br.y + 1) / h },
    { x: bl.x / w, y: (bl.y + 1) / h },
  ]
  const fill = bestCount / Math.max(1, quadArea(quad) * n)
  if (fill < 0.75) return null

  // Receipt edges must have some length (reject thin strips / blobs)
  const width = Math.hypot(quad[1].x - quad[0].x, (quad[1].y - quad[0].y) * (h / w))
  const height = Math.hypot(quad[3].x - quad[0].x, (quad[3].y - quad[0].y) * (h / w))
  if (width < 0.15 || height < 0.15) return null

  return { quad, areaRatio, fill: Math.min(1, fill), brightness: bright / bestCount }
}

/** Largest corner movement between two quads (0..1 of frame). */
export function quadDistance(a: Quad, b: Quad): number {
  let m = 0
  for (let i = 0; i < 4; i++) m = Math.max(m, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y))
  return m
}

/** Sharpness = variance of the Laplacian over a gray image (higher = sharper). */
export function sharpness(gray: Uint8Array, w: number, h: number): number {
  let sum = 0, sumSq = 0, count = 0
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w]
      sum += lap
      sumSq += lap * lap
      count++
    }
  }
  if (count === 0) return 0
  const mean = sum / count
  return sumSq / count - mean * mean
}
