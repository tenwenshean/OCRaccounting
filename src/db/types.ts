export interface Category {
  id: string
  name: string
  /** Tailwind-independent hex colour used for chips and charts */
  color: string
  /** Emoji shown next to the name */
  icon: string
  /** Lower-case words that suggest this category (used by the categoriser) */
  keywords: string[]
  order: number
}

export type ReceiptStatus = 'auto' | 'needs_review' | 'confirmed'

export interface Receipt {
  id: string
  /** Cleaned JPEG of the receipt */
  image: Blob
  merchant: string
  /** Receipt date as YYYY-MM-DD; decides which month it counts towards */
  receiptDate: string
  totalSen: number
  taxSen?: number
  categoryId: string
  /** 0..1 confidence of the automatic category */
  confidence: number
  /** Human-readable reason for the category, e.g. "matched keyword RON95" */
  reason: string
  status: ReceiptStatus
  ocrText: string
  createdAt: number
}

export interface Split {
  id?: number
  receiptId: string
  categoryId: string
  amountSen: number
}

export interface MerchantRule {
  id?: number
  /** Normalised merchant name the rule matches */
  pattern: string
  categoryId: string
}

export interface Setting {
  key: string
  value: unknown
}
