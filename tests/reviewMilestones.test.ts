import { describe, expect, it } from 'vitest'
import {
  REVIEW_MILESTONES,
  deriveMilestoneState,
  formatMilestoneAttribution,
  formatMilestoneAttributionTooltip,
  canSignOffFromMilestones,
} from '../src/data/reviewMilestones'
import { PREPARER_NAME, REVIEWER_NAME } from '../src/hooks/useSyncedReviewState'
import { SEED_AMOUNTS } from '../src/data/liveReturn'

const emptyInputs = {
  verifiedDocs: new Set<string>(),
  reviewerConfirmedDocs: new Set<string>(),
  summaryCheckedFields: new Set<string>(),
  reviewerConfirmedFields: new Set<string>(),
  reviewerConfirmStaleFields: new Set<string>(),
  reviewerSignedOffForms: new Set<string>(),
  verifiedDocsMeta: new Map(),
  reviewerConfirmedDocsMeta: new Map(),
  reviewerSignedOffFormsMeta: new Map(),
  amounts: SEED_AMOUNTS,
  reviewedFields: new Map(),
  completedMilestones: {},
  outstandingOpenCount: 0,
  currentActorName: REVIEWER_NAME,
  reviewPass: 2 as const,
  singlePersonMode: false,
}

describe('REVIEW_MILESTONES catalog', () => {
  it('has 22 representative milestones across 5 phases', () => {
    expect(REVIEW_MILESTONES.length).toBe(22)
    const phases = new Set(REVIEW_MILESTONES.map(m => m.phase))
    expect(phases).toEqual(new Set([1, 2, 3, 4, 5]))
  })

  it('includes all three completion types', () => {
    const types = new Set(REVIEW_MILESTONES.map(m => m.completionType))
    expect(types).toEqual(new Set(['auto', 'linked', 'declaration']))
  })
})

describe('deriveMilestoneState', () => {
  it('marks declaration milestones complete from completedMilestones state', () => {
    const state = deriveMilestoneState({
      ...emptyInputs,
      completedMilestones: {
        'prior-year-carryforwards': {
          by: 'preparer',
          at: 'Jul 29 · 2:30 PM',
          name: PREPARER_NAME,
        },
      },
    })
    const item = state.milestones.find(m => m.id === 'prior-year-carryforwards')
    expect(item?.complete).toBe(true)
    expect(item?.completion?.name).toBe(PREPARER_NAME)
  })

  it('allows reviewer to toggle reviewer-only declarations on Pass 2', () => {
    const state = deriveMilestoneState({
      ...emptyInputs,
      currentActorName: REVIEWER_NAME,
      reviewPass: 2,
    })
    const item = state.milestones.find(m => m.id === 'unreported-income-check')
    expect(item?.canToggle).toBe(true)
    expect(item?.locked).toBe(false)
  })

  it('blocks preparer from toggling reviewer-only declarations on Pass 1', () => {
    const state = deriveMilestoneState({
      ...emptyInputs,
      currentActorName: PREPARER_NAME,
      reviewPass: 1,
    })
    const item = state.milestones.find(m => m.id === 'final-walkthrough')
    expect(item?.canToggle).toBe(false)
  })
})

describe('formatMilestoneAttribution', () => {
  it('uses SC for Sara Chen', () => {
    const label = formatMilestoneAttribution(
      { by: 'preparer', at: 'Jul 29 · 2:30 PM', name: PREPARER_NAME },
    )
    expect(label).toBe('SC · Jul 29')
  })

  it('uses Jordan for Jordan Lee', () => {
    const label = formatMilestoneAttribution(
      { by: 'reviewer', at: 'Jul 29 · 2:30 PM', name: REVIEWER_NAME },
    )
    expect(label).toBe('Jordan · Jul 29')
  })

  it('returns full name tooltip', () => {
    const tooltip = formatMilestoneAttributionTooltip(
      { by: 'preparer', at: 'Jul 29 · 2:30 PM', name: PREPARER_NAME },
    )
    expect(tooltip).toBe('Sara Chen · Jul 29 · 2:30 PM')
  })
})

describe('canSignOffFromMilestones', () => {
  it('requires all required milestones and zero open items', () => {
    const partial = deriveMilestoneState(emptyInputs)
    expect(canSignOffFromMilestones(partial, 0)).toBe(false)

    const allDeclarations = Object.fromEntries(
      REVIEW_MILESTONES.filter(m => m.completionType === 'declaration').map(m => [
        m.id,
        { by: 'reviewer' as const, at: 'Jul 29 · 2:30 PM', name: REVIEWER_NAME },
      ]),
    )
    const full = deriveMilestoneState({
      ...emptyInputs,
      verifiedDocs: new Set([
        'techCircle', 'bingEquipment',
        '1099-div-tokenFinancial', '1099-div-northmarkIndex', '1099-div-beaconDividend',
        '1099-int-unwaverIngFinancial', '1099-int-harborlineCredit', '1099-int-cascadeFederal',
        '1099-r',
      ]),
      reviewerConfirmedDocs: new Set([
        'techCircle', 'bingEquipment',
        '1099-div-tokenFinancial', '1099-div-northmarkIndex', '1099-div-beaconDividend',
        '1099-int-unwaverIngFinancial', '1099-int-harborlineCredit', '1099-int-cascadeFederal',
        '1099-r', '1099-nec',
      ]),
      summaryCheckedFields: new Set(['fedTaxWithheld', 'wages', 'totalIncome']),
      reviewerConfirmedFields: new Set(['fedTaxWithheld', 'wages', 'totalIncome']),
      reviewerSignedOffForms: new Set([
        'return-summary', 'form-1040', 'schedule-1', 'schedule-c', 'schedule-a', 'schedule-d', 'form-8960',
      ]),
      reviewedFields: new Map([
        ['ssn-techCircle', { by: PREPARER_NAME, at: 'Jul 29 · 2:30 PM' }],
        ['wages-techCircle', { by: PREPARER_NAME, at: 'Jul 29 · 2:30 PM' }],
        ['ein-techCircle', { by: PREPARER_NAME, at: 'Jul 29 · 2:30 PM' }],
        ['box12', { by: PREPARER_NAME, at: 'Jul 29 · 2:30 PM' }],
        ['niit-threshold', { by: PREPARER_NAME, at: 'Jul 29 · 2:30 PM' }],
        ['capital-gains-rate', { by: PREPARER_NAME, at: 'Jul 29 · 2:30 PM' }],
      ]),
      completedMilestones: allDeclarations,
    })
    expect(full.allRequiredComplete).toBe(true)
    expect(canSignOffFromMilestones(full, 0)).toBe(true)
  })
})
