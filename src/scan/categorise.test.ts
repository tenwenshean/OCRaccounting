import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from '../db/defaultCategories'
import { categorise, normaliseMerchant, trainNaiveBayes } from './categorise'

const cats = DEFAULT_CATEGORIES

describe('categorise', () => {
  it('recognises a known petrol station', () => {
    const g = categorise({ merchant: 'Shell', text: 'SHELL JALAN IPOH\nRON95 38.46 L\nTOTAL 78.85' }, cats, [])
    expect(g.categoryId).toBe('petrol')
    expect(g.confidence).toBeGreaterThanOrEqual(0.9)
    expect(g.keywords).toContain('ron95')
  })

  it('uses keywords for an unknown shop', () => {
    const g = categorise({ merchant: 'Restoran Ah Seng', text: 'RESTORAN AH SENG\nNasi Kandar Ayam 12.00\nTeh Tarik 2.80\nJUMLAH 14.80' }, cats, [])
    expect(g.categoryId).toBe('food')
    expect(g.reason).toMatch(/nasi|teh|restoran/)
  })

  it('your correction beats everything', () => {
    const rules = [{ pattern: normaliseMerchant('Kedai ABC Sdn Bhd'), categoryId: 'gift' }]
    const g = categorise({ merchant: 'KEDAI ABC SDN. BHD.', text: 'kedai abc\nnasi 5.00' }, cats, rules)
    expect(g.categoryId).toBe('gift')
    expect(g.confidence).toBeGreaterThan(0.9)
  })

  it('falls back to Others with low confidence', () => {
    const g = categorise({ merchant: 'Unknown shop', text: 'item a 3.00\ntotal 3.00' }, cats, [])
    expect(g.categoryId).toBe('others')
    expect(g.confidence).toBeLessThan(0.7)
  })

  it('learns from confirmed receipts', () => {
    const past = Array.from({ length: 6 }, (_, i) => ({
      ocrText: i % 2 ? 'bengkel motor servis minyak hitam spark plug' : 'kedai buku pensel pemadam kertas',
      categoryId: i % 2 ? 'transport' : 'shopping',
      status: 'confirmed' as const,
    }))
    const nb = trainNaiveBayes(past)
    const g = categorise({ merchant: 'Bengkel Ali', text: 'bengkel ali\nservis minyak hitam\nspark plug 20.00' }, cats, [], nb)
    expect(g.categoryId).toBe('transport')
  })
})
