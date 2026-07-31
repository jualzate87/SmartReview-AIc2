/**
 * Milestone-based review checklist — flexible single- or dual-person completion.
 * Milestones map to CPA review phases from Phase 1–5 source doc (client setup → final check).
 */
import type { ActivityEntry } from '../hooks/useSyncedReviewState'
import {
  milestoneActorLabel,
  PREPARER_NAME,
  REVIEWER_NAME,
} from '../hooks/useSyncedReviewState'
import { coerceTimestamp, timestampDatePart } from '../lib/coerceTimestamp'
import type { HandoffJump } from './handoffSnapshot'
import { computeLiveReturn, type LiveAmounts } from './liveReturn'
import {
  allRequiredFormsSignedOff,
  REQUIRED_REVIEWER_FORM_SIGNOFFS,
} from '../pages/data-review/outputForms'
import { getPhase2Progress } from '../pages/data-review/phase2FlagSync'
import { countPhase1Remaining } from '../pages/data-review/phase1FieldSync'
import {
  isVerifiedInSet,
  PACKET_VERIFY_DOC_KEYS,
} from './verifiedDocKeys'

export type MilestoneCompletionType = 'auto' | 'linked' | 'declaration'
export type MilestoneActor = 'any' | 'preparer' | 'reviewer'
export type MilestonePhase = 1 | 2 | 3 | 4 | 5

export type MilestoneRole = 'preparer' | 'reviewer'

export interface MilestoneCompletion {
  by: MilestoneRole
  at: string
  name: string
}

export interface ReviewMilestone {
  id: string
  phase: MilestonePhase
  title: string
  description?: string
  completionType: MilestoneCompletionType
  eligibleActor: MilestoneActor
  linkedKey?: string
  jumpTarget?: HandoffJump
  jumpLabel?: string
  required: boolean
}

export interface ResolvedMilestone extends ReviewMilestone {
  complete: boolean
  completion?: MilestoneCompletion
  /** Declaration items only — current actor may toggle */
  canToggle: boolean
  locked: boolean
}

export type MilestoneState = {
  milestones: ResolvedMilestone[]
  completeCount: number
  totalCount: number
  requiredCompleteCount: number
  requiredTotal: number
  allRequiredComplete: boolean
  blockers: string[]
}

export type MilestoneInputs = {
  verifiedDocs: Set<string>
  reviewerConfirmedDocs: Set<string>
  summaryCheckedFields: Set<string>
  reviewerConfirmedFields: Set<string>
  reviewerConfirmStaleFields: Set<string>
  reviewerSignedOffForms: Set<string>
  verifiedDocsMeta: Map<string, ActivityEntry>
  reviewerConfirmedDocsMeta: Map<string, ActivityEntry>
  reviewerSignedOffFormsMeta: Map<string, ActivityEntry>
  amounts: LiveAmounts
  reviewedFields: Map<string, ActivityEntry>
  /** Manual declaration completions keyed by milestone id */
  completedMilestones: Record<string, MilestoneCompletion>
  outstandingOpenCount: number
  currentActorName: string
  reviewPass: 1 | 2
  /** When true, one CPA did both passes (attribution labels still shown per milestone) */
  singlePersonMode: boolean
}

export const MILESTONE_PHASE_TITLES: Record<MilestonePhase, string> = {
  1: 'Phase 1: Client information & file setup',
  2: 'Phase 2: Income verification (tie-outs)',
  3: 'Phase 3: Deductions & adjustments',
  4: 'Phase 4: Credits & tax calculations',
  5: 'Phase 5: Variance analysis & final check',
}

export const MILESTONE_PHASE_DESCRIPTIONS: Record<MilestonePhase, string> = {
  1: 'Confirm filing status, demographics, carryforwards, and client setup before tie-outs.',
  2: 'Line up W-2 and 1099 source documents against software input.',
  3: 'Validate Schedule 1, A, and C deductions are documented and reasonable.',
  4: 'Verify withholding, NIIT, and credit positions on this return.',
  5: 'YoY variance, AI diagnostics, reviewer confirmations, and sign-off readiness.',
}

