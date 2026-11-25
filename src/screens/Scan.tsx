import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Category } from '../db/types'
import { useCategories, useObjectUrl } from '../hooks/useData'
import { CategoryChips } from '../components/CategoryChips'
import { ReceiptSheet } from '../components/ReceiptSheet'
import { formatRM } from '../lib/money'
import { monthKey } from '../lib/folders'
import { grabPixels, openRearCamera, setTorch, stopStream, torchSupported } from '../scan/camera'
import { detectReceipt, quadDistance, sharpness, toGray, type Detection, type Quad } from '../scan/detect'
import { makeCleanScan } from '../scan/warp'
import { ocrBusy, recognize, warmUpOcr } from '../scan/ocr'
import { parseReceipt } from '../scan/parse'
import { categorise } from '../scan/categorise'
import { confirmCategory, processScan, type ScanResult } from '../scan/pipeline'

type Phase = 'starting' | 'searching' | 'tracking' | 'capturing' | 'reading' | 'result' | 'error'

const ANALYSIS_WIDTH = 240
const FRAME_INTERVAL_MS = 90
/** Consecutive steady frames before auto-capture (~0.7 s) */
const STEADY_FRAMES = 7
const STEADY_MOVE = 0.03
const MIN_SHARPNESS = 25
const AUTO_RESUME_MS = 4000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Sharpness of the middle of the receipt at full resolution. */
function regionSharpness(frame: ImageData, quad: Quad | null): number {
  const { width: W, height: H } = frame
  const xs = quad ? quad.map((p) => p.x * W) : [0, W]
  const ys = quad ? quad.map((p) => p.y * H) : [0, H]
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const size = Math.min(400, W, H)
  const x0 = Math.max(0, Math.round(cx - size / 2)), y0 = Math.max(0, Math.round(cy - size / 2))
  const w = Math.min(size, W - x0), h = Math.min(size, H - y0)
  const crop = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const from = ((y0 + y) * W + x0) * 4
    crop.set(frame.data.subarray(from, from + w * 4), y * w * 4)
  }
  return sharpness(toGray(crop, w * h), w, h)
}

