import { db } from '../db/db'
import type { Receipt } from '../db/types'
import { useCategories, useObjectUrl } from '../hooks/useData'
import { ReceiptForm } from './ReceiptForm'

/** Full-screen sheet to view the picture and fix category / amount / date. */
export function ReceiptSheet({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const categories = useCategories()
  const url = useObjectUrl(receipt.image)

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
        <p className="mb-3 text-xs text-slate-500">Why this category: {receipt.reason}</p>
        <ReceiptForm
          categories={categories}
          initial={receipt}
          submitLabel="Save changes"
          onSubmit={async (v) => {
            await db.receipts.update(receipt.id, { ...v, status: 'confirmed' })
            onClose()
          }}
        />
        <button
          className="btn-danger mt-3 w-full"
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
