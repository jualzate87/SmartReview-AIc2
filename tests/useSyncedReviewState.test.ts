import { describe, expect, it, beforeEach } from 'vitest'
import { buildHandoffSnapshot } from '../src/data/handoffSnapshot'
import { buildSmartReviewBrief } from '../src/data/smartReviewBrief'
import { computeLiveReturn, SEED_AMOUNTS } from '../src/data/liveReturn'
import { STORAGE_KEY } from '../src/hooks/useSyncedReviewState'

const amounts = computeLiveReturn(SEED_AMOUNTS)

function makeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.get(key) ?? null
    },
    key(index: number) {
      return [...map.keys()][index] ?? null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
  }
}

describe('review state persistence (localStorage handoff)', () => {
  beforeEach(() => {
    ;(globalThis as { localStorage?: Storage; sessionStorage?: Storage }).localStorage = makeStorage()
    ;(globalThis as { localStorage?: Storage; sessionStorage?: Storage }).sessionStorage = makeStorage()
  })

  it('migrates preparer work from sessionStorage v26 into localStorage v27 for activity log', () => {
    const preparerPayload = {
      reviewedFieldsList: [
        ['ssn-techCircle', { by: 'Sara Chen', at: 'Jun 1 · 2:30 PM' }],
        ['wages-techCircle', { by: 'Sara Chen', at: 'Jun 1 · 2:30 PM' }],
      ],
      verifiedDocsList: [['techCircle', { by: 'Sara Chen', at: 'Jun 1 · 2:30 PM' }]],
      editedFieldsList: [['wages-techCircle', { by: 'Sara Chen', at: 'Jun 1 · 2:31 PM' }]],
      summaryCheckedFieldsList: [['wages', { by: 'Sara Chen', at: 'Jun 1 · 2:32 PM' }]],
    }
    sessionStorage.setItem('protoc2-data-review-state-v26', JSON.stringify(preparerPayload))

    // Simulate reviewer tab load: read session → promote to localStorage v27
    const fromSession = sessionStorage.getItem('protoc2-data-review-state-v26')
    expect(fromSession).toBeTruthy()
    localStorage.setItem(STORAGE_KEY, fromSession!)
    sessionStorage.removeItem('protoc2-data-review-state-v26')

    const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    const reviewedFields = new Map(loaded.reviewedFieldsList)
    const verifiedDocs = new Set(loaded.verifiedDocsList.map(([k]: [string]) => k))
    const verifiedDocsMeta = new Map(loaded.verifiedDocsList)
    const editedFields = new Map(loaded.editedFieldsList)
    const summaryChecked = new Map(loaded.summaryCheckedFieldsList)

    const snapshot = buildHandoffSnapshot('signoff-review', 1, 'Sara Chen', {
      reviewedFields,
      verifiedDocs,
      verifiedDocsMeta,
      editedFields,
      summaryChecked,
      summaryFlagged: new Map(),
      summaryFlagNotes: {},
      notes: [],
      amounts,
    }, { voice: 'reviewer-briefing' })

    const brief = buildSmartReviewBrief({
      snapshot,
      checklist: {
        items: [],
        completeCount: 0,
        totalCount: 0,
        requiredCompleteCount: 0,
        requiredTotal: 0,
        allRequiredComplete: true,
        blockers: [],
      },
      outstandingOpenCount: 0,
      manualChecklistItems: {},
      reviewPass: 1,
      showStrategicChecklist: false,
      isPreparer: false,
    })

    expect(brief.activityLog.find(c => c.id === 'documents-verified')!.entries.length).toBeGreaterThan(0)
    expect(brief.activityLog.find(c => c.id === 'import-flags-cleared')!.entries.length).toBeGreaterThan(0)
    expect(brief.activityLog.find(c => c.id === 'return-summary-reviewed')!.entries.length).toBeGreaterThan(0)
  })
})
