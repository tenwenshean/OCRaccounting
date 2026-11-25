import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { Scan } from './screens/Scan'
import { Review } from './screens/Review'
import { Folders } from './screens/Folders'
import { Summary } from './screens/Summary'
import { Settings } from './screens/Settings'
import { useFolderTree } from './hooks/useData'
import { getSyncFolder, syncAll } from './lib/folderSync'

type Tab = 'scan' | 'review' | 'folders' | 'summary' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'scan', label: 'Scan', icon: '📷' },
  { id: 'review', label: 'Review', icon: '⚠️' },
  { id: 'folders', label: 'Folders', icon: '🗂️' },
  { id: 'summary', label: 'Total', icon: '🧮' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

/** Keep the PC folder (if chosen and already permitted) in step with the data. */
function useAutoFolderSync() {
  const { months, loading } = useFolderTree()
  useEffect(() => {
    if (loading) return
    const t = setTimeout(async () => {
      try {
        const h = await getSyncFolder()
        if (h && (await h.queryPermission({ mode: 'readwrite' })) === 'granted') await syncAll(h, months)
      } catch (e) {
        console.warn('Folder sync skipped:', e)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [months, loading])
}

export default function App() {
  const [tab, setTab] = useState<Tab>('scan')
  const reviewCount = useLiveQuery(() => db.receipts.where('status').equals('needs_review').count(), [], 0)
  useAutoFolderSync()

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <main className={`flex-1 ${tab === 'scan' ? '' : 'pb-24'}`}>
        {tab === 'scan' && <Scan />}
        {tab === 'review' && <Review />}
        {tab === 'folders' && <Folders />}
        {tab === 'summary' && <Summary />}
        {tab === 'settings' && <Settings />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur safe-bottom">
        <div className="mx-auto grid h-[4.25rem] max-w-2xl grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-xs font-medium ${tab === t.id ? 'text-teal-700' : 'text-slate-500'}`}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              <span className="text-xl" aria-hidden>{t.icon}</span>
              {t.label}
              {t.id === 'review' && reviewCount > 0 && (
                <span className="absolute top-1 right-[calc(50%-1.4rem)] min-w-5 rounded-full bg-amber-500 px-1.5 text-[11px] leading-5 font-bold text-white">
                  {reviewCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
