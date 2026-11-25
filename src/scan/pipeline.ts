/**
 * Clean picture -> OCR -> merchant/date/total -> category -> saved into its Month/Category folder.
 */
import { db, newId } from '../db/db'
import type { Receipt } from '../db/types'
import { todayISO } from '../lib/image'
import { AUTO_FILE_CONFIDENCE, categorise, normaliseMerchant, trainNaiveBayes, type CategoryGuess } from './categorise'
import { recognize, type OcrProgress } from './ocr'
import { parseReceipt, type ParsedReceipt } from './parse'
import { canvasToJpeg } from './warp'

export interface ScanResult {
  receipt: Receipt
  parsed: ParsedReceipt
  guess: CategoryGuess
  /** Set when the same receipt was already saved; nothing new is stored. */
  duplicateOf?: Receipt
}

export async function processScan(clean: HTMLCanvasElement, onProgress?: OcrProgress): Promise<ScanResult> {
  const [{ text }, image] = await Promise.all([recognize(clean, onProgress), canvasToJpeg(clean)])
  const parsed = parseReceipt(text)

  const [categories, rules, existing] = await Promise.all([
    db.categories.toArray(),
    db.merchantRules.toArray(),
    db.receipts.toArray(),
  ])
  const guess = categorise({ merchant: parsed.merchant, text: parsed.lines.join('\n') }, categories, rules, trainNaiveBayes(existing))

  const notes: string[] = [guess.reason]
  if (parsed.totalSen === null) notes.push('total not found')
  else if (parsed.totalSource.includes('check')) notes.push(`total taken from ${parsed.totalSource}`)
  if (!parsed.date) notes.push('date not found, used today')

  const needsReview =
    parsed.totalSen === null ||
    !parsed.looksLikeReceipt ||
    guess.confidence < AUTO_FILE_CONFIDENCE ||
    parsed.totalSource.includes('check')

  const receipt: Receipt = {
    id: newId(),
    image,
    merchant: parsed.merchant,
    receiptDate: parsed.date ?? todayISO(),
    totalSen: parsed.totalSen ?? 0,
    taxSen: parsed.taxSen ?? undefined,
    categoryId: guess.categoryId,
    confidence: guess.confidence,
    reason: notes.join('; '),
    status: needsReview ? 'needs_review' : 'auto',
    ocrText: text,
    createdAt: Date.now(),
  }

  const m = normaliseMerchant(receipt.merchant)
  const duplicateOf = parsed.totalSen
    ? existing.find((r) => r.totalSen === receipt.totalSen && r.receiptDate === receipt.receiptDate && normaliseMerchant(r.merchant) === m)
    : undefined

  if (!duplicateOf) await db.receipts.add(receipt)
  return { receipt, parsed, guess, duplicateOf }
}

/** Remember "this merchant goes to this category" for next time. */
export async function learnMerchant(merchant: string, categoryId: string): Promise<void> {
  const pattern = normaliseMerchant(merchant)
  if (!pattern || pattern === 'unknown shop') return
  const existing = await db.merchantRules.where('pattern').equals(pattern).first()
  if (existing) await db.merchantRules.update(existing.id!, { categoryId })
  else await db.merchantRules.add({ pattern, categoryId })
}

/** Move a receipt to a category, mark it confirmed and (optionally) learn the merchant. */
export async function confirmCategory(receipt: Receipt, categoryId: string, remember = true): Promise<void> {
  await db.receipts.update(receipt.id, { categoryId, status: 'confirmed', confidence: 1 })
  if (remember) await learnMerchant(receipt.merchant, categoryId)
}
