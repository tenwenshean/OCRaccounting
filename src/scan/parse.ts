/**
 * Pull merchant, date and total out of raw OCR text from a Malaysian receipt.
 */
import { findBrand } from './brands'

export interface ParsedReceipt {
  merchant: string
  /** YYYY-MM-DD, or null when no valid date was found */
  date: string | null
  totalSen: number | null
  taxSen: number | null
  /** How the total was found, shown to the user */
  totalSource: string
  /** Did the text look like a receipt at all? */
  looksLikeReceipt: boolean
  lines: string[]
}

/** Fix typical OCR slips inside numbers: O->0, l/I->1, S->5, "12 . 50"->"12.50". */
export function normaliseLine(line: string): string {
  return line
    // Number-like runs with at least 2 real digits: O->0, l/I/|->1
    .replace(/[\dOoIl|][\dOoIl|.,]*[\dOoIl|]/g, (m) =>
      (m.match(/\d/g) ?? []).length >= 2 && /[\d][.,]|[.,][\dOo]/.test(m)
        ? m.replace(/[oO]/g, '0').replace(/[lI|]/g, '1')
        : m,
    )
    .replace(/(?<=\d)\s*([.,])\s*(?=\d{2}\b)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

// Not followed by another digit group, so dates like 14.11.2026 aren't read as RM14.11
const AMOUNT_RE = /(?<![\d.\-/])(\d{1,3}(?:,\d{3})+|\d{1,6})[.,](\d{2})(?!\d|[.,\-/]\d)/g

/** All money amounts on a line, in sen, left to right. */
export function amountsInLine(line: string): number[] {
  const out: number[] = []
  for (const m of line.matchAll(AMOUNT_RE)) {
    out.push(Number(m[1].replace(/,/g, '')) * 100 + Number(m[2]))
  }
  return out
}

const STRONG_TOTAL = /\b(grand\s?total|total\s?amount|amount\s?due|net\s?total|total\s?due|total\s?payable|total\s?(incl|inclusive|rounded|after)|jumlah\s?(besar|bayaran|perlu dibayar)|jumlah)\b/i
const TOTAL = /\btota[l1i]\b|\bt[o0]tal\b/i
const NOT_TOTAL = /sub\s?-?\s?tota[l1]|tota[l1]\s?(qty|quantity|item|items|disc|discount|saving|savings|tax|sst|gst|excl|before|point|pts)|\b(tax|sst|gst|service charge|rounding)\b|item\s?count/i
const AMOUNT_LINE = /\b(amount|amaun|nett?|payable)\b/i
const CASH = /\b(cash|tunai|tendered|payment|paid|card|visa|master|debit|credit|e-?wallet|tng|duitnow)\b/i
const CHANGE = /\b(change|baki|balance due)\b/i
const IGNORE_FOR_LARGEST = /\b(cash|tunai|tendered|change|baki|tel|phone|fax|card no|invoice no|receipt no|no\.|reg|ssm|gst id|sst id|points?)\b/i

function findTotal(lines: string[]): { sen: number; source: string } | null {
  // 1. strong total keywords ("GRAND TOTAL", "JUMLAH", "AMOUNT DUE")
  // 2. plain "TOTAL" (not subtotal / total qty / total tax)
  // 2b. "Amount / Amaun / Reload amount" when there is no TOTAL at all
  for (const [re, label] of [[STRONG_TOTAL, 'grand total line'], [TOTAL, 'TOTAL line'], [AMOUNT_LINE, 'amount line']] as const) {
    const found: number[] = []
    lines.forEach((line, i) => {
      if (!re.test(line) || (NOT_TOTAL.test(line) && !STRONG_TOTAL.test(line))) return
      let amts = amountsInLine(line)
      if (amts.length === 0 && i + 1 < lines.length) amts = amountsInLine(lines[i + 1])
      if (amts.length) found.push(amts[amts.length - 1])
    })
    const valid = found.filter((s) => s > 0)
    if (valid.length) return { sen: Math.max(...valid), source: label }
  }

  // 3. cash paid minus change
  let cash: number | null = null, change: number | null = null
  for (const line of lines) {
    const amts = amountsInLine(line)
    if (!amts.length) continue
    if (CHANGE.test(line)) change = amts[amts.length - 1]
    else if (CASH.test(line) && cash === null) cash = amts[amts.length - 1]
  }
  if (cash !== null && change !== null && cash > change) return { sen: cash - change, source: 'cash minus change' }
  if (cash !== null && change === null) return { sen: cash, source: 'payment line' }

  // 4. largest amount on the receipt
  const all = lines.filter((l) => !IGNORE_FOR_LARGEST.test(l)).flatMap(amountsInLine).filter((s) => s < 10_000_00)
  if (all.length) return { sen: Math.max(...all), source: 'largest amount (please check)' }
  return null
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, ogo: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dis: 12,
}

function validDate(y: number, m: number, d: number, today: Date): string | null {
  if (y < 100) y += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, m - 1, d)
  if (dt.getMonth() !== m - 1) return null
  if (y < 2015 || dt.getTime() > today.getTime() + 2 * 86_400_000) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function findDateInLine(t: string, today: Date): string | null {
  // 2026-11-25
  for (const m of t.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    const r = validDate(+m[1], +m[2], +m[3], today); if (r) return r
  }
  // 25/11/2026, 25-11-26, 25.11.2026 (day first, Malaysian format)
  for (const m of t.matchAll(/\b(\d{1,2}) ?[-/.] ?(\d{1,2}) ?[-/.] ?(\d{4}|\d{2})\b/g)) {
    const r = validDate(+m[3], +m[2], +m[1], today); if (r) return r
  }
  // 25 Nov 2026, 25-Nov-26
  for (const m of t.matchAll(/\b(\d{1,2})[ \-/]?([a-z]{3})[a-z]*[ \-/,]? ?(\d{4}|\d{2})\b/g)) {
    const mon = MONTHS[m[2]]
    if (mon) { const r = validDate(+m[3], mon, +m[1], today); if (r) return r }
  }
  // Nov 25, 2026
  for (const m of t.matchAll(/\b([a-z]{3})[a-z]* (\d{1,2}),? (\d{4})\b/g)) {
    const mon = MONTHS[m[1]]
    if (mon) { const r = validDate(+m[3], mon, +m[2], today); if (r) return r }
  }
  return null
}

export function findDate(text: string, today = new Date()): string | null {
  for (const line of text.toLowerCase().split('\n')) {
    const r = findDateInLine(line, today)
    if (r) return r
  }
  return null
}

const NOT_MERCHANT = /tax invoice|invoice|receipt|resit|welcome|selamat|cash bill|official|\btel\b|\bfax\b|phone|www\.|http|@|\bgst\b|\bsst\b|reg\s?no|co\.?\s?no|\(\d+-[a-z]\)|^\d|jalan|\bjln\b|lot\s|no\.\s?\d|taman|\d{5}/i

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bSdn\b/g, 'Sdn').replace(/\bBhd\b/g, 'Bhd')
}

