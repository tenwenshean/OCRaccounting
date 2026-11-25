import type { Category } from '../db/types'

/** Horizontal row of category buttons for one-tap filing. */
export function CategoryChips({
  categories,
  selectedId,
  onPick,
}: {
  categories: Category[]
  selectedId?: string
  onPick: (id: string) => void
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {categories.map((c) => {
        const on = c.id === selectedId
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            className={`shrink-0 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap ${
              on ? 'border-transparent text-white' : 'border-slate-200 bg-white text-slate-700'
            }`}
            style={on ? { backgroundColor: c.color } : undefined}
            aria-pressed={on}
          >
            {c.icon} {c.name}
          </button>
        )
      })}
    </div>
  )
}
