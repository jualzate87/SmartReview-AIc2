import { describe, expect, it } from 'vitest'
import { buildHandoffSnapshot } from '../src/data/handoffSnapshot'
import { buildSmartReviewBrief, countStrategicOpenItems } from '../src/data/smartReviewBrief'
import { deriveMilestoneState } from '../src/data/reviewMilestones'
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

describe('buildSmartReviewBrief reviewer checklist', () => {
  it('shows reviewer-strategic view with phased checklist and executive brief', () => {
    const snapshot = buildHandoffSnapshot('signoff-review', 2, 'Jordan Lee', {
      reviewedFields: new Map([['ssn-techCircle', meta()]]),
      verifiedDocs: new Set(['techCircle']),
      verifiedDocsMeta: new Map([['techCircle', meta()]]),
      editedFields: new Map(),
      summaryChecked: new Map([['qualifiedDivs', meta()]]),
      summaryFlagged: new Map(),
      summaryFlagNotes: {},
      notes: [{
        id: 'note-8960',
        text: 'Please confirm NIIT Form 8960 still applies after AGI tweak.',
        author: 'Sara Chen',
        at: 'Jun 1 · 2:30 PM',
        context: 'Form 8960',
        status: 'open',
        role: 'preparer',
        replies: [],
      }],
      amounts,
    })

    const milestoneState = deriveMilestoneState({
      verifiedDocs: new Set(['techCircle']),
      reviewerConfirmedDocs: new Set(),
      summaryCheckedFields: new Set(['qualifiedDivs']),
      reviewerConfirmedFields: new Set(),
      reviewerConfirmStaleFields: new Set(),
      reviewerSignedOffForms: new Set(),
      verifiedDocsMeta: new Map([['techCircle', meta()]]),
      reviewerConfirmedDocsMeta: new Map(),
      reviewerSignedOffFormsMeta: new Map(),
      amounts,
      reviewedFields: new Map([['ssn-techCircle', meta()]]),
      completedMilestones: {},
      outstandingOpenCount: 1,
      currentActorName: 'Jordan Lee',
      reviewPass: 2,
      singlePersonMode: false,
    })

    const brief = buildSmartReviewBrief({
      snapshot,
      checklist: emptyChecklist,
      milestoneState,
      outstandingOpenCount: 1,
      manualChecklistItems: {},
      reviewPass: 2,
      showStrategicChecklist: true,
      isPreparer: false,
      amounts,
    })

    expect(brief.viewMode).toBe('reviewer-strategic')
    expect(brief.executiveBrief?.intro).toContain('Pass 2')
    expect(brief.executiveBrief?.attention?.items.some(i =>
      i.parts.some(p => p.text.includes('milestone')),
    )).toBe(true)
    expect(brief.phases).toHaveLength(5)
    expect(brief.phases[0].title).toContain('Client information')
    const phase2Items = brief.phases.find(p => p.id === 'phase-2')?.items ?? []
    expect(phase2Items.some(i => i.title.includes('W-2'))).toBe(true)
  })

  it('hides reviewer checklist in reviewer-briefing mode', () => {
    const snapshot = buildHandoffSnapshot(
      'signoff-review',
      1,
      'Sara Chen',
      {
        reviewedFields: new Map(),
        verifiedDocs: new Set(),
        editedFields: new Map(),
        summaryChecked: new Map(),
        summaryFlagged: new Map(),
        summaryFlagNotes: {},
        notes: [],
        amounts,
      },
      { voice: 'reviewer-briefing' },
    )

    const brief = buildSmartReviewBrief({
      snapshot,
      checklist: emptyChecklist,
      outstandingOpenCount: 0,
      manualChecklistItems: {},
      reviewPass: 2,
      showStrategicChecklist: false,
      isPreparer: false,
      amounts,
    })

    expect(brief.viewMode).toBe('reviewer-briefing')
    expect(brief.phases).toHaveLength(0)
    expect(brief.executiveBrief).toBeNull()
  })

  it('counts open reviewer checklist items for toolbar badge', () => {
    const snapshot = buildHandoffSnapshot('signoff-review', 2, 'Jordan Lee', {
      reviewedFields: new Map(),
      verifiedDocs: new Set(),
      editedFields: new Map(),
      summaryChecked: new Map(),
      summaryFlagged: new Map(),
      summaryFlagNotes: {},
      notes: [],
      amounts,
    })

    const milestoneState = deriveMilestoneState({
      verifiedDocs: new Set(),
      reviewerConfirmedDocs: new Set(),
      summaryCheckedFields: new Set(),
      reviewerConfirmedFields: new Set(),
      reviewerConfirmStaleFields: new Set(),
      reviewerSignedOffForms: new Set(),
      verifiedDocsMeta: new Map(),
      reviewerConfirmedDocsMeta: new Map(),
      reviewerSignedOffFormsMeta: new Map(),
      amounts,
      reviewedFields: new Map(),
      completedMilestones: {},
      outstandingOpenCount: 0,
      currentActorName: 'Jordan Lee',
      reviewPass: 2,
      singlePersonMode: false,
    })

    const brief = buildSmartReviewBrief({
      snapshot,
      checklist: emptyChecklist,
      milestoneState,
      outstandingOpenCount: 0,
      manualChecklistItems: {},
      reviewPass: 2,
      showStrategicChecklist: true,
      isPreparer: false,
      amounts,
    })

    expect(countStrategicOpenItems(brief.phases)).toBeGreaterThan(0)
  })
})

