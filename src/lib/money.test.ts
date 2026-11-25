import { describe, expect, it } from 'vitest'
import { formatRM, parseRM, senToPlain } from './money'

describe('parseRM', () => {
  it.each([
    ['80', 8000],
    ['80.5', 8050],
    ['RM 1,234.56', 123456],
    ['rm12.30', 1230],
    ['0.07', 7],
  ])('%s -> %i sen', (input, sen) => expect(parseRM(input)).toBe(sen))

  it.each(['', 'abc', '1.234', '-5', '12.3.4'])('rejects %s', (input) => expect(parseRM(input)).toBeNull())
})

describe('formatting', () => {
  it('formats RM with thousands separator', () => expect(formatRM(143000)).toBe('RM 1,430.00'))
  it('formats small amounts', () => expect(formatRM(7)).toBe('RM 0.07'))
  it('plain amount for files/CSV', () => expect(senToPlain(8050)).toBe('80.50'))
})