export function findMerchant(lines: string[]): string {
  const brand = findBrand(lines.slice(0, 12))
  if (brand) return brand.brand.name
  for (const line of lines.slice(0, 8)) {
    const letters = (line.match(/[a-z]/gi) ?? []).length
    if (letters < 3 || letters / line.length < 0.5) continue
    if (NOT_MERCHANT.test(line)) continue
    return titleCase(line.replace(/[^\w&'.\- ]/g, '').trim()).slice(0, 40)
  }
  return 'Unknown shop'
}

export function parseReceipt(rawText: string, today = new Date()): ParsedReceipt {
  const lines = rawText.split(/\r?\n/).map(normaliseLine).filter((l) => l.length > 0)
  const text = lines.join('\n')
  const total = findTotal(lines)
  const tax = lines.find((l) => /\b(sst|gst|service tax|tax)\b/i.test(l) && !/id|no\.|reg/i.test(l))
  const taxAmts = tax ? amountsInLine(tax) : []
  const looksLikeReceipt =
    /\b(total|jumlah|rm|cash|tunai|change|baki|subtotal|qty|amount|receipt|invoice)\b/i.test(text) && amountsInLine(text).length > 0

  return {
    merchant: findMerchant(lines),
    date: findDate(text, today),
    totalSen: total?.sen ?? null,
    taxSen: taxAmts.length ? taxAmts[taxAmts.length - 1] : null,
    totalSource: total?.source ?? 'not found',
    looksLikeReceipt,
    lines,
  }
}