describe('buildSmartReviewBrief activity log rollups', () => {
  it('uses five plain-language categories with no form-reconciliations bucket', () => {
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

    expect(brief.activityLog.map(c => c.id)).toEqual([
      'documents-verified',
      'import-flags-cleared',
      'amount-edits-no-flag',
      'return-summary-reviewed',
      'first-pass-diags',
    ])
    expect(brief.activityLog.some(c => c.id === 'form-reconciliations')).toBe(false)
  })

  it('lists verified docs and cleared flags separately without duplicating flag edits', () => {
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

    const docsCat = brief.activityLog.find(c => c.id === 'documents-verified')!
    const flagsCat = brief.activityLog.find(c => c.id === 'import-flags-cleared')!
    const editsCat = brief.activityLog.find(c => c.id === 'amount-edits-no-flag')!

    expect(docsCat.title).toBe('Documents verified')
    expect(docsCat.badge).toBe('All verified')
    expect(docsCat.entries).toHaveLength(1)
    expect(docsCat.entries[0].label).toBe('W-2 · Tech Circle')

    expect(flagsCat.title).toBe('Import flags cleared')
    expect(flagsCat.badge).toBe('All cleared')
    expect(flagsCat.entries.map(e => e.label)).toEqual(
      expect.arrayContaining(['W-2 SSN', 'W-2 wages', 'W-2 EIN', 'W-2 Box 12 codes']),
    )
    expect(flagsCat.entries.find(e => e.label === 'W-2 wages')?.detail).toContain('amount edit')

    expect(editsCat.entries).toHaveLength(0)

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

    const flagsCat = brief.activityLog.find(c => c.id === 'import-flags-cleared')!
    const editsCat = brief.activityLog.find(c => c.id === 'amount-edits-no-flag')!

    expect(flagsCat.entries.some(e => e.label === 'Federal tax withheld')).toBe(true)
    expect(editsCat.entries.some(e => e.label === 'US bonds (Unwavering Financial)')).toBe(true)
    expect(editsCat.entries.some(e => e.label === '1099-R taxable amount')).toBe(true)
    expect(editsCat.entries.some(e => e.label === 'Qualified dividends')).toBe(true)

    const allLabels = brief.activityLog.flatMap(c => c.entries.map(e => e.label))
    expect(allLabels.some(l => l === 'qualifiedDivs')).toBe(false)
    expect(allLabels.some(l => l === 'r-taxableAmt')).toBe(false)
  })

  it('does not duplicate cleared flags across categories', () => {
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
    const wagesRows = allEntries.filter(e => e.label === 'W-2 wages')
    expect(wagesRows).toHaveLength(1)
    expect(wagesRows[0].detail).toContain('amount edit')

    const ssnRows = allEntries.filter(e => e.label === 'W-2 SSN')
    expect(ssnRows).toHaveLength(1)
    expect(brief.activityLog.find(c => c.id === 'amount-edits-no-flag')!.entries).toHaveLength(0)
  })
})