/** Representative subset for Jessica Drake 1040 — sourced from CPA milestone doc. */
export const REVIEW_MILESTONES: ReviewMilestone[] = [
  // Phase 1
  {
    id: 'filing-status-demographics',
    phase: 1,
    title: 'Filing status & demographics verified',
    description: 'Filing status, SSN, address match source documents.',
    completionType: 'linked',
    eligibleActor: 'any',
    linkedKey: 'import-flags-cleared',
    jumpTarget: { type: 'outputForm', formId: '1040' },
    jumpLabel: 'Open Form 1040',
    required: true,
  },
  {
    id: 'prior-year-carryforwards',
    phase: 1,
    title: 'Prior-year carryforwards checked',
    description: 'Capital loss, passive activity, and charitable carryovers rolled correctly.',
    completionType: 'declaration',
    eligibleActor: 'preparer',
    required: true,
  },
  {
    id: 'bank-direct-deposit',
    phase: 1,
    title: 'Bank information verified',
    description: 'Routing and account numbers confirmed for refund or payment.',
    completionType: 'declaration',
    eligibleActor: 'any',
    required: true,
  },
  {
    id: 'engagement-letter',
    phase: 1,
    title: 'Engagement letter on file',
    description: 'Client representation agreement signed and attached.',
    completionType: 'declaration',
    eligibleActor: 'preparer',
    required: false,
  },
  // Phase 2
  {
    id: 'w2-tie-out',
    phase: 2,
    title: 'W-2 wages & withholding tie out',
    description: 'All W-2 boxes match source PDFs exactly.',
    completionType: 'linked',
    eligibleActor: 'preparer',
    linkedKey: 'doc-w2-verified',
    jumpTarget: { type: 'doc', docId: 'techCircle' },
    jumpLabel: 'Open W-2',
    required: true,
  },
  {
    id: '1099-div-tie-out',
    phase: 2,
    title: '1099-DIV investment income tie out',
    description: 'Dividends and qualified dividends match payer statements.',
    completionType: 'linked',
    eligibleActor: 'preparer',
    linkedKey: 'doc-1099div-verified',
    jumpTarget: { type: 'doc', docId: '1099-div-tokenFinancial' },
    jumpLabel: 'Open 1099-DIV',
    required: true,
  },
  {
    id: '1099-int-tie-out',
    phase: 2,
    title: '1099-INT interest income tie out',
    description: 'Taxable interest matches payer statements.',
    completionType: 'linked',
    eligibleActor: 'preparer',
    linkedKey: 'doc-1099int-verified',
    jumpTarget: { type: 'doc', docId: '1099-int-unwaverIngFinancial' },
    jumpLabel: 'Open 1099-INT',
    required: true,
  },
  {
    id: '1099-r-tie-out',
    phase: 2,
    title: '1099-R retirement distribution tie out',
    description: 'Gross distribution and taxable amount match source.',
    completionType: 'linked',
    eligibleActor: 'preparer',
    linkedKey: 'doc-1099r-verified',
    jumpTarget: { type: 'doc', docId: '1099-r' },
    jumpLabel: 'Open 1099-R',
    required: true,
  },
  {
    id: 'unreported-income-check',
    phase: 2,
    title: 'Unreported income sanity check',
    description: 'Income reported aligns with client profession and lifestyle.',
    completionType: 'declaration',
    eligibleActor: 'reviewer',
    required: true,
  },
  {
    id: 'digital-assets-foreign',
    phase: 2,
    title: 'Digital assets & foreign account responses',
    description: 'Crypto question and FBAR / Form 8938 thresholds addressed.',
    completionType: 'declaration',
    eligibleActor: 'any',
    required: false,
  },
  // Phase 3
  {
    id: 'schedule-1-adjustments',
    phase: 3,
    title: 'Schedule 1 above-the-line adjustments',
    description: 'HSA, SE tax, and other adjustments reviewed.',
    completionType: 'linked',
    eligibleActor: 'any',
    linkedKey: 'form-signoff-schedule-1',
    jumpTarget: { type: 'outputForm', formId: 'sch1' },
    jumpLabel: 'Open Schedule 1',
    required: true,
  },
  {
    id: 'schedule-a-itemized',
    phase: 3,
    title: 'Schedule A itemized deductions',
    description: 'SALT cap, mortgage interest, and charitable donations verified.',
    completionType: 'linked',
    eligibleActor: 'reviewer',
    linkedKey: 'form-signoff-schedule-a',
    jumpTarget: { type: 'outputForm', formId: 'schA' },
    jumpLabel: 'Open Schedule A',
    required: true,
  },
  {
    id: 'schedule-c-business',
    phase: 3,
    title: 'Schedule C business expenses',
    description: 'Ordinary and necessary test; home office and mileage documented.',
    completionType: 'linked',
    eligibleActor: 'reviewer',
    linkedKey: 'form-signoff-schedule-c',
    jumpTarget: { type: 'outputForm', formId: 'schC' },
    jumpLabel: 'Open Schedule C',
    required: true,
  },
  {
    id: 'deductions-optimization',
    phase: 3,
    title: 'Deductions & optimization attestation',
    description: 'Planning positions and deduction mix make sense for this client.',
    completionType: 'declaration',
    eligibleActor: 'reviewer',
    jumpTarget: { type: 'outputForm', formId: 'schA' },
    jumpLabel: 'Open Schedule A',
    required: true,
  },
  // Phase 4
  {
    id: 'withholding-estimated',
    phase: 4,
    title: 'Withholding & estimated payments',
    description: 'Federal withholding and estimated payments tie to transcripts.',
    completionType: 'linked',
    eligibleActor: 'any',
    linkedKey: 'summary-withholding-checked',
    jumpTarget: { type: 'field', field: 'fedTaxWithheld' },
    jumpLabel: 'View withholding',
    required: true,
  },
  {
    id: 'niit-form-8960',
    phase: 4,
    title: 'NIIT — Form 8960 reviewed',
    description: 'Net investment income tax calculation confirmed.',
    completionType: 'linked',
    eligibleActor: 'reviewer',
    linkedKey: 'form-signoff-form-8960',
    jumpTarget: { type: 'outputForm', formId: 'f8960' },
    jumpLabel: 'Open Form 8960',
    required: true,
  },
  {
    id: 'credits-eligibility',
    phase: 4,
    title: 'Credits eligibility confirmed',
    description: 'Child Tax Credit and other credits verified for this return.',
    completionType: 'declaration',
    eligibleActor: 'reviewer',
    required: false,
  },
  // Phase 5
  {
    id: 'yoy-variance',
    phase: 5,
    title: 'Prior-year variance walkthrough',
    description: 'Material YoY changes in AGI, income sources, and tax liability explained.',
    completionType: 'declaration',
    eligibleActor: 'any',
    jumpTarget: { type: 'field', field: 'wages' },
    jumpLabel: 'View YoY totals',
    required: false,
  },
  {
    id: 'diagnostics-cleared',
    phase: 5,
    title: 'AI diagnostics cleared',
    description: 'All software diagnostics and critical warnings resolved.',
    completionType: 'auto',
    eligibleActor: 'any',
    linkedKey: 'diagnostics-cleared',
    jumpTarget: { type: 'diagnostic', issueKey: 'niit-threshold' },
    jumpLabel: 'Open AI review',
    required: true,
  },
  {
    id: 'source-docs-reviewer-confirmed',
    phase: 5,
    title: 'Source documents confirmed (Rev)',
    description: 'Every packet document confirmed in the Rev column.',
    completionType: 'linked',
    eligibleActor: 'reviewer',
    linkedKey: 'docs-reviewer-confirmed',
    jumpTarget: { type: 'doc', docId: 'techCircle' },
    jumpLabel: 'View documents',
    required: true,
  },
  {
    id: 'summary-rev-confirmed',
    phase: 5,
    title: '1040 summary totals confirmed (Rev)',
    description: 'Executive summary lines attested in the Rev column.',
    completionType: 'linked',
    eligibleActor: 'reviewer',
    linkedKey: 'summary-rev-confirmed',
    jumpTarget: { type: 'field', field: 'totalIncome' },
    jumpLabel: 'View 1040 totals',
    required: true,
  },
  {
    id: 'reviewed-notes',
    phase: 5,
    title: 'Preparer notes reviewed',
    description: 'Open preparer notes resolved or acknowledged.',
    completionType: 'declaration',
    eligibleActor: 'reviewer',
    jumpTarget: { type: 'notesPane' },
    jumpLabel: 'Open notes',
    required: true,
  },
  {
    id: 'final-walkthrough',
    phase: 5,
    title: 'Executive 1040 totals walkthrough',
    description: 'Final walk of wages, total income, tax liability, and refund or balance due.',
    completionType: 'declaration',
    eligibleActor: 'reviewer',
    jumpTarget: { type: 'field', field: 'totalIncome' },
    jumpLabel: 'View summary',
    required: true,
  },
  {
    id: 'forms-signed-off',
    phase: 5,
    title: 'All required output forms signed off',
    description: 'Return Summary, Form 1040, and schedules confirmed in form headers.',
    completionType: 'linked',
    eligibleActor: 'reviewer',
    linkedKey: 'forms-all-signed-off',
    jumpTarget: { type: 'field', field: 'wages' },
    jumpLabel: 'Open outputs',
    required: true,
  },
]

