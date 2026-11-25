import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from '../db/defaultCategories'
import type { Receipt } from '../db/types'
import { buildFolderTree, monthSummaryCsv, receiptFileName, safeName } from './folders'

let n = 0
function receipt(p: Partial<Receipt>): Receipt {
  n++
  return {
    id: `r${n}`,
    image: new Blob(['x']),
    merchant: 'Shop',
    receiptDate: '2026-11-01',
    totalSen: 0,
    categoryId: 'others',
    confidence: 1,
    reason: '',
    status: 'confirmed',
    ocrText: '',
    createdAt: n,
    ...p,
  }
}

describe('buildFolderTree', () => {
  const receipts = [
    receipt({ merchant: 'Shell', categoryId: 'petrol', totalSen: 30000, receiptDate: '2026-11-03' }),
    receipt({ merchant: 'Petronas', categoryId: 'petrol', totalSen: 20000, receiptDate: '2026-11-20' }),
    receipt({ merchant: 'KFC', categoryId: 'food', totalSen: 60000, receiptDate: '2026-11-05' }),
    receipt({ merchant: 'Florist', categoryId: 'gift', totalSen: 30000, receiptDate: '2026-11-14' }),
    receipt({ merchant: 'Maxis', categoryId: 'telco', totalSen: 3000, receiptDate: '2026-11-10' }),
    receipt({ merchant: 'Unknown', categoryId: 'food', totalSen: 4520, status: 'needs_review', receiptDate: '2026-11-11' }),
    receipt({ merchant: 'Shell', categoryId: 'petrol', totalSen: 9000, receiptDate: '2026-10-30' }),
  ]
  const tree = buildFolderTree(receipts, DEFAULT_CATEGORIES)
  const nov = tree.find((m) => m.month === '2026-11')!

  it('groups by month, newest first', () => {
    expect(tree.map((m) => m.month)).toEqual(['2026-11', '2026-10'])
  })

  it('totals each category folder (example from the brief)', () => {
    const totals = Object.fromEntries(nov.categories.map((f) => [f.category.name, f.totalSen]))
    expect(totals).toEqual({ Petrol: 50000, Food: 60000, Gift: 30000, Telco: 3000 })
    expect(nov.totalSen).toBe(143000)
  })

  it('lists needs-review receipts but does not count them', () => {
    expect(nov.pendingCount).toBe(1)
    expect(nov.pendingSen).toBe(4520)
    const food = nov.categories.find((f) => f.category.id === 'food')!
    expect(food.files).toHaveLength(2)
    expect(food.totalSen).toBe(60000)
  })

  it('orders category folders like the category list', () => {
    expect(nov.categories.map((f) => f.folderName)).toEqual(['Petrol', 'Food', 'Gift', 'Telco'])
  })

  it('puts receipts with an unknown category into Others', () => {
    const t = buildFolderTree([receipt({ categoryId: 'deleted-cat', totalSen: 100 })], DEFAULT_CATEGORIES)
    expect(t[0].categories[0].category.id).toBe('others')
  })

  it('makes duplicate file names unique', () => {
    const t = buildFolderTree(
      [
        receipt({ merchant: 'Shell', totalSen: 5000, categoryId: 'petrol' }),
        receipt({ merchant: 'Shell', totalSen: 5000, categoryId: 'petrol' }),
      ],
      DEFAULT_CATEGORIES,
    )
    expect(t[0].categories[0].files.map((f) => f.fileName)).toEqual([
      '2026-11-01_Shell_RM50.00.jpg',
      '2026-11-01_Shell_RM50.00_2.jpg',
    ])
  })

  it('writes a summary CSV with category totals and grand total', () => {
    const csv = monthSummaryCsv(nov)
    expect(csv).toContain('Petrol,2,500.00')
    expect(csv).toContain('Food,1,600.00')
    expect(csv).toContain('Gift,1,300.00')
    expect(csv).toContain('Telco,1,30.00')
    expect(csv).toContain('TOTAL,,1430.00')
    expect(csv).toContain('Needs review (not counted),1,45.20')
    expect(csv).toContain('Petrol/2026-11-03_Shell_RM300.00.jpg')
  })
})

describe('file names', () => {
  it('strips characters that are illegal in folders', () => expect(safeName('A/B:C*?"<>|')).toBe('ABC'))
  it('builds date_merchant_amount.jpg', () =>
    expect(receiptFileName({ receiptDate: '2026-11-03', merchant: 'Shell Jalan Ipoh', totalSen: 8000 })).toBe(
      '2026-11-03_Shell-Jalan-Ipoh_RM80.00.jpg',
    ))
})
