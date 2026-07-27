import { describe, expect, it } from 'vitest'
import {
  divVerifiedDocKey,
  getVerifiedDocEntry,
  intVerifiedDocKey,
  isDocShownVerified,
  isVerifiedInSet,
  normalizeVerifiedDocKey,
  normalizeVerifiedDocEntries,
} from '../src/data/verifiedDocKeys'

describe('normalizeVerifiedDocKey', () => {
  it('maps legacy source-doc ids to canonical verify keys', () => {
    expect(normalizeVerifiedDocKey('1099-div-token')).toBe('1099-div-tokenFinancial')
    expect(normalizeVerifiedDocKey('1099-int-unwavering')).toBe('1099-int-unwaverIngFinancial')
    expect(normalizeVerifiedDocKey('w2-techCircle')).toBe('techCircle')
  })

  it('passes through canonical keys unchanged', () => {
    expect(normalizeVerifiedDocKey('1099-div-tokenFinancial')).toBe('1099-div-tokenFinancial')
    expect(normalizeVerifiedDocKey('techCircle')).toBe('techCircle')
  })
})

describe('isVerifiedInSet', () => {
  it('finds legacy keys stored in session state', () => {
    const set = new Set(['1099-div-token', '1099-int-unwavering'])
    expect(isVerifiedInSet(set, '1099-div-tokenFinancial')).toBe(true)
    expect(isVerifiedInSet(set, intVerifiedDocKey('unwaverIngFinancial'))).toBe(true)
    expect(isVerifiedInSet(set, divVerifiedDocKey('beaconDividend'))).toBe(false)
  })
})

describe('isDocShownVerified', () => {
  it('returns true for preparer or reviewer slot', () => {
    const preparer = new Set(['1099-div-token'])
    const reviewer = new Set<string>()
    expect(isDocShownVerified(preparer, divVerifiedDocKey('tokenFinancial'), reviewer)).toBe(true)

    const reviewerOnly = new Set(['1099-div-tokenFinancial'])
    expect(isDocShownVerified(new Set(), divVerifiedDocKey('tokenFinancial'), reviewerOnly)).toBe(true)
  })
})

describe('getVerifiedDocEntry', () => {
  it('reads meta under legacy keys', () => {
    const meta = new Map([['1099-div-token', { by: 'Sara Chen', at: 'Jun 1' }]])
    expect(getVerifiedDocEntry(meta, divVerifiedDocKey('tokenFinancial'))?.by).toBe('Sara Chen')
  })
})

describe('normalizeVerifiedDocEntries', () => {
  it('merges duplicate legacy and canonical keys', () => {
    const entries = normalizeVerifiedDocEntries([
      ['1099-div-token', { by: 'A', at: '1' }],
      ['1099-div-tokenFinancial', { by: 'B', at: '2' }],
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0][0]).toBe('1099-div-tokenFinancial')
    expect(entries[0][1].by).toBe('A')
  })
})
