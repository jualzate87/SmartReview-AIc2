import { describe, expect, it } from 'vitest'
import { buildHandoffSnapshot } from '../src/data/handoffSnapshot'
import { computeLiveReturn, SEED_AMOUNTS } from '../src/data/liveReturn'
import type { ActivityEntry } from '../src/hooks/useSyncedReviewState'

const amounts = computeLiveReturn(SEED_AMOUNTS)

function meta(by = 'Sara Chen'): ActivityEntry {
  return { by, at: 'Jun 1 · 2:30 PM' }
}

function unverifiedDocIds(snapshot: ReturnType<typeof buildHandoffSnapshot>): string[] {
  const section = snapshot.sections.find(s => s.id === 'needsAttention')
  const unverified = section?.groups?.find(g => g.id === 'unverified-docs')
  return unverified?.items.map(i => (i.jump?.type === 'doc' ? i.jump.docId : '')).filter(Boolean) ?? []
}

function doneDocIds(snapshot: ReturnType<typeof buildHandoffSnapshot>): string[] {
  const section = snapshot.sections.find(s => s.id === 'preparerDone')
  const verified = section?.groups?.find(g => g.id === 'verified-docs')
  return verified?.items.map(i => (i.jump?.type === 'doc' ? i.jump.docId : '')).filter(Boolean) ?? []
}

describe('buildHandoffSnapshot document consistency', () => {
  it('does not list preparer-verified docs as unverified in reviewer briefing', () => {
    const snapshot = buildHandoffSnapshot(
      'signoff-review',
      1,
      'Sara Chen',
      {
        reviewedFields: new Map(),
        verifiedDocs: new Set(['techCircle', '1099-div-tokenFinancial']),
        verifiedDocsMeta: new Map([
          ['techCircle', meta()],
          ['1099-div-tokenFinancial', meta()],
        ]),
        reviewerConfirmedDocs: new Set(),
        editedFields: new Map(),
        summaryChecked: new Map(),
        summaryFlagged: new Map(),
        summaryFlagNotes: {},
        notes: [],
        amounts,
      },
      { voice: 'reviewer-briefing' },
    )

    const unverifiedGroup = snapshot.sections
      .find(s => s.id === 'needsAttention')
      ?.groups?.find(g => g.id === 'unverified-docs')

    expect(unverifiedGroup?.items.some(i => i.label.includes('Tech Circle'))).toBe(false)
    expect(unverifiedGroup?.items.some(i => i.label.includes('Token Financial'))).toBe(false)

    const awaitingGroup = snapshot.sections
      .find(s => s.id === 'needsAttention')
      ?.groups?.find(g => g.id === 'docs-needs-confirmation')

    expect(awaitingGroup?.count).toBe(2)
    expect(awaitingGroup?.items.some(i => i.label.includes('Tech Circle'))).toBe(true)
  })

  it('never puts the same doc in unverified and preparer verified done lists', () => {
    const snapshot = buildHandoffSnapshot(
      'signoff-review',
      1,
      'Sara Chen',
      {
        reviewedFields: new Map([['ssn-techCircle', meta()]]),
        verifiedDocs: new Set(['techCircle', '1099-r']),
        verifiedDocsMeta: new Map([
          ['techCircle', meta()],
          ['1099-r', meta()],
        ]),
        reviewerConfirmedDocs: new Set(),
        editedFields: new Map(),
        summaryChecked: new Map(),
        summaryFlagged: new Map(),
        summaryFlagNotes: {},
        notes: [],
        amounts,
      },
      { voice: 'reviewer-briefing' },
    )

    const unverified = new Set(unverifiedDocIds(snapshot))
    const done = new Set(doneDocIds(snapshot))
    for (const docId of done) {
      expect(unverified.has(docId)).toBe(false)
    }

    const awaitingGroup = snapshot.sections
      .find(s => s.id === 'needsAttention')
      ?.groups?.find(g => g.id === 'docs-needs-confirmation')
    expect(awaitingGroup?.items.some(i => i.label.includes('Tech Circle'))).toBe(true)
  })

  it('resolves legacy verified keys for unverified vs done lists', () => {
    const snapshot = buildHandoffSnapshot(
      'signoff-review',
      1,
      'Sara Chen',
      {
        reviewedFields: new Map(),
        verifiedDocs: new Set(['1099-div-token', 'w2-techCircle']),
        verifiedDocsMeta: new Map([
          ['1099-div-token', meta()],
          ['w2-techCircle', meta()],
        ]),
        reviewerConfirmedDocs: new Set(),
        editedFields: new Map(),
        summaryChecked: new Map(),
        summaryFlagged: new Map(),
        summaryFlagNotes: {},
        notes: [],
        amounts,
      },
      { voice: 'self' },
    )

    const unverified = snapshot.sections
      .find(s => s.id === 'needsAttention')
      ?.groups?.find(g => g.id === 'unverified-docs')

    expect(unverified?.items.some(i => i.label.includes('Tech Circle'))).toBe(false)
    expect(unverified?.items.some(i => i.label.includes('Token Financial'))).toBe(false)

    const doneDocs = doneDocIds(snapshot)
    expect(doneDocs).toContain('techCircle')
    expect(doneDocs).toContain('1099-div-tokenFinancial')
  })

  it('exposes preparer done groups with human labels and jump links', () => {
    const snapshot = buildHandoffSnapshot(
      'signoff-review',
      1,
      'Sara Chen',
      {
        reviewedFields: new Map(),
        verifiedDocs: new Set(['techCircle']),
        verifiedDocsMeta: new Map([['techCircle', meta()]]),
        reviewerConfirmedDocs: new Set(),
        editedFields: new Map(),
        summaryChecked: new Map(),
        summaryFlagged: new Map(),
        summaryFlagNotes: {},
        notes: [],
        amounts,
      },
      { voice: 'reviewer-briefing' },
    )

    const doneSection = snapshot.sections.find(s => s.id === 'preparerDone')
    expect(doneSection?.title).toBe('What Sara cleared')
    const verifiedGroup = doneSection?.groups?.find(g => g.id === 'verified-docs')
    expect(verifiedGroup?.items[0]?.label).toBe('W-2 · Tech Circle')
    expect(verifiedGroup?.items[0]?.jump?.type).toBe('doc')
    expect(verifiedGroup?.items[0]?.jumpLabel).toBe('Open document')
  })
})
