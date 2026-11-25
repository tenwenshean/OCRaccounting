import { useRef, useState } from 'react'
import { db, newId } from '../db/db'
import { UNCATEGORISED_ID } from '../db/defaultCategories'
import { useCategories, useObjectUrl } from '../hooks/useData'
import { ReceiptForm } from '../components/ReceiptForm'
import { toReceiptJpeg, todayISO } from '../lib/image'

/**
 * Milestone 1: take a photo (phone camera opens directly) or pick one, then type the details.
 * Milestone 2 swaps the photo input for the live scanner; milestone 3 fills the form via OCR.
 */
export function AddReceipt({ onSaved }: { onSaved: () => void }) {
  const categories = useCategories()
  const [image, setImage] = useState<Blob>()
  const [busy, setBusy] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const preview = useObjectUrl(image)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      setImage(await toReceiptJpeg(file))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Add receipt</h1>

      <div className="card overflow-hidden">
        {preview ? (
          <img src={preview} alt="Receipt photo" className="max-h-[50vh] w-full bg-slate-100 object-contain" />
        ) : (
          <div className="flex h-48 items-center justify-center bg-slate-100 text-sm text-slate-500">
            No picture yet
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 p-3">
          <button className="btn-primary" onClick={() => cameraRef.current?.click()} disabled={busy}>
            📷 {image ? 'Retake' : 'Take photo'}
          </button>
          <button className="btn-ghost" onClick={() => galleryRef.current?.click()} disabled={busy}>
            🖼️ From gallery
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
        <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      </div>

      {image && (
        <div className="card p-4">
          <ReceiptForm
            key={formKey}
            categories={categories}
            initial={{ merchant: '', receiptDate: todayISO(), totalSen: 0, categoryId: UNCATEGORISED_ID }}
            submitLabel="Save to folder"
            busy={busy}
            onSubmit={async (v) => {
              setBusy(true)
              try {
                await db.receipts.add({
                  id: newId(),
                  image,
                  ...v,
                  confidence: 1,
                  reason: 'Entered by you',
                  status: 'confirmed',
                  ocrText: '',
                  createdAt: Date.now(),
                })
                setImage(undefined)
                setFormKey((k) => k + 1)
                onSaved()
              } finally {
                setBusy(false)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
