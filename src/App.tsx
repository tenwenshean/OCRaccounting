import { useEffect, useState } from 'react'
import { AddReceipt } from './screens/AddReceipt'
import { Folders } from './screens/Folders'
import { Summary } from './screens/Summary'
import { Settings } from './screens/Settings'
import { useFolderTree } from './hooks/useData'
import { getSyncFolder, syncAll } from './lib/folderSync'

type Tab = 'scan' | 'folders' | 'summary' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'scan', label: 'Scan', icon: '📷' },
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
  useAutoFolderSync()

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <main className="flex-1 pb-24">
        {tab === 'scan' && <AddReceipt onSaved={() => setTab('folders')} />}
        {tab === 'folders' && <Folders />}
        {tab === 'summary' && <Summary />}
        {tab === 'settings' && <Settings />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur safe-bottom">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${tab === t.id ? 'text-teal-700' : 'text-slate-500'}`}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              <span className="text-xl" aria-hidden>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
