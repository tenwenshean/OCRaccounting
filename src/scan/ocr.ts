/**
 * Free on-device OCR with Tesseract.js. One shared worker; jobs are queued.
 * The language file (~4 MB) downloads once, then is cached for offline use.
 */
import { createWorker, PSM, type Worker } from 'tesseract.js'

let workerPromise: Promise<Worker> | null = null
let queue: Promise<unknown> = Promise.resolve()
let busy = false

export type OcrProgress = (status: string, progress: number) => void
let progressListener: OcrProgress | null = null

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const w = await createWorker('eng', 1, {
        logger: (m) => progressListener?.(m.status, m.progress),
      })
      await w.setParameters({
        // SINGLE_BLOCK keeps "TOTAL ........ 30.10" on one line (SINGLE_COLUMN drops right-aligned amounts)
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      })
      return w
    })()
    workerPromise.catch(() => {
      workerPromise = null
    })
  }
  return workerPromise
}

/** Start downloading the OCR engine early so the first scan is fast. */
export function warmUpOcr(): void {
  void getWorker()
}

export function ocrBusy(): boolean {
  return busy
}

export interface OcrResult {
  text: string
  confidence: number
}

export function recognize(image: HTMLCanvasElement | Blob, onProgress?: OcrProgress): Promise<OcrResult> {
  const job = queue.then(async () => {
    busy = true
    progressListener = onProgress ?? null
    try {
      const w = await getWorker()
      const { data } = await w.recognize(image)
      return { text: data.text ?? '', confidence: (data.confidence ?? 0) / 100 }
    } finally {
      busy = false
      progressListener = null
    }
  })
  queue = job.catch(() => undefined)
  return job
}
