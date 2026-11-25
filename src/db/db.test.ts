import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { ReceiptDB } from './db'

describe('ReceiptDB', () => {
  it('creates the default categories on first open', async () => {
    const db = new ReceiptDB('test-' + Math.random())
    const names = (await db.categories.orderBy('order').toArray()).map((c) => c.name)
    expect(names).toEqual(['Petrol', 'Food', 'Groceries', 'Entertainment', 'Gift', 'Telco', 'Transport', 'Utilities', 'Health', 'Shopping', 'Others'])
    db.close()
  })

  it('upgrades a v1 database: adds Shopping and keeps user keywords', async () => {
    const name = 'test-upgrade-' + Math.random()
    const v1 = new Dexie(name)
    v1.version(1).stores({ receipts: 'id', categories: 'id, order', splits: '++id', merchantRules: '++id, &pattern', settings: 'key' })
    await v1.table('categories').bulkAdd([
      { id: 'petrol', name: 'Petrol', color: '#000', icon: '⛽', order: 1, keywords: ['my-own-word'] },
      { id: 'others', name: 'Others', color: '#000', icon: '📄', order: 99, keywords: [] },
    ])
    v1.close()

    const db = new ReceiptDB(name)
    const petrol = await db.categories.get('petrol')
    expect(petrol?.keywords).toContain('my-own-word')
    expect(petrol?.keywords).toContain('ron95')
    expect(await db.categories.get('shopping')).toBeTruthy()
    db.close()
  })
})
