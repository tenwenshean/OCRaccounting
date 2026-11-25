import { useState } from 'react'
import { useFolderTree } from '../hooks/useData'
import { monthLabel, monthSummaryCsv } from '../lib/folders'
import { formatRM } from '../lib/money'
import { buildFoldersZip, saveFile } from '../lib/exportZip'

/** Monthly totals per category, e.g. Petrol RM500 / Food RM600 / Gift RM300 / Telco RM30. */
export function Summary() {
  const { months } = useFolderTree()
  const [picked, setPicked] = useState<string>()
  const [busy, setBusy] = useState(false)

  if (months.length === 0)
    return (
      <div className="p-4">
        <h1 className="mb-2 text-xl font-bold">Monthly total</h1>
        <p className="text-slate-500">Nothing to total yet.</p>
      </div>
    )

  const month = months.find((m) => m.month === picked) ?? months[0]
  const rows = month.categories.filter((f) => f.totalSen > 0)
  const max = Math.max(1, ...rows.map((r) => r.totalSen))

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Monthly total</h1>
        <select className="field w-auto py-2" value={month.month} onChange={(e) => setPicked(e.target.value)} aria-label="Month">
          {months.map((m) => (
            <option key={m.month} value={m.month}>{monthLabel(m.month)}</option>
          ))}
        </select>
      </div>

      <section className="card p-4">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((f) => (
              <tr key={f.category.id} className="align-middle">
                <td className="py-2 pr-2 whitespace-nowrap">
                  <span aria-hidden>{f.category.icon}</span> {f.category.name}
                </td>
                <td className="w-full px-2">
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full" style={{ width: `${(f.totalSen / max) * 100}%`, backgroundColor: f.category.color }} />
                  </div>
                </td>
                <td className="py-2 pl-2 text-right font-medium whitespace-nowrap tabular-nums">{formatRM(f.totalSen)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-800">
              <td className="pt-3 font-bold" colSpan={2}>Total</td>
              <td className="pt-3 text-right text-base font-bold whitespace-nowrap tabular-nums">{formatRM(month.totalSen)}</td>
            </tr>
          </tfoot>
        </table>
        {month.pendingCount > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Needs review: {month.pendingCount} receipt(s), {formatRM(month.pendingSen)}, not counted until confirmed.
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn-ghost"
          onClick={() => saveFile(new Blob([monthSummaryCsv(month)], { type: 'text/csv' }), `summary-${month.month}.csv`)}
        >
          📊 Summary CSV
        </button>
        <button
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await saveFile(await buildFoldersZip([month]), `OCRaccounting-${month.month}.zip`)
            } finally {
              setBusy(false)
            }
          }}
        >
          🗂️ {busy ? 'Packing…' : 'Pictures + total (ZIP)'}
        </button>
      </div>
    </div>
  )
}
