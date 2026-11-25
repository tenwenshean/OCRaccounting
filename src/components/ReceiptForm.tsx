import { useState } from 'react'
import type { Category } from '../db/types'
import { parseRM, senToPlain } from '../lib/money'

export interface ReceiptFormValues {
  merchant: string
  receiptDate: string
  totalSen: number
  categoryId: string
}

/** Shared form for adding and editing a receipt. */
export function ReceiptForm({
  initial,
  categories,
  submitLabel,
  onSubmit,
  busy = false,
}: {
  initial: ReceiptFormValues
  categories: Category[]
  submitLabel: string
  onSubmit: (v: ReceiptFormValues) => void
  busy?: boolean
}) {
  const [merchant, setMerchant] = useState(initial.merchant)
  const [date, setDate] = useState(initial.receiptDate)
  const [amount, setAmount] = useState(initial.totalSen ? senToPlain(initial.totalSen) : '')
  const [categoryId, setCategoryId] = useState(initial.categoryId)

  const totalSen = parseRM(amount)
  const valid = merchant.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date) && totalSen !== null

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit({ merchant: merchant.trim(), receiptDate: date, totalSen: totalSen!, categoryId })
      }}
    >
      <div>
        <label className="label" htmlFor="merchant">Shop / merchant</label>
        <input id="merchant" className="field" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Shell Jalan Ipoh" autoComplete="off" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="date">Receipt date</label>
          <input id="date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="amount">Total (RM)</label>
          <input id="amount" inputMode="decimal" className="field" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
      </div>
      <div>
        <span className="label">Category</span>
        <div className="grid grid-cols-3 gap-2">
          {categories.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={`rounded-xl border px-2 py-2 text-sm font-medium transition ${
                categoryId === c.id ? 'border-transparent text-white' : 'border-slate-200 bg-white text-slate-700'
              }`}
              style={categoryId === c.id ? { backgroundColor: c.color } : undefined}
              aria-pressed={categoryId === c.id}
            >
              <span aria-hidden>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>
      </div>
      <button type="submit" className="btn-primary w-full" disabled={!valid || busy}>
        {submitLabel}
      </button>
    </form>
  )
}
