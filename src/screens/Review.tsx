import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Receipt } from '../db/types'
import { useCategories } from '../hooks/useData'
import { formatRM } from '../lib/money'
import { Thumb } from '../components/Thumb'
import { CategoryChips } from '../components/CategoryChips'
import { ReceiptSheet } from '../components/ReceiptSheet'
import { confirmCategory } from '../scan/pipeline'

/** Receipts the app wasn't sure about. One tap on a category files it and teaches the app. */
export function Review() {
  const categories = useCategories()
  const pending = useLiveQuery(() => db.receipts.where('status').equals('needs_review').reverse().sortBy('createdAt'), [], [])
  const [selected, setSelected] = useState<Receipt | null>(null)

  return (
    <div className="space-y-3 p-4">
      <h1 className="text-xl font-bold">Needs review</h1>
      {pending.length === 0 ? (
        <p className="text-slate-500">All clear. Every receipt is filed. ✔</p>
      ) : (
        <p className="text-sm text-slate-500">
          These aren't counted in your totals yet. Tap the right category. The app remembers the shop for next time.
        </p>
      )}
      {pending.map((r) => {
        const suggested = categories.find((c) => c.id === r.categoryId)
        return (
          <section key={r.id} className="card space-y-3 p-3">
            <button className="flex w-full gap-3 text-left" onClick={() => setSelected(r)}>
              <Thumb blob={r.image} alt={`Receipt from ${r.merchant}`} className="h-24 w-18 shrink-0 rounded-lg border border-slate-200" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.merchant}</p>
                <p className="text-lg font-bold tabular-nums">{r.totalSen ? formatRM(r.totalSen) : 'RM ? (tap to enter)'}</p>
                <p className="text-xs text-slate-500">{r.receiptDate}</p>
                <p className="mt-1 text-xs text-amber-700">
                  Guess: {suggested?.icon} {suggested?.name}. {r.reason}
                </p>
              </div>
            </button>
            <CategoryChips
              categories={categories}
              onPick={(id) => {
                if (!r.totalSen) setSelected({ ...r, categoryId: id })
                else void confirmCategory(r, id)
              }}
            />
          </section>
        )
      })}
      {selected && <ReceiptSheet receipt={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