function actorRole(name: string): MilestoneRole {
  return name === REVIEWER_NAME ? 'reviewer' : 'preparer'
}

function sanitizeMilestoneCompletion(
  raw: MilestoneCompletion | undefined,
): MilestoneCompletion | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name : PREPARER_NAME
  const by: MilestoneRole =
    raw.by === 'reviewer' || raw.by === 'preparer'
      ? raw.by
      : name === REVIEWER_NAME
        ? 'reviewer'
        : 'preparer'
  return { by, name, at: coerceTimestamp(raw.at) }
}

function toCompletion(entry: ActivityEntry): MilestoneCompletion {
  return sanitizeMilestoneCompletion({
    by: actorRole(entry.by),
    at: coerceTimestamp(entry.at),
    name: entry.by,
  })!
}

function allDocsReviewerConfirmed(docs: Set<string>): boolean {
  return PACKET_VERIFY_DOC_KEYS.every(d => isVerifiedInSet(docs, d))
}

function w2DocsVerified(docs: Set<string>): boolean {
  return ['techCircle', 'bingEquipment'].every(d => isVerifiedInSet(docs, d))
}

function divDocsVerified(docs: Set<string>): boolean {
  return ['1099-div-tokenFinancial', '1099-div-northmarkIndex', '1099-div-beaconDividend']
    .every(d => isVerifiedInSet(docs, d))
}

