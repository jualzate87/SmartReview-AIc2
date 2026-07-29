import { describe, expect, it } from 'vitest'
import { buildHandoffSnapshot } from '../src/data/handoffSnapshot'
import { buildSmartReviewBrief } from '../src/data/smartReviewBrief'
import { computeLiveReturn, SEED_AMOUNTS } from '../src/data/liveReturn'
import type { ActivityEntry } from '../src/hooks/useSyncedReviewState'
import type { ReviewChecklistState } from '../src/data/reviewChecklist'

const amounts = computeLiveReturn(SEED_AMOUNTS)

function meta(by = 'Sara Chen'): ActivityEntry {
  return { by, at: 'Jun 1 · 2:30 PM' }
}

const emptyChecklist: ReviewChecklistState = {
  items: [],
  completeCount: 0,
  totalCount: 0,
  requiredCompleteCount: 0,
  requiredTotal: 0,
  allRequiredComplete: true,
  blockers: [],
}

describe('buildSmartReviewBrief activity log rollups', () => {
  it('rolls box12 sub-row edits into one reconciliation entry', () => {
    const snapshot = buildHandoffSnapshot('signoff-review', 1, 'Sara Chen', {
      reviewedFields: new Map([
        ['ssn-techCircle', meta()],
        ['wages-techCircle', meta()],
        ['ein-techCircle', meta()],
        ['box12', meta()],
      ]),
      verifiedDocs: new Set(['techCircle']),
      verifiedDocsMeta: new Map([['techCircle', meta()]]),
      editedFields: new Map([
        ['box12a-techCircle', meta()],
        ['box12a-amt-techCircle', meta()],
        ['box12b-techCircle', meta()],
        ['box12b-amt-techCircle', meta()],
        ['wages-techCircle', meta()],
      ]),
      summaryChecked: new Map(),
      summaryFlagged: new Map(),
      summaryFlagNotes: {},
      notes: [],
      amounts,
    })

    const brief = buildSmartReviewBrief({
      snapshot,
      checklist: emptyChecklist,
      outstandingOpenCount: 0,
      manualChecklistItems: {},
      reviewPass: 1,
      showStrategicChecklist: false,
      isPreparer: false,
    })

    const sourceCat = brief.activityLog.find(c => c.id === 'source-docs-ocr')!
    const reconcileCat = brief.activityLog.find(c => c.id === 'form-reconciliations')!

    expect(sourceCat.entries).toHaveLength(1)
    expect(sourceCat.entries[0].label).toBe('W-2 · Tech Circle')
    expect(sourceCat.entries[0].detail).toContain('Cleared 4 import flags')
    expect(sourceCat.entries[0].detail).toContain('W-2 SSN')
    expect(sourceCat.entries[0].detail).toContain('W-2 Box 12 codes')

    const box12Rows = reconcileCat.entries.filter(e => e.label.includes('Box 12'))
    expect(box12Rows).toHaveLength(0)
    expect(sourceCat.entries[0].detail).toContain('Updated W-2 Box 12 codes')

    const rawBox12Keys = brief.activityLog.flatMap(c => c.entries.map(e => e.label))
    expect(rawBox12Keys.some(l => l.includes('box12a-techCircle'))).toBe(false)
  })

  it('uses plain-language labels instead of internal keys', () => {
    const snapshot = buildHandoffSnapshot('signoff-review', 1, 'Sara Chen', {
      reviewedFields: new Map([['fedTaxWithheld', meta()]]),
      verifiedDocs: new Set(['1099-div-tokenFinancial']),
      verifiedDocsMeta: new Map([['1099-div-tokenFinancial', meta()]]),
      editedFields: new Map([
        ['qualifiedDivs', meta()],
        ['usBonds-unwaverIngFinancial', meta()],
        ['r-taxableAmt', meta()],
      ]),
      summaryChecked: new Map([['qualifiedDivs', meta()]]),
      summaryFlagged: new Map(),
      summaryFlagNotes: {},
      notes: [],
      amounts,
    })

    const brief = buildSmartReviewBrief({
      snapshot,
      checklist: emptyChecklist,
      outstandingOpenCount: 0,
      manualChecklistItems: {},
      reviewPass: 1,
      showStrategicChecklist: false,
      isPreparer: false,
    })

    const allLabels = brief.activityLog.flatMap(c => c.entries.map(e => e.label))
    expect(allLabels).toContain('Qualified dividends')
    expect(allLabels).toContain('US bonds (Unwavering Financial)')
    expect(allLabels).toContain('1099-R taxable amount')
    expect(allLabels.some(l => l === 'qualifiedDivs')).toBe(false)
    expect(allLabels.some(l => l === 'r-taxableAmt')).toBe(false)
  })

  it('does not duplicate cleared flags in source docs and reconciliations', () => {
    const snapshot = buildHandoffSnapshot('signoff-review', 1, 'Sara Chen', {
      reviewedFields: new Map([
        ['ssn-techCircle', meta()],
        ['wages-techCircle', meta()],
        ['ein-techCircle', meta()],
      ]),
      verifiedDocs: new Set(['techCircle']),
      verifiedDocsMeta: new Map([['techCircle', meta()]]),
      editedFields: new Map([['wages-techCircle', meta()]]),
      summaryChecked: new Map(),
      summaryFlagged: new Map(),
      summaryFlagNotes: {},
      notes: [],
      amounts,
    })

    const brief = buildSmartReviewBrief({
      snapshot,
      checklist: emptyChecklist,
      outstandingOpenCount: 0,
      manualChecklistItems: {},
      reviewPass: 1,
      showStrategicChecklist: false,
      isPreparer: false,
    })

    const allEntries = brief.activityLog.flatMap(c => c.entries)
    const wagesRows = allEntries.filter(e => e.label.includes('W-2 wages') || e.detail?.includes('W-2 wages'))
    expect(wagesRows.length).toBeLessThanOrEqual(1)
    expect(allEntries.filter(e => e.label === 'W-2 SSN')).toHaveLength(0)
  })
})
