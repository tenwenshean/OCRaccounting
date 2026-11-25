import Dexie, { type EntityTable } from 'dexie'
import type { Category, MerchantRule, Receipt, Setting, Split } from './types'
export type { Category }
import { DEFAULT_CATEGORIES } from './defaultCategories'

export class ReceiptDB extends Dexie {
  receipts!: EntityTable<Receipt, 'id'>
  categories!: EntityTable<Category, 'id'>
  splits!: EntityTable<Split, 'id'>
  merchantRules!: EntityTable<MerchantRule, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name = 'ocraccounting') {
    super(name)
    this.version(1).stores({
      receipts: 'id, receiptDate, categoryId, status, merchant, createdAt',
      categories: 'id, order',
      splits: '++id, receiptId, categoryId',
      merchantRules: '++id, &pattern',
      settings: 'key',
    })
    // v2: add Shopping category and merge the improved default keywords
    this.version(2).upgrade(async (tx) => {
      const table = tx.table<Category, string>('categories')
      for (const def of DEFAULT_CATEGORIES) {
        const existing = await table.get(def.id)
        if (!existing) await table.add(def)
        else await table.update(def.id, { keywords: [...new Set([...existing.keywords, ...def.keywords])] })
      }
    })
    this.on('populate', (tx) => {
      tx.table('categories').bulkAdd(DEFAULT_CATEGORIES)
    })
  }
}

export const db = new ReceiptDB()

export function newId(): string {
  return crypto.randomUUID()
}

/** Ask the browser not to auto-clear our storage. Safe to call repeatedly. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