function intDocsVerified(docs: Set<string>): boolean {
  return ['1099-int-unwaverIngFinancial', '1099-int-harborlineCredit', '1099-int-cascadeFederal']
    .every(d => isVerifiedInSet(docs, d))
}

function latestEntry(entries: ActivityEntry[]): ActivityEntry | undefined {
  if (entries.length === 0) return undefined
  return entries[entries.length - 1]
}

function resolveLinkedCompletion(
  linkedKey: string | undefined,
  input: MilestoneInputs,
): { complete: boolean; completion?: MilestoneCompletion } {
  const live = computeLiveReturn(input.amounts)
  const p2 = getPhase2Progress({
    reviewedFields: input.reviewedFields,
    live,
    amounts: input.amounts,
  })
  const diagsOpen = p2.activeKeys.filter(k => !input.reviewedFields.has(k))

  const needsConfirmSummary = [...input.summaryCheckedFields].filter(
    f => !input.reviewerConfirmedFields.has(f),
  )
  const summaryRevComplete =
    needsConfirmSummary.length === 0 && input.reviewerConfirmStaleFields.size === 0

  switch (linkedKey) {
    case 'import-flags-cleared': {
      const complete = countPhase1Remaining(input.reviewedFields) === 0
      const entries = [...input.reviewedFields.values()]
      const entry = latestEntry(entries)
      return { complete, completion: entry ? toCompletion(entry) : undefined }
    }
    case 'doc-w2-verified': {
      const complete = w2DocsVerified(input.verifiedDocs)
      const entries = PACKET_VERIFY_DOC_KEYS
        .filter(d => d === 'techCircle' || d === 'bingEquipment')
        .map(d => input.verifiedDocsMeta.get(d))
        .filter((e): e is ActivityEntry => !!e)
      const entry = latestEntry(entries)
      return { complete, completion: entry ? toCompletion(entry) : undefined }
    }
    case 'doc-1099div-verified': {
      const complete = divDocsVerified(input.verifiedDocs)
      const entries = [...input.verifiedDocsMeta.entries()]
        .filter(([k]) => k.startsWith('1099-div-'))
        .map(([, e]) => e)
      const entry = latestEntry(entries)
      return { complete, completion: entry ? toCompletion(entry) : undefined }
    }
    case 'doc-1099int-verified': {
      const complete = intDocsVerified(input.verifiedDocs)
      const entries = [...input.verifiedDocsMeta.entries()]
        .filter(([k]) => k.startsWith('1099-int-'))
        .map(([, e]) => e)
      const entry = latestEntry(entries)
      return { complete, completion: entry ? toCompletion(entry) : undefined }
    }
    case 'doc-1099r-verified': {
      const complete = isVerifiedInSet(input.verifiedDocs, '1099-r')
      const entry = input.verifiedDocsMeta.get('1099-r')
      return { complete, completion: entry ? toCompletion(entry) : undefined }
    }
    case 'form-signoff-schedule-1':
    case 'form-signoff-schedule-a':
    case 'form-signoff-schedule-c':
    case 'form-signoff-form-8960': {
      const formKey = linkedKey.replace('form-signoff-', '')
      const complete = input.reviewerSignedOffForms.has(formKey)
      const entry = input.reviewerSignedOffFormsMeta.get(formKey)
      return { complete, completion: entry ? toCompletion(entry) : undefined }
    }
    case 'summary-withholding-checked': {
      const complete = input.summaryCheckedFields.has('fedTaxWithheld')
      return { complete, completion: undefined }
    }
    case 'diagnostics-cleared': {
      const complete = diagsOpen.length === 0
      const entries = p2.activeKeys
        .filter(k => input.reviewedFields.has(k))
        .map(k => input.reviewedFields.get(k)!)
      const entry = latestEntry(entries)
      return { complete, completion: entry ? toCompletion(entry) : undefined }
    }
    case 'docs-reviewer-confirmed': {
      const complete = allDocsReviewerConfirmed(input.reviewerConfirmedDocs)
      const entries = PACKET_VERIFY_DOC_KEYS
        .map(d => input.reviewerConfirmedDocsMeta.get(d))
        .filter((e): e is ActivityEntry => !!e)
      const entry = latestEntry(entries)
      return { complete, completion: entry ? toCompletion(entry) : undefined }
    }
    case 'summary-rev-confirmed': {
      const complete = summaryRevComplete && input.summaryCheckedFields.size > 0
      const entries = [...input.reviewerConfirmedFields.values()]
      const entry = latestEntry(entries)
      return { complete, completion: entry ? toCompletion(entry) : undefined }
    }
    case 'forms-all-signed-off': {
      const complete = allRequiredFormsSignedOff(input.reviewerSignedOffForms)
      const entries = REQUIRED_REVIEWER_FORM_SIGNOFFS
        .map(k => input.reviewerSignedOffFormsMeta.get(k))
        .filter((e): e is ActivityEntry => !!e)
      const entry = latestEntry(entries)
      return { complete, completion: entry ? toCompletion(entry) : undefined }
    }
    default:
      return { complete: false }
  }
}

