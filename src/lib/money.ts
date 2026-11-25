/** All money is stored as integer sen (RM1.00 = 100) to avoid floating-point errors. */

/** Parse "RM 1,234.50", "1234.5", "12" into sen. Returns null when not a valid amount. */
export function parseRM(input: string): number | null {
  const cleaned = input.replace(/rm/gi, '').replace(/[\s,]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const [whole, frac = ''] = cleaned.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

/** 143000 -> "RM 1,430.00" */
export function formatRM(sen: number): string {
  const sign = sen < 0 ? '-' : ''
  const abs = Math.abs(sen)
  const whole = Math.floor(abs / 100).toLocaleString('en-MY')
  const frac = String(abs % 100).padStart(2, '0')
  return `${sign}RM ${whole}.${frac}`
}

/** 8000 -> "80.00" (no currency, no thousands separator; used in file names and CSV) */
export function senToPlain(sen: number): string {
  const sign = sen < 0 ? '-' : ''
  const abs = Math.abs(sen)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}
