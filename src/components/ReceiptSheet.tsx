import { useState } from 'react'
import { db } from '../db/db'
import type { Receipt } from '../db/types'
import { useCategories, useObjectUrl } from '../hooks/useData'
import { learnMerchant } from '../scan/pipeline'
import { ReceiptForm } from './ReceiptForm'

/** Full-screen sheet to view the picture and fix category / amount / date / shop. */
export function ReceiptSheet({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const categories = useCategories()
  const url = useObjectUrl(receipt.image)
  const [remember, setRemember] = useState(true)
  const [showText, setShowText] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60" role="dialog" aria-modal="true">
      <div className="mt-auto max-h-[92vh] overflow-y-auto rounded-t-3xl bg-slate-50 p-4 safe-bottom">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Receipt</h2>
          <button className="btn-ghost px-3 py-2" onClick={onClose}>Close</button>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt="Receipt" className="mb-4 max-h-[45vh] w-full rounded-2xl bg-white object-contain" />
          </a>
        )}
        <p className="mb-3 text-xs text-slate-500">Why: {receipt.reason}</p>
        <ReceiptForm
          categories={categories}
          initial={receipt}
          submitLabel="Save"
          onSubmit={async (v) => {
            await db.receipts.update(receipt.id, { ...v, status: 'confirmed', confidence: 1 })
            if (remember) await learnMerchant(v.merchant, v.categoryId)
            onClose()
          }}
        />
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-5 w-5 accent-teal-700" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Always put this shop in the chosen category
        </label>
        {receipt.ocrText && (
          <div className="mt-3">
            <button className="text-sm text-slate-500 underline" onClick={() => setShowText((s) => !s)}>
              {showText ? 'Hide' : 'Show'} text read from receipt
            </button>
            {showText && (
              <pre className="mt-2 max-h-60 overflow-auto rounded-xl bg-white p-3 text-xs whitespace-pre-wrap text-slate-600">{receipt.ocrText}</pre>
            )}
          </div>
        )}
        <button
          className="btn-danger mt-4 w-full"
          onClick={async () => {
            if (confirm('Delete this receipt and its picture? This cannot be undone.')) {
              await db.receipts.delete(receipt.id)
              onClose()
            }
          }}
        >
          Delete receipt
        </button>
      </div>
    </div>
  )
}