function actorCanCompleteEligible(
  eligible: MilestoneActor,
  currentName: string,
  reviewPass: 1 | 2,
): boolean {
  const role = actorRole(currentName)
  if (eligible === 'any') return true
  if (eligible === 'preparer') return role === 'preparer' || reviewPass === 1
  if (eligible === 'reviewer') return role === 'reviewer' && reviewPass === 2
  return false
}

export function formatMilestoneAttribution(
  completion: MilestoneCompletion | undefined,
): string | undefined {
  const safe = sanitizeMilestoneCompletion(completion)
  if (!safe) return undefined
  const datePart = timestampDatePart(safe.at)
  return `${milestoneActorLabel(safe.name)} · ${datePart}`
}

/** Full name + timestamp for tooltip / audit detail */
export function formatMilestoneAttributionTooltip(
  completion: MilestoneCompletion | undefined,
): string | undefined {
  const safe = sanitizeMilestoneCompletion(completion)
  if (!safe) return undefined
  return `${safe.name} · ${coerceTimestamp(safe.at)}`
}

export function deriveMilestoneState(input: MilestoneInputs): MilestoneState {
  const resolved: ResolvedMilestone[] = REVIEW_MILESTONES.map(milestone => {
    let complete = false
    let completion: MilestoneCompletion | undefined

    if (milestone.completionType === 'declaration') {
      completion = sanitizeMilestoneCompletion(input.completedMilestones[milestone.id])
      complete = !!completion
    } else if (milestone.completionType === 'auto' || milestone.completionType === 'linked') {
      const linked = resolveLinkedCompletion(milestone.linkedKey, input)
      complete = linked.complete
      completion = sanitizeMilestoneCompletion(linked.completion)
    }

    const locked = milestone.completionType !== 'declaration'
    const canToggle =
      !locked &&
      actorCanCompleteEligible(milestone.eligibleActor, input.currentActorName, input.reviewPass)

    return {
      ...milestone,
      complete,
      completion,
      locked,
      canToggle,
    }
  })

  const requiredItems = resolved.filter(m => m.required)
  const requiredCompleteCount = requiredItems.filter(m => m.complete).length
  const completeCount = resolved.filter(m => m.complete).length

  const blockers: string[] = []
  if (input.outstandingOpenCount > 0) {
    blockers.push(
      input.outstandingOpenCount === 1
        ? '1 open item still needs attention'
        : `${input.outstandingOpenCount} open items still need attention`,
    )
  }
  for (const item of requiredItems) {
    if (!item.complete) blockers.push(item.title)
  }

  return {
    milestones: resolved,
    completeCount,
    totalCount: resolved.length,
    requiredCompleteCount,
    requiredTotal: requiredItems.length,
    allRequiredComplete: requiredCompleteCount === requiredItems.length,
    blockers,
  }
}

