import { describe, expect, it } from 'vitest'
import {
  coerceTimestamp,
  sanitizeActivityEntry,
  timestampDatePart,
} from '../src/lib/coerceTimestamp'

describe('coerceTimestamp', () => {
  it('returns trimmed strings unchanged', () => {
    expect(coerceTimestamp('Jul 29 · 2:30 PM')).toBe('Jul 29 · 2:30 PM')
  })

  it('formats finite numbers as locale timestamps', () => {
    const result = coerceTimestamp(1_722_280_200_000)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('formats Date instances', () => {
    const result = coerceTimestamp(new Date('2024-07-29T14:30:00'))
    expect(typeof result).toBe('string')
    expect(result).toMatch(/Jul/)
  })

  it('unwraps nested { at } shapes from legacy persistence', () => {
    expect(coerceTimestamp({ at: 'Jul 29 · 2:30 PM' })).toBe('Jul 29 · 2:30 PM')
    expect(coerceTimestamp({ at: { at: 'Jul 29 · 2:30 PM' } })).toBe('Jul 29 · 2:30 PM')
  })

  it('falls back for null, undefined, booleans, and empty strings', () => {
    expect(coerceTimestamp(null)).toBe('earlier')
    expect(coerceTimestamp(undefined)).toBe('earlier')
    expect(coerceTimestamp(true)).toBe('earlier')
    expect(coerceTimestamp('')).toBe('earlier')
    expect(coerceTimestamp('   ')).toBe('earlier')
  })

  it('always returns a string', () => {
    for (const value of [42, NaN, {}, [], { at: null }, { at: { at: 1_722_280_200_000 } }]) {
      expect(typeof coerceTimestamp(value)).toBe('string')
    }
  })
})

describe('timestampDatePart', () => {
  it('extracts date before middle dot', () => {
    expect(timestampDatePart('Jul 29 · 2:30 PM')).toBe('Jul 29')
  })

  it('never throws on non-string raw values', () => {
    expect(() => timestampDatePart(1_722_280_200_000)).not.toThrow()
    expect(typeof timestampDatePart(1_722_280_200_000)).toBe('string')
  })
})

describe('sanitizeActivityEntry', () => {
  it('coerces malformed at on activity entries', () => {
    const entry = sanitizeActivityEntry({ by: 'Sara Chen', at: 123 }, 'Sara Chen')
    expect(entry.by).toBe('Sara Chen')
    expect(typeof entry.at).toBe('string')
  })
})
