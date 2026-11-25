import { useState } from 'react'
import type { Receipt } from '../db/types'
import { useFolderTree } from '../hooks/useData'
import { monthLabel } from '../lib/folders'
import { formatRM } from '../lib/money'
import { Thumb } from '../components/Thumb'
import { ReceiptSheet } from '../components/ReceiptSheet'

/** Month -> Category -> pictures, each folder with its own total. */
export function Folders() {
  const { months, loading } = useFolderTree()
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [selected, setSelected] = useState<Receipt | null>(null)

  if (loading) return <p className="p-4 text-slate-500">Loading…</p>
  if (months.length === 0)
    return (
      <div className="p-4">
        <h1 className="mb-2 text-xl font-bold">Folders</h1>
        <p className="text-slate-500">No receipts yet. Tap <b>Scan</b> to add your first one.</p>
      </div>
    )

  const currentMonth = openMonth ?? months[0].month

  return (
    <div className="space-y-3 p-4">
      <h1 className="text-xl font-bold">Folders</h1>
      {months.map((m) => {
        const expanded = m.month === currentMonth
        return (
          <section key={m.month} className="card overflow-hidden">
            <button
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setOpenMonth(expanded ? '' : m.month)}
              aria-expanded={expanded}
            >
              <span className="font-semibold">📁 {m.month} <span className="font-normal text-slate-500">· {monthLabel(m.month)}</span></span>
              <span className="font-bold tabular-nums">{formatRM(m.totalSen)}</span>
            </button>
            {expanded && (
              <div className="border-t border-slate-100">
                {m.categories.map((f) => {
                  const key = `${m.month}/${f.category.id}`
                  const catOpen = openCat === key
                  return (
                    <div key={key} className="border-b border-slate-100 last:border-0">
                      <button
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                        onClick={() => setOpenCat(catOpen ? null : key)}
                        aria-expanded={catOpen}
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: f.category.color }} />
                          {f.category.icon} {f.folderName}
                          <span className="text-xs text-slate-400">({f.files.length})</span>
                        </span>
                        <span className="tabular-nums">{formatRM(f.totalSen)}</span>
                      </button>
                      {catOpen && (
                        <div className="grid grid-cols-3 gap-2 px-4 pb-4 sm:grid-cols-4">
                          {f.files.map(({ receipt, fileName }) => (
                            <button key={receipt.id} onClick={() => setSelected(receipt)} className="text-left">
                              <Thumb blob={receipt.image} alt={fileName} className="aspect-[3/4] w-full rounded-xl border border-slate-200" />
                              <span className="mt-1 block truncate text-xs font-medium">{receipt.merchant}</span>
                              <span className="block text-xs text-slate-500 tabular-nums">
                                {formatRM(receipt.totalSen)}
                                {receipt.status === 'needs_review' && ' · review'}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {m.pendingCount > 0 && (
                  <p className="bg-amber-50 px-4 py-2 text-xs text-amber-800">
                    {m.pendingCount} receipt(s) waiting for review ({formatRM(m.pendingSen)}), not counted yet.
                  </p>
                )}
              </div>
            )}
          </section>
        )
      })}
      {selected && <ReceiptSheet receipt={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
