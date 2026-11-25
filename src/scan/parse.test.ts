import { describe, expect, it } from 'vitest'
import { amountsInLine, findDate, normaliseLine, parseReceipt } from './parse'

const TODAY = new Date(2026, 10, 25)

const SHELL = `
SHELL MALAYSIA TRADING SDN BHD
SHELL JALAN IPOH
Tel: 03-4041 1234
TAX INVOICE
Date: 03/11/2026 Time: 18:22
Pump 04 RON95
Qty 38.46 L @ 2.05
FUEL RON95            78.85
SUBTOTAL              78.85
Rounding Adj           0.00
TOTAL         RM      78.85
CASH                 100.00
CHANGE                21.15
`

const KFC = `
KFC Restaurant
KFC HOLDINGS (MALAYSIA) BHD (8475-W)
No. 12, Jalan SS2/24
25-Nov-26 12:41
Dinner Plate A        23.90
Pepsi Regular          4.50
Sub-total             28.40
SST 6%                 1.70
Total Qty: 2
Grand Total           30.10
Visa                  30.10
`

const KEDAI = `
RESTORAN NASI KANDAR AH SENG
Lot 22 Taman Melati 53100
Resit
Nasi Kandar Ayam      12.OO
Teh Tarik              2.80
JUMLAH                14.80
TUNAI                 20.00
BAKI                   5.20
14.11.2026
`

const MAXIS = `
Maxis Broadband Sdn Bhd
Hotlink Prepaid Reload
Reload amount RM30.00
Date 10 Nov 2026
Payment method: DuitNow
`

describe('parseReceipt', () => {
  it('reads a Shell petrol receipt', () => {
    const r = parseReceipt(SHELL, TODAY)
    expect(r.merchant).toBe('Shell')
    expect(r.date).toBe('2026-11-03')
    expect(r.totalSen).toBe(7885)
    expect(r.looksLikeReceipt).toBe(true)
  })

  it('prefers Grand Total over Sub-total and ignores Total Qty', () => {
    const r = parseReceipt(KFC, TODAY)
    expect(r.merchant).toBe('KFC')
    expect(r.date).toBe('2026-11-25')
    expect(r.totalSen).toBe(3010)
    expect(r.taxSen).toBe(170)
  })

  it('reads a Malay receipt with JUMLAH and fixes O->0', () => {
    const r = parseReceipt(KEDAI, TODAY)
    expect(r.merchant).toBe('Restoran Nasi Kandar Ah Seng')
    expect(r.totalSen).toBe(1480)
    expect(r.date).toBe('2026-11-14')
  })

  it('falls back to the payment/largest amount when there is no TOTAL line', () => {
    const r = parseReceipt(MAXIS, TODAY)
    expect(r.merchant).toBe('Maxis')
    expect(r.totalSen).toBe(3000)
    expect(r.date).toBe('2026-11-10')
  })

  it('reports no total for non-receipt text', () => {
    const r = parseReceipt('hello world\nthis is a poster', TODAY)
    expect(r.totalSen).toBeNull()
    expect(r.looksLikeReceipt).toBe(false)
  })
})

describe('helpers', () => {
  it('finds amounts including thousands', () => expect(amountsInLine('TOTAL RM 1,234.50 x 2.00')).toEqual([123450, 200]))
  it('does not read dates as amounts', () => expect(amountsInLine('14.11.2026 25/11/26 3.50')).toEqual([350]))
  it('normalises OCR digits', () => expect(normaliseLine('TOTAL  1O.5O')).toBe('TOTAL 10.50'))
  it('rejects future dates', () => expect(findDate('01/01/2030', TODAY)).toBeNull())
  it('reads yyyy-mm-dd', () => expect(findDate('2026-10-30 10:00', TODAY)).toBe('2026-10-30'))
})
