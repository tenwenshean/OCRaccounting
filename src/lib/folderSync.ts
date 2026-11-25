/**
 * PC folder sync (Chrome / Edge on desktop): the user picks a real folder once,
 * and every month's pictures + summary CSV are written into it.
 * Phones don't support this API; they use the ZIP export instead.
 */
import { db } from '../db/db'
import type { MonthFolder } from './folders'
import { monthSummaryCsv } from './folders'

const SETTING_KEY = 'syncFolderHandle'

type PermissionMode = { mode: 'readwrite' }
/** The DOM lib already types entries(); only the permission methods are missing. */
type FsDirHandle = FileSystemDirectoryHandle & {
  queryPermission(d: PermissionMode): Promise<PermissionState>
  requestPermission(d: PermissionMode): Promise<PermissionState>
}

export function folderSyncSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function getSyncFolder(): Promise<FsDirHandle | null> {
  const row = await db.settings.get(SETTING_KEY)
  return (row?.value as FsDirHandle) ?? null
}

export async function chooseSyncFolder(): Promise<FsDirHandle> {
  const picker = (window as unknown as {
    showDirectoryPicker(o: { id: string; mode: 'readwrite' }): Promise<FsDirHandle>
  }).showDirectoryPicker
  const handle = await picker({ id: 'ocraccounting', mode: 'readwrite' })
  await db.settings.put({ key: SETTING_KEY, value: handle })
  return handle
}

export async function forgetSyncFolder(): Promise<void> {
  await db.settings.delete(SETTING_KEY)
}

/** Must be called from a click handler the first time after a browser restart. */
export async function ensurePermission(handle: FsDirHandle): Promise<boolean> {
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: Blob | string) {
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(data)
  await w.close()
}

/**
 * Write one month into <root>/<YYYY-MM>/<Category>/<file>.jpg plus summary-YYYY-MM.csv.
 * Pictures that moved to another category (or were deleted) are removed from their old folder.
 * Only .jpg files inside category folders of that month are ever removed.
 */
export async function syncMonth(root: FsDirHandle, month: MonthFolder): Promise<void> {
  const monthDir = await root.getDirectoryHandle(month.month, { create: true })

  const expected = new Map<string, Set<string>>()
  for (const f of month.categories) {
    expected.set(f.folderName, new Set(f.files.map((x) => x.fileName)))
    const catDir = await monthDir.getDirectoryHandle(f.folderName, { create: true })
    for (const file of f.files) {
      // Skip files that already exist with the same size
      try {
        const existing = await (await catDir.getFileHandle(file.fileName)).getFile()
        if (existing.size === file.receipt.image.size) continue
      } catch {
        /* not there yet */
      }
      await writeFile(catDir, file.fileName, file.receipt.image)
    }
  }

  for await (const [name, entry] of monthDir.entries()) {
    if (entry.kind !== 'directory') continue
    const keep = expected.get(name) ?? new Set<string>()
    for await (const [fileName, fileEntry] of entry.entries()) {
      if (fileEntry.kind === 'file' && fileName.toLowerCase().endsWith('.jpg') && !keep.has(fileName)) {
        await entry.removeEntry(fileName)
      }
    }
  }

  await writeFile(monthDir, `summary-${month.month}.csv`, monthSummaryCsv(month))
}

export async function syncAll(root: FsDirHandle, months: MonthFolder[]): Promise<void> {
  for (const m of months) await syncMonth(root, m)
  // Months that no longer have any receipts: clear their old pictures and summary
  const known = new Set(months.map((m) => m.month))
  for await (const [name, entry] of root.entries()) {
    if (entry.kind === 'directory' && /^\d{4}-\d{2}$/.test(name) && !known.has(name)) {
      await syncMonth(root, { month: name, totalSen: 0, categories: [], pendingCount: 0, pendingSen: 0 })
    }
  }
}