export function Scan() {
  const categories = useCategories()
  const categoriesRef = useRef<Category[]>([])
  categoriesRef.current = categories

  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvases = useRef({ analysis: document.createElement('canvas'), frame: document.createElement('canvas'), peek: document.createElement('canvas') })

  const [phase, setPhaseState] = useState<Phase>('starting')
  const phaseRef = useRef<Phase>('starting')
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p) }

  const [error, setError] = useState('')
  const [hint, setHint] = useState('Starting camera…')
  const [progress, setProgress] = useState(0)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [peekWords, setPeekWords] = useState<string[]>([])
  const [result, setResult] = useState<ScanResult | null>(null)
  const [editing, setEditing] = useState(false)
  const [autoMode, setAutoMode] = useState(true)
  const autoRef = useRef(true)
  autoRef.current = autoMode
  const [torchOn, setTorchOn] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)
  const [flash, setFlash] = useState(false)

  // tracking state (refs: updated every frame without re-rendering)
  const history = useRef<Quad[]>([])
  const missCount = useRef(0)
  const armed = useRef(true)
  const lastCaptured = useRef<Quad | null>(null)
  const lastDet = useRef<Detection | null>(null)
  const lastPeek = useRef(0)
  const resumeTimer = useRef<number | undefined>(undefined)

  // live copy of the saved receipt (so category changes show immediately)
  const saved = useLiveQuery(() => (result && !result.duplicateOf ? db.receipts.get(result.receipt.id) : undefined), [result])
  const thumbUrl = useObjectUrl(result?.receipt.image)

  // ---------- camera ----------
  useEffect(() => {
    let cancelled = false
    warmUpOcr()

    async function start() {
      try {
        const stream = await openRearCamera()
        if (cancelled) return stopStream(stream)
        streamRef.current = stream
        const v = videoRef.current!
        v.srcObject = stream
        await v.play().catch(() => undefined)
        setHasTorch(torchSupported(stream))
        if (phaseRef.current === 'starting' || phaseRef.current === 'error') setPhase('searching')
      } catch (e) {
        const err = e as DOMException
        setError(
          err.name === 'NotAllowedError'
            ? 'Camera permission was blocked. Allow camera access for this site in your browser settings, then reload.'
            : err.message || 'Could not open the camera.',
        )
        setPhase('error')
      }
    }

    function onVisibility() {
      if (document.hidden) {
        stopStream(streamRef.current)
        streamRef.current = null
      } else if (!streamRef.current) {
        void start()
      }
    }

    void start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      stopStream(streamRef.current)
      streamRef.current = null
      clearTimeout(resumeTimer.current)
    }
  }, [])

  // ---------- overlay ----------
  function drawOverlay(quad: Quad | null, p = 0, isArmed = true) {
    const c = overlayRef.current, box = containerRef.current, v = videoRef.current
    if (!c || !box || !v) return
    const dpr = window.devicePixelRatio || 1
    const cw = box.clientWidth, ch = box.clientHeight
    if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) {
      c.width = Math.round(cw * dpr)
      c.height = Math.round(ch * dpr)
    }
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cw, ch)
    if (!quad || !v.videoWidth) return
    const vw = v.videoWidth, vh = v.videoHeight
    const s = Math.max(cw / vw, ch / vh)
    const dx = (cw - vw * s) / 2, dy = (ch - vh * s) / 2
    const pts = quad.map((q) => [q.x * vw * s + dx, q.y * vh * s + dy])
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.fillStyle = isArmed ? `rgba(20,184,166,${0.12 + p * 0.18})` : 'rgba(148,163,184,0.18)'
    ctx.fill()
    ctx.lineWidth = 4
    ctx.lineJoin = 'round'
    ctx.strokeStyle = !isArmed ? '#94a3b8' : p >= 1 ? '#22c55e' : '#14b8a6'
    ctx.stroke()
    ctx.fillStyle = ctx.strokeStyle
    for (const [x, y] of pts) {
      ctx.beginPath()
      ctx.arc(x, y, 7, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ---------- live keyword peek ----------
  function maybePeek() {
    const v = videoRef.current, det = lastDet.current
    if (!v || !det || ocrBusy() || Date.now() - lastPeek.current < 1800) return
    lastPeek.current = Date.now()
    const scale = Math.min(1, 1280 / v.videoWidth)
    const fr = grabPixels(v, canvases.current.peek, Math.round(v.videoWidth * scale), Math.round(v.videoHeight * scale))
    const clean = makeCleanScan(fr, det.quad, 1000)
    recognize(clean)
      .then(({ text }) => {
        if (phaseRef.current !== 'tracking' && phaseRef.current !== 'searching') return
        const p = parseReceipt(text)
        const g = categorise({ merchant: p.merchant, text: p.lines.join('\n') }, categoriesRef.current, [])
        const words = g.keywords.slice(0, 4)
        if (p.totalSen) words.push(`TOTAL ${formatRM(p.totalSen)}`)
        setPeekWords(words)
      })
      .catch(() => undefined)
  }

  // ---------- capture + process ----------
  async function finish(clean: HTMLCanvasElement) {
    setPhase('reading')
    setOcrProgress(0)
    setHint('Reading receipt…')
    try {
      const res = await processScan(clean, (status, p) => {
        if (status.startsWith('recogniz')) setOcrProgress(p)
      })
      setResult(res)
      setHint(res.duplicateOf ? 'Already saved' : res.receipt.status === 'needs_review' ? 'Needs your check' : 'Saved')
      setPhase('result')
      navigator.vibrate?.(res.receipt.status === 'needs_review' ? [40, 60, 40] : 60)
      if (res.receipt.status === 'auto' || res.duplicateOf) {
        resumeTimer.current = window.setTimeout(resume, AUTO_RESUME_MS)
      }
    } catch (e) {
      setHint(`Could not read: ${(e as Error).message}`)
      setPhase('searching')
    }
  }

  async function capture(quad: Quad | null) {
    const v = videoRef.current
    if (!v || !v.videoWidth || phaseRef.current === 'capturing' || phaseRef.current === 'reading') return
    setPhase('capturing')
    setHint('Capturing…')
    armed.current = false
    lastCaptured.current = quad

    // Burst of 3 frames, keep the sharpest
    let best: ImageData | null = null
    let bestSharp = -1
    for (let i = 0; i < 3; i++) {
      const fr = grabPixels(v, canvases.current.frame, v.videoWidth, v.videoHeight)
      const s = regionSharpness(fr, quad)
      if (s > bestSharp) { bestSharp = s; best = fr }
      if (i < 2) await sleep(70)
    }
    if (bestSharp < MIN_SHARPNESS && autoRef.current) {
      setHint('Too blurry, hold still')
      armed.current = true
      history.current = []
      setPhase('tracking')
      return
    }
    setFlash(true)
    setTimeout(() => setFlash(false), 150)
    await finish(makeCleanScan(best!, quad))
  }

  async function importPhoto(file: File) {
    clearTimeout(resumeTimer.current)
    setResult(null)
    setPhase('capturing')
    setHint('Processing photo…')
    try {
      const bmp = await createImageBitmap(file)
      const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
      const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
      const fr = grabPixels(bmp, canvases.current.frame, w, h)
      const ah = Math.round((ANALYSIS_WIDTH * h) / w)
      const small = grabPixels(bmp, canvases.current.analysis, ANALYSIS_WIDTH, ah)
      bmp.close()
      const det = detectReceipt(small.data, ANALYSIS_WIDTH, ah)
      await finish(makeCleanScan(fr, det?.quad ?? null))
    } catch (e) {
      setHint(`Could not open photo: ${(e as Error).message}`)
      setPhase('searching')
    }
  }

  function resume() {
    clearTimeout(resumeTimer.current)
    setResult(null)
    setEditing(false)
    setPeekWords([])
    history.current = []
    setProgress(0)
    setHint(streamRef.current ? 'Point the camera at a receipt' : 'Camera not available')
    setPhase(streamRef.current ? 'searching' : 'error')
  }

  // ---------- detection loop ----------
  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < FRAME_INTERVAL_MS) return
      last = t
      const v = videoRef.current
      const ph = phaseRef.current
      if (!v || v.readyState < 2 || !v.videoWidth || (ph !== 'searching' && ph !== 'tracking')) {
        if (ph !== 'capturing') drawOverlay(null)
        return
      }
      const ah = Math.round((ANALYSIS_WIDTH * v.videoHeight) / v.videoWidth)
      const img = grabPixels(v, canvases.current.analysis, ANALYSIS_WIDTH, ah)
      const det = detectReceipt(img.data, ANALYSIS_WIDTH, ah)

      if (!det) {
        missCount.current++
        if (missCount.current >= 6) {
          armed.current = true
          history.current = []
          lastDet.current = null
          setPeekWords([])
        }
        drawOverlay(null)
        setProgress(0)
        setHint('Point the camera at a receipt')
        if (ph !== 'searching') setPhase('searching')
        return
      }

      missCount.current = 0
      lastDet.current = det
      if (!armed.current && lastCaptured.current && quadDistance(det.quad, lastCaptured.current) > 0.2) armed.current = true

      const h = history.current
      h.push(det.quad)
      if (h.length > 12) h.shift()
      let steady = 0
      for (let i = h.length - 1; i >= 0 && quadDistance(h[i], det.quad) < STEADY_MOVE; i--) steady++
      const p = armed.current ? Math.min(1, steady / STEADY_FRAMES) : 0

      drawOverlay(det.quad, p, armed.current)
      setProgress(p)
      if (ph !== 'tracking') setPhase('tracking')

      if (!armed.current) setHint('Saved. Show the next receipt')
      else if (det.brightness < 110) setHint('More light needed')
      else if (det.areaRatio < 0.12) setHint('Move closer')
      else if (!autoRef.current) setHint('Receipt found. Tap the shutter')
      else setHint(p < 1 ? 'Receipt found, hold still…' : 'Capturing…')

      maybePeek()
      if (autoRef.current && armed.current && steady >= STEADY_FRAMES && det.brightness >= 100) void capture(det.quad)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- UI ----------
  const receipt = saved ?? result?.receipt
  const cat = categories.find((c) => c.id === receipt?.categoryId)
  const busy = phase === 'capturing' || phase === 'reading'

  return (
    <div className="relative h-[calc(100dvh-4.25rem-env(safe-area-inset-bottom))] overflow-hidden bg-black text-white">
      <div ref={containerRef} className="absolute inset-0">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        {flash && <div className="absolute inset-0 bg-white/80" />}
      </div>

      {/* top status */}
      <div className="absolute inset-x-0 top-0 space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="rounded-full bg-black/60 px-4 py-2 text-sm font-medium backdrop-blur" role="status">
            {phase === 'reading' ? `Reading receipt… ${Math.round(ocrProgress * 100)}%` : hint}
          </div>
          <button
            className={`rounded-full px-3 py-2 text-xs font-semibold backdrop-blur ${autoMode ? 'bg-teal-600/90' : 'bg-black/60'}`}
            onClick={() => setAutoMode((a) => !a)}
            aria-pressed={autoMode}
          >
            AUTO {autoMode ? 'ON' : 'OFF'}
          </button>
        </div>
        {phase === 'tracking' && progress > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-green-400 transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
        {peekWords.length > 0 && (phase === 'tracking' || phase === 'searching') && (
          <div className="flex flex-wrap gap-1.5">
            {peekWords.map((w) => (
              <span key={w} className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-900">🔎 {w}</span>
            ))}
          </div>
        )}
      </div>

      {phase === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-base">{error}</p>
          <button className="btn-primary" onClick={() => fileRef.current?.click()}>Choose a photo instead</button>
        </div>
      )}

      {phase === 'reading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            <p className="text-sm">Reading text and adding it up…</p>
          </div>
        </div>
      )}

      {/* bottom controls */}
      {phase !== 'result' && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-around p-5">
          <button className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-xl backdrop-blur" onClick={() => fileRef.current?.click()} aria-label="Choose photo from gallery" disabled={busy}>
            🖼️
          </button>
          <button
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 active:scale-95 disabled:opacity-50"
            onClick={() => { armed.current = true; void capture(lastDet.current?.quad ?? null) }}
            disabled={busy || phase === 'error' || phase === 'starting'}
            aria-label="Capture now"
          >
            <span className="h-14 w-14 rounded-full bg-white" />
          </button>
          <button
            className={`flex h-12 w-12 items-center justify-center rounded-full text-xl backdrop-blur ${torchOn ? 'bg-yellow-400 text-black' : 'bg-black/60'} disabled:opacity-30`}
            onClick={async () => { await setTorch(streamRef.current, !torchOn).catch(() => undefined); setTorchOn((t) => !t) }}
            disabled={!hasTorch}
            aria-label="Torch"
          >
            🔦
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void importPhoto(f)
        }}
      />

      {/* result card */}
      {phase === 'result' && result && receipt && (
        <div
          className="absolute inset-x-0 bottom-0 max-h-[80%] overflow-y-auto rounded-t-3xl bg-slate-50 p-4 text-slate-900"
          onPointerDown={() => clearTimeout(resumeTimer.current)}
        >
          <div className="flex gap-3">
            {thumbUrl && <img src={thumbUrl} alt="Scanned receipt" className="h-28 w-20 rounded-lg border border-slate-200 bg-white object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">{receipt.merchant}</p>
              <p className="text-2xl font-bold tabular-nums">{receipt.totalSen ? formatRM(receipt.totalSen) : 'RM ?'}</p>
              <p className="text-xs text-slate-500">{receipt.receiptDate}</p>
            </div>
          </div>

          {result.duplicateOf ? (
            <p className="mt-3 rounded-xl bg-slate-200 px-3 py-2 text-sm">Already saved earlier, so it wasn't added again.</p>
          ) : receipt.status === 'needs_review' ? (
            <p className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">
              ⚠ Not sure ({receipt.reason}). Pick the right category below, or tap Edit to fix the amount.
            </p>
          ) : (
            <p className="mt-3 rounded-xl bg-green-100 px-3 py-2 text-sm text-green-900">
              ✔ Saved to <b>{monthKey(receipt.receiptDate)} / {cat?.name}</b>. {receipt.status === 'auto' && <span className="text-green-800">({receipt.reason})</span>}
            </p>
          )}

          {!result.duplicateOf && (
            <>
              <p className="mt-3 mb-1 text-xs font-semibold text-slate-500 uppercase">
                {receipt.status === 'needs_review' ? 'Which category?' : 'Wrong category? Tap the right one'}
              </p>
              <CategoryChips
                categories={categories}
                selectedId={receipt.status === 'needs_review' ? undefined : receipt.categoryId}
                onPick={(id) => void confirmCategory(receipt, id)}
              />
            </>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            {!result.duplicateOf && (
              <>
                <button className="btn-ghost" onClick={async () => { await db.receipts.delete(receipt.id); resume() }}>Undo</button>
                <button className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>
              </>
            )}
            <button className={`btn-primary ${result.duplicateOf ? 'col-span-3' : ''}`} onClick={resume}>Next ▶</button>
          </div>
        </div>
      )}

      {editing && saved && <ReceiptSheet receipt={saved} onClose={() => setEditing(false)} />}
    </div>
  )
}