export function canSignOffFromMilestones(
  state: MilestoneState,
  outstandingOpenCount: number,
): boolean {
  return outstandingOpenCount === 0 && state.allRequiredComplete
}

export function signOffBlockerFromMilestones(
  state: MilestoneState,
  outstandingOpenCount: number,
): string | null {
  if (canSignOffFromMilestones(state, outstandingOpenCount)) return null
  if (state.blockers.length === 1) {
    return `${state.blockers[0]} before you sign off.`
  }
  if (state.blockers.length === 2) {
    return `${state.blockers[0]} and ${state.blockers[1].toLowerCase()} before you sign off.`
  }
  if (state.blockers.length > 2) {
    return `${state.blockers.slice(0, 2).join(', ')}, and ${state.blockers.length - 2} more before you sign off.`
  }
  return 'Complete the milestone checklist before you sign off.'
}

/** Count milestones completed by each role — for dual-person brief bullets */
export function countMilestonesByRole(state: MilestoneState): {
  preparer: number
  reviewer: number
  total: number
  complete: number
} {
  let preparer = 0
  let reviewer = 0
  for (const m of state.milestones) {
    if (!m.complete || !m.completion) continue
    if (m.completion.by === 'reviewer') reviewer += 1
    else preparer += 1
  }
  return {
    preparer,
    reviewer,
    total: state.totalCount,
    complete: state.completeCount,
  }
}
