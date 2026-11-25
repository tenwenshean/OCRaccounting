import JSZip from 'jszip'
import type { MonthFolder } from './folders'
import { monthSummaryCsv } from './folders'

/**
 * Build a ZIP laid out exactly like the receipt folders:
 *   OCRaccounting/2026-11/Petrol/2026-11-03_Shell_RM80.00.jpg
 *   OCRaccounting/2026-11/summary-2026-11.csv
 */
export async function buildFoldersZip(months: MonthFolder[]): Promise<Blob> {
  const zip = new JSZip()
  const root = zip.folder('OCRaccounting')!
  for (const m of months) {
    const monthDir = root.folder(m.month)!
    monthDir.file(`summary-${m.month}.csv`, monthSummaryCsv(m))
    for (const f of m.categories) {
      const catDir = monthDir.folder(f.folderName)!
      for (const file of f.files) catDir.file(file.fileName, file.receipt.image)
    }
  }
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

/** Hand a file to the user: share sheet on phones when possible, otherwise download. */
export async function saveFile(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName })
      return
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
