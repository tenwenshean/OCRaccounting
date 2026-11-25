import Dexie, { type EntityTable } from 'dexie'
import type { Category, MerchantRule, Receipt, Setting, Split } from './types'
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
