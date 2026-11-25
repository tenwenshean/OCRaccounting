import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { Category } from '../db/types'
import { buildFolderTree, type MonthFolder } from '../lib/folders'

export function useCategories(): Category[] {
  return useLiveQuery(() => db.categories.orderBy('order').toArray(), [], [])
}

/** Live Month -> Category -> pictures tree; updates whenever receipts change. */
export function useFolderTree(): { months: MonthFolder[]; loading: boolean } {
  const receipts = useLiveQuery(() => db.receipts.toArray(), [])
  const categories = useCategories()
  const months = useMemo(
    () => (receipts ? buildFolderTree(receipts, categories) : []),
    [receipts, categories],
  )
  return { months, loading: receipts === undefined }
}

/** Object URL for a Blob that is revoked when the component unmounts. */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return setUrl(undefined)
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
