import type { Category, Receipt } from '../db/types'
import { UNCATEGORISED_ID } from '../db/defaultCategories'
import { senToPlain } from './money'

/** "2026-11-03" -> "2026-11" */
export function monthKey(receiptDate: string): string {
  return receiptDate.slice(0, 7)
}

/** "2026-11" -> "November 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
}

/** Make a string safe as a file or folder name on Windows, Android and iOS. */
export function safeName(s: string, fallback = 'Unknown'): string {
  const cleaned = s
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 40)
  return cleaned || fallback
}

/** "2026-11-03_Shell_RM80.00.jpg" */
export function receiptFileName(r: Pick<Receipt, 'receiptDate' | 'merchant' | 'totalSen'>): string {
  return `${r.receiptDate}_${safeName(r.merchant).replace(/ /g, '-')}_RM${senToPlain(r.totalSen)}.jpg`
}

export interface FolderFile {
  receipt: Receipt
  fileName: string
}

export interface CategoryFolder {
  category: Category
  folderName: string
  totalSen: number
  files: FolderFile[]
}

export interface MonthFolder {
  month: string
  /** Sum of counted receipts (auto + confirmed) */
  totalSen: number
  categories: CategoryFolder[]
  /** Receipts still waiting in the review queue (not counted in totals) */
  pendingCount: number
  pendingSen: number
}

/**
 * Build the Month -> Category -> pictures tree used by the Folders screen,
 * the ZIP export and the PC folder sync. Receipts in "needs_review" are listed
 * in their suggested folder but are NOT counted in the totals.
 */
export function buildFolderTree(receipts: Receipt[], categories: Category[]): MonthFolder[] {
  const catById = new Map(categories.map((c) => [c.id, c]))
  const fallback = catById.get(UNCATEGORISED_ID) ?? {
    id: UNCATEGORISED_ID, name: 'Others', color: '#64748b', icon: '📄', keywords: [], order: 99,
  }

  const months = new Map<string, MonthFolder>()
  const sorted = [...receipts].sort(
    (a, b) => a.receiptDate.localeCompare(b.receiptDate) || a.createdAt - b.createdAt,
  )

  for (const r of sorted) {
    const mk = monthKey(r.receiptDate)
    let month = months.get(mk)
    if (!month) {
      month = { month: mk, totalSen: 0, categories: [], pendingCount: 0, pendingSen: 0 }
      months.set(mk, month)
    }

    const category = catById.get(r.categoryId) ?? fallback
    let folder = month.categories.find((f) => f.category.id === category.id)
    if (!folder) {
      folder = { category, folderName: safeName(category.name), totalSen: 0, files: [] }
      month.categories.push(folder)
    }

    // Keep file names unique inside a folder: add _2, _3 ... for identical names
    const base = receiptFileName(r)
    let fileName = base
    for (let n = 2; folder.files.some((f) => f.fileName === fileName); n++) {
      fileName = base.replace(/\.jpg$/, `_${n}.jpg`)
    }
    folder.files.push({ receipt: r, fileName })

    if (r.status === 'needs_review') {
      month.pendingCount++
      month.pendingSen += r.totalSen
    } else {
      folder.totalSen += r.totalSen
      month.totalSen += r.totalSen
    }
  }

  for (const m of months.values()) {
    m.categories.sort((a, b) => a.category.order - b.category.order)
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month))
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** summary-YYYY-MM.csv: totals per category, grand total, then every receipt. */
export function monthSummaryCsv(month: MonthFolder): string {
  const lines: string[] = []
  lines.push(`Month,${month.month}`)
  lines.push('')
  lines.push('Category,Receipts,Total (RM)')
  for (const f of month.categories) {
    const counted = f.files.filter((x) => x.receipt.status !== 'needs_review').length
    if (counted === 0 && f.totalSen === 0) continue
    lines.push(`${csvCell(f.category.name)},${counted},${senToPlain(f.totalSen)}`)
  }
  lines.push(`TOTAL,,${senToPlain(month.totalSen)}`)
  if (month.pendingCount > 0) {
    lines.push(`Needs review (not counted),${month.pendingCount},${senToPlain(month.pendingSen)}`)
  }
  lines.push('')
  lines.push('Date,Merchant,Category,Amount (RM),Status,File')
  for (const f of month.categories) {
    for (const { receipt: r, fileName } of f.files) {
      lines.push(
        [r.receiptDate, csvCell(r.merchant), csvCell(f.category.name), senToPlain(r.totalSen), r.status, `${f.folderName}/${fileName}`].join(','),
      )
    }
  }
  return lines.join('\r\n') + '\r\n'
}
