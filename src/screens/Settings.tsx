import { useEffect, useState } from 'react'
import { useFolderTree } from '../hooks/useData'
import { buildFoldersZip, saveFile } from '../lib/exportZip'
import {
  chooseSyncFolder,
  ensurePermission,
  folderSyncSupported,
  forgetSyncFolder,
  getSyncFolder,
  syncAll,
} from '../lib/folderSync'

export function Settings() {
  const { months } = useFolderTree()
  const [folderName, setFolderName] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState('')

  useEffect(() => {
    void getSyncFolder().then((h) => setFolderName(h?.name ?? null))
    void navigator.storage?.persisted?.().then(setPersisted)
    void navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null) setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB used`)
    })
  }, [])

  async function run(label: string, fn: () => Promise<void>) {
    setStatus(`${label}…`)
    try {
      await fn()
      setStatus(`${label}: done ✔`)
    } catch (e) {
      const err = e as Error
      setStatus(err.name === 'AbortError' ? '' : `${label} failed: ${err.message}`)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Settings</h1>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Save pictures to a folder</h2>
        {folderSyncSupported() ? (
          <>
            <p className="text-sm text-slate-600">
              On this computer, receipts are written into a real folder as
              <code className="mx-1 rounded bg-slate-100 px-1">YYYY-MM/Category/picture.jpg</code>
              with a <code className="rounded bg-slate-100 px-1">summary-YYYY-MM.csv</code> total, updated automatically.
            </p>
            <p className="text-sm">Folder: <b>{folderName ?? 'not chosen'}</b></p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary" onClick={() => run('Choose folder', async () => {
                const h = await chooseSyncFolder()
                setFolderName(h.name)
                await syncAll(h, months)
              })}>
                {folderName ? 'Change folder' : 'Choose folder'}
              </button>
              <button className="btn-ghost" disabled={!folderName} onClick={() => run('Sync now', async () => {
                const h = await getSyncFolder()
                if (!h || !(await ensurePermission(h))) throw new Error('No permission for the folder')
                await syncAll(h, months)
              })}>
                Sync now
              </button>
            </div>
            {folderName && (
              <button className="text-sm text-slate-500 underline" onClick={async () => { await forgetSyncFolder(); setFolderName(null) }}>
                Stop syncing to this folder
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-600">
            Phones can't write straight into a folder from a browser. Use <b>Save all as ZIP</b> below: it contains the
            same <code className="rounded bg-slate-100 px-1">YYYY-MM/Category/</code> folders with all pictures and a
            monthly total, ready to save to Files or Google Drive.
          </p>
        )}
        <button className="btn-ghost w-full" disabled={months.length === 0} onClick={() => run('Save all as ZIP', async () => {
          await saveFile(await buildFoldersZip(months), 'OCRaccounting-all.zip')
        })}>
          🗂️ Save all as ZIP (pictures + totals)
        </button>
        {status && <p className="text-sm text-slate-600" role="status">{status}</p>}
      </section>

      <section className="card space-y-1 p-4 text-sm text-slate-600">
        <h2 className="font-semibold text-slate-900">Storage on this device</h2>
        <p>Your receipts stay on this device only. {usage}</p>
        <p>
          Protected from auto-cleanup: <b>{persisted == null ? 'unknown' : persisted ? 'yes' : 'no'}</b>
          {persisted === false && ' (install the app to your home screen to improve this)'}
        </p>
      </section>
    </div>
  )
}
