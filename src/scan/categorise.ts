/**
 * Decide which category a receipt belongs to, with a confidence score and a reason.
 * Order (first strong answer wins):
 *   1. your own corrections for this merchant
 *   2. a well-known Malaysian merchant
 *   3. keyword scoring on the whole receipt
 *   4. a small classifier trained on receipts you confirmed (all on this device)
 */
import type { Category, MerchantRule, Receipt } from '../db/types'
import { UNCATEGORISED_ID } from '../db/defaultCategories'
import { findBrand } from './brands'

export interface CategoryGuess {
  categoryId: string
  confidence: number
  reason: string
  /** Keywords spotted on the receipt (shown live on the scanner) */
  keywords: string[]
}

/** Receipts at or above this confidence (with a total) are filed automatically. */
export const AUTO_FILE_CONFIDENCE = 0.7

export function normaliseMerchant(m: string): string {
  return m
    .toLowerCase()
    .replace(/\b(sdn|bhd|berhad|enterprise|trading|plt|m\)|\(m\)|malaysia)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Count keyword hits per category. Each keyword counts at most twice. */
export function keywordHits(text: string, categories: Category[]): Map<string, string[]> {
  const t = text.toLowerCase()
  const hits = new Map<string, string[]>()
  for (const c of categories) {
    const found: string[] = []
    for (const k of c.keywords) {
      const re = new RegExp(`(^|[^a-z0-9])${escapeRe(k.toLowerCase())}(?=$|[^a-z0-9])`, 'g')
      const n = Math.min(2, (t.match(re) ?? []).length)
      for (let i = 0; i < n; i++) found.push(k)
    }
    if (found.length) hits.set(c.id, found)
  }
  return hits
}

// ---- tiny naive Bayes trained on confirmed receipts ----
function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]{3,}/g) ?? []).slice(0, 400)
}

export interface NaiveBayes {
  docs: Map<string, number>
  words: Map<string, Map<string, number>>
  totals: Map<string, number>
  vocab: Set<string>
  n: number
}

export function trainNaiveBayes(receipts: Pick<Receipt, 'ocrText' | 'categoryId' | 'status'>[]): NaiveBayes {
  const nb: NaiveBayes = { docs: new Map(), words: new Map(), totals: new Map(), vocab: new Set(), n: 0 }
  for (const r of receipts) {
    if (r.status !== 'confirmed' || !r.ocrText) continue
    nb.n++
    nb.docs.set(r.categoryId, (nb.docs.get(r.categoryId) ?? 0) + 1)
    const wc = nb.words.get(r.categoryId) ?? new Map<string, number>()
    for (const w of new Set(tokens(r.ocrText))) {
      wc.set(w, (wc.get(w) ?? 0) + 1)
      nb.totals.set(r.categoryId, (nb.totals.get(r.categoryId) ?? 0) + 1)
      nb.vocab.add(w)
    }
    nb.words.set(r.categoryId, wc)
  }
  return nb
}

function classify(nb: NaiveBayes, text: string): { categoryId: string; p: number } | null {
  if (nb.n < 5 || nb.docs.size < 2) return null
  const ws = [...new Set(tokens(text))].filter((w) => nb.vocab.has(w))
  if (ws.length < 3) return null
  const scores: [string, number][] = []
  for (const [cat, d] of nb.docs) {
    const wc = nb.words.get(cat)!
    const total = nb.totals.get(cat) ?? 0
    let s = Math.log(d / nb.n)
    for (const w of ws) s += Math.log(((wc.get(w) ?? 0) + 1) / (total + nb.vocab.size))
    scores.push([cat, s])
  }
  const max = Math.max(...scores.map((s) => s[1]))
  const exp = scores.map(([c, s]) => [c, Math.exp(s - max)] as const)
  const sum = exp.reduce((a, [, e]) => a + e, 0)
  const [cat, e] = exp.reduce((a, b) => (b[1] > a[1] ? b : a))
  return { categoryId: cat, p: e / sum }
}

export function categorise(
  input: { merchant: string; text: string },
  categories: Category[],
  rules: MerchantRule[],
  nb?: NaiveBayes,
): CategoryGuess {
  const validIds = new Set(categories.map((c) => c.id))
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? id
  const lines = input.text.split('\n')
  const hits = keywordHits(input.text, categories)
  const allKeywords = [...new Set([...hits.values()].flat().map((k) => k.toLowerCase()))]

  // 1. your corrections
  const m = normaliseMerchant(input.merchant)
  if (m) {
    const rule = rules.find((r) => validIds.has(r.categoryId) && (r.pattern === m || (r.pattern.length >= 4 && m.includes(r.pattern))))
    if (rule) {
      return { categoryId: rule.categoryId, confidence: 0.97, reason: `You filed "${input.merchant}" as ${nameOf(rule.categoryId)} before`, keywords: allKeywords }
    }
  }

  // 2. known merchant
  const brand = findBrand(lines.slice(0, 15)) ?? findBrand(lines)
  if (brand && validIds.has(brand.brand.categoryId)) {
    return {
      categoryId: brand.brand.categoryId,
      confidence: brand.line < 15 ? 0.92 : 0.8,
      reason: `Recognised ${brand.brand.name}`,
      keywords: [brand.brand.name, ...allKeywords.filter((k) => k !== brand.brand.name.toLowerCase())],
    }
  }

  // 3. keywords
  const ranked = [...hits.entries()].sort((a, b) => b[1].length - a[1].length)
  let best: CategoryGuess | null = null
  if (ranked.length) {
    const [cat, words] = ranked[0]
    const top = words.length
    const second = ranked[1]?.[1].length ?? 0
    let confidence = top >= 3 ? 0.85 : top === 2 ? 0.72 : 0.55
    if (second > 0 && second >= top * 0.75) confidence -= 0.2
    best = { categoryId: cat, confidence, reason: `Found words: ${[...new Set(words)].join(', ')}`, keywords: allKeywords }
  }

  // 4. learned classifier
  if (nb) {
    const c = classify(nb, input.text)
    if (c && validIds.has(c.categoryId)) {
      const confidence = Math.min(0.85, c.p * 0.85)
      if (!best || confidence > best.confidence) {
        best = { categoryId: c.categoryId, confidence, reason: `Looks like your past ${nameOf(c.categoryId)} receipts`, keywords: allKeywords }
      }
    }
  }

  return best ?? { categoryId: UNCATEGORISED_ID, confidence: 0.2, reason: 'No shop name or keywords recognised', keywords: allKeywords }
}
