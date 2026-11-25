import { describe, expect, it } from 'vitest'
import { ReceiptDB } from './db'

describe('ReceiptDB', () => {
  it('creates the default categories on first open', async () => {
    const db = new ReceiptDB('test-' + Math.random())
    const names = (await db.categories.orderBy('order').toArray()).map((c) => c.name)
    expect(names).toEqual(['Petrol', 'Food', 'Groceries', 'Entertainment', 'Gift', 'Telco', 'Transport', 'Utilities', 'Health', 'Others'])
    db.close()
  })
})
