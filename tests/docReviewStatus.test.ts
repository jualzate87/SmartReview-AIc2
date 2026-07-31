import { describe, expect, it } from 'vitest'
import {
  countDocsIncompleteForReviewer,
  countDocsNeedingReviewerConfirm,
  getDocConfirmStatus,
} from '../src/pages/data-review/docReviewStatus'

const DOC_KEYS = ['techCircle', '1099-r'] as const

describe('countDocsIncompleteForReviewer', () => {
  it('counts unverified docs when preparer has not verified', () => {
    const count = countDocsIncompleteForReviewer({
      verifiedDocs: new Set(),
      reviewerConfirmedDocs: new Set(),
      docKeys: DOC_KEYS,
    })
    expect(count).toBe(2)
  })

  it('counts needs-confirm docs after preparer verified but reviewer has not', () => {
    const count = countDocsIncompleteForReviewer({
      verifiedDocs: new Set(['techCircle', '1099-r']),
      reviewerConfirmedDocs: new Set(),
      docKeys: DOC_KEYS,
    })
    expect(count).toBe(2)
    expect(getDocConfirmStatus(new Set(['techCircle']), 'techCircle', new Set())).toBe('needs-confirm')
  })

  it('excludes reviewer-confirmed docs', () => {
    const count = countDocsIncompleteForReviewer({
      verifiedDocs: new Set(['techCircle', '1099-r']),
      reviewerConfirmedDocs: new Set(['techCircle']),
      docKeys: DOC_KEYS,
    })
    expect(count).toBe(1)
    expect(countDocsNeedingReviewerConfirm({
      verifiedDocs: new Set(['techCircle', '1099-r']),
      reviewerConfirmedDocs: new Set(['techCircle']),
      docKeys: DOC_KEYS,
    })).toBe(1)
  })
})
