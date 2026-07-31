/**
 * Process-level review checklist for Phase 2 sign-off attestation.
 * Distinct from granular open items in handoffSnapshot.
 * Items here are reviewer actions only — preparer work lives in the activity log.
 */
import type { ActivityEntry } from '../hooks/useSyncedReviewState'
import { computeLiveReturn, type LiveAmounts } from './liveReturn'
import {
  allRequiredFormsSignedOff,
  REQUIRED_REVIEWER_FORM_SIGNOFFS,
} from '../pages/data-review/outputForms'
import { getPhase2Progress } from '../pages/data-review/phase2FlagSync'
import type { HandoffJump } from './handoffSnapshot'
import {
  isVerifiedInSet,
  PACKET_VERIFY_DOC_KEYS,
} from './verifiedDocKeys'

/** Source documents expected on a typical Jessica Drake 1040 return (verify-doc keys). */
export const EXPECTED_SOURCE_DOCS = PACKET_VERIFY_DOC_KEYS

export type ManualChecklistId =
  | 'final-walkthrough'
  | 'yoy-variances'
  | 'law-compliance'
  | 'deductions-optimization'
  | 'reviewed-notes'

export type ReviewChecklistItemId =
  | 'source-docs'
  | 'reviewed-outputs'
  | 'reviewed-notes'
  | 'law-compliance'
  | 'deductions-optimization'
  | 'summary-lines'
  | ManualChecklistId
  | `form-signoff-${string}`

export type ReviewChecklistItem = {
  id: ReviewChecklistItemId
  label: string
  description?: string
  kind: 'auto' | 'manual'
  required: boolean
  complete: boolean
  jump?: HandoffJump
  jumpLabel?: string
}

export type ReviewChecklistState = {
  items: ReviewChecklistItem[]
  completeCount: number
  totalCount: number
  requiredCompleteCount: number
  requiredTotal: number
  allRequiredComplete: boolean
  blockers: string[]
}

export type ReviewChecklistInputs = {
  verifiedDocs: Set<string>
  reviewerConfirmedDocs: Set<string>
  summaryCheckedFields: Set<string>
  reviewerConfirmedFields: Set<string>
  reviewerConfirmStaleFields: Set<string>
  reviewerSignedOffForms: Set<string>
  amounts: LiveAmounts
  manualChecklistItems: Record<string, boolean>
  outstandingOpenCount: number
  reviewedFields: Map<string, ActivityEntry>
}

const FORM_SIGNOFF_LABELS: Record<string, { label: string; jump: HandoffJump; jumpLabel: string }> = {
  'return-summary': { label: 'Return Summary', jump: { type: 'field', field: 'wages' }, jumpLabel: 'Open summary' },
  'form-1040': { label: 'Form 1040', jump: { type: 'outputForm', formId: '1040' }, jumpLabel: 'Open Form 1040' },
  'schedule-1': { label: 'Schedule 1', jump: { type: 'outputForm', formId: 'sch1' }, jumpLabel: 'Open Schedule 1' },
  'schedule-c': { label: 'Schedule C', jump: { type: 'outputForm', formId: 'schC' }, jumpLabel: 'Open Schedule C' },
  'schedule-a': { label: 'Schedule A', jump: { type: 'outputForm', formId: 'schA' }, jumpLabel: 'Open Schedule A' },
  'schedule-d': { label: 'Schedule D', jump: { type: 'outputForm', formId: 'schD' }, jumpLabel: 'Open Schedule D' },
  'form-8960': { label: 'Form 8960', jump: { type: 'outputForm', formId: 'f8960' }, jumpLabel: 'Open Form 8960' },
}

export function deriveReviewChecklist(input: ReviewChecklistInputs): ReviewChecklistState {
  const live = computeLiveReturn(input.amounts)
  const p2 = getPhase2Progress({
    reviewedFields: input.reviewedFields,
    live,
    amounts: input.amounts,
  })
  const diagsOpen = p2.activeKeys.filter(k => !input.reviewedFields.has(k))
  const hasActiveDiags = p2.activeKeys.length > 0

  const docsNeedingConfirm = EXPECTED_SOURCE_DOCS.filter(
    d => isVerifiedInSet(input.verifiedDocs, d) && !isVerifiedInSet(input.reviewerConfirmedDocs, d),
  )
  const docsNotVerified = EXPECTED_SOURCE_DOCS.filter(
    d => !isVerifiedInSet(input.verifiedDocs, d),
  )
  const sourceDocsComplete =
    docsNeedingConfirm.length === 0 && docsNotVerified.length === 0

  const needsConfirmSummary = [...input.summaryCheckedFields].filter(
    f => !input.reviewerConfirmedFields.has(f),
  )
  const summaryIncomplete = needsConfirmSummary.length > 0 || input.reviewerConfirmStaleFields.size > 0
  const summaryComplete = !summaryIncomplete

  const outputsComplete = allRequiredFormsSignedOff(input.reviewerSignedOffForms)

  const firstDocGap = docsNeedingConfirm[0] ?? docsNotVerified[0]
  const firstSummaryGap =
    input.reviewerConfirmStaleFields.size > 0
      ? [...input.reviewerConfirmStaleFields][0]
      : needsConfirmSummary[0]
  const firstDiag = diagsOpen[0]
  const firstUnsignedForm = REQUIRED_REVIEWER_FORM_SIGNOFFS.find(
    k => !input.reviewerSignedOffForms.has(k),
  )

  const manual = input.manualChecklistItems

  const lawComplianceManual = !hasActiveDiags
  const lawComplianceComplete = lawComplianceManual
    ? !!manual['law-compliance']
    : diagsOpen.length === 0

  const unconfirmedDocCount = docsNeedingConfirm.length + docsNotVerified.length

  const formSignoffItems: ReviewChecklistItem[] = REQUIRED_REVIEWER_FORM_SIGNOFFS.map(key => {
    const meta = FORM_SIGNOFF_LABELS[key] ?? { label: key, jump: { type: 'field' as const, field: 'wages' }, jumpLabel: 'Open form' }
    return {
      id: `form-signoff-${key}` as ReviewChecklistItemId,
      label: `Confirm ${meta.label} review complete`,
      description: input.reviewerSignedOffForms.has(key)
        ? 'You signed off this output form.'
        : `Open ${meta.label}, walk key lines, then click Confirm in the form header.`,
      kind: 'auto',
      required: true,
      complete: input.reviewerSignedOffForms.has(key),
      jump: meta.jump,
      jumpLabel: meta.jumpLabel,
    }
  })

  const items: ReviewChecklistItem[] = [
    {
      id: 'source-docs',
      label: 'Confirm all source documents',
      description: sourceDocsComplete
        ? 'Every packet document is confirmed for sign-off.'
        : docsNeedingConfirm.length
          ? `${docsNeedingConfirm.length} document${docsNeedingConfirm.length === 1 ? '' : 's'} need${docsNeedingConfirm.length === 1 ? 's' : ''} your confirmation in the Rev column.`
          : `${docsNotVerified.length} document${docsNotVerified.length === 1 ? '' : 's'} still need verification.`,
      kind: 'auto',
      required: true,
      complete: sourceDocsComplete,
      jump: firstDocGap ? { type: 'doc', docId: firstDocGap } : undefined,
      jumpLabel: unconfirmedDocCount
        ? `View ${unconfirmedDocCount} unconfirmed document${unconfirmedDocCount === 1 ? '' : 's'}`
        : 'View documents',
    },
    {
      id: 'law-compliance',
      label: 'Attest tax law & AI diagnostics review',
      description: lawComplianceManual
        ? 'No AI diagnostics on this return — attest compliance review manually.'
        : diagsOpen.length === 0
          ? 'All active AI diagnostics reviewed — attest your compliance check.'
          : `${diagsOpen.length} diagnostic${diagsOpen.length === 1 ? '' : 's'} still open — review before attesting.`,
      kind: lawComplianceManual ? 'manual' : 'auto',
      required: true,
      complete: lawComplianceComplete,
      jump: firstDiag ? { type: 'diagnostic', issueKey: firstDiag } : undefined,
      jumpLabel: 'Open AI review',
    },
    {
      id: 'deductions-optimization',
      label: 'Attest deductions & optimization review',
      description: 'Confirm Schedule A / C deductions and planning positions make sense for this client.',
      kind: 'manual',
      required: true,
      complete: !!manual['deductions-optimization'],
      jump: { type: 'outputForm', formId: 'schA' },
      jumpLabel: 'Open Schedule A',
    },
    ...formSignoffItems,
    {
      id: 'reviewed-outputs',
      label: 'All required output forms signed off',
      description: outputsComplete
        ? 'Return Summary, Form 1040, and all schedules are signed off.'
        : firstUnsignedForm
          ? `${REQUIRED_REVIEWER_FORM_SIGNOFFS.filter(k => !input.reviewerSignedOffForms.has(k)).length} form${REQUIRED_REVIEWER_FORM_SIGNOFFS.filter(k => !input.reviewerSignedOffForms.has(k)).length === 1 ? '' : 's'} still need your sign-off.`
          : 'Confirm each output form using the header control.',
      kind: 'auto',
      required: true,
      complete: outputsComplete,
      jump: firstUnsignedForm && FORM_SIGNOFF_LABELS[firstUnsignedForm]
        ? FORM_SIGNOFF_LABELS[firstUnsignedForm].jump
        : { type: 'field', field: 'wages' },
      jumpLabel: firstUnsignedForm && FORM_SIGNOFF_LABELS[firstUnsignedForm]
        ? FORM_SIGNOFF_LABELS[firstUnsignedForm].jumpLabel
        : 'Open outputs',
    },
    {
      id: 'summary-lines',
      label: 'Confirm 1040 summary totals (Rev column)',
      description: summaryComplete
        ? 'Executive summary totals confirmed for sign-off.'
        : input.reviewerConfirmStaleFields.size > 0
          ? `${input.reviewerConfirmStaleFields.size} line${input.reviewerConfirmStaleFields.size === 1 ? '' : 's'} edited since your last confirm — check Rev column again.`
          : `${needsConfirmSummary.length} summary line${needsConfirmSummary.length === 1 ? '' : 's'} awaiting your Rev confirmation.`,
      kind: 'auto',
      required: true,
      complete: summaryComplete,
      jump: firstSummaryGap ? { type: 'field', field: firstSummaryGap } : undefined,
      jumpLabel: 'View 1040 totals',
    },
    {
      id: 'reviewed-notes',
      label: 'Review preparer notes',
      description: 'Read open preparer notes and resolve or acknowledge before sign-off.',
      kind: 'manual',
      required: true,
      complete: !!manual['reviewed-notes'],
      jump: { type: 'notesPane' },
      jumpLabel: 'Open notes',
    },
    {
      id: 'final-walkthrough',
      label: 'Executive 1040 totals walkthrough complete',
      description: `Walk wages ${live.wages.toLocaleString()}, total income, tax liability, and refund or balance due one last time.`,
      kind: 'manual',
      required: true,
      complete: !!manual['final-walkthrough'],
      jump: { type: 'field', field: 'totalIncome' },
      jumpLabel: 'View summary',
    },
    {
      id: 'yoy-variances',
      label: 'YoY variance walkthrough (optional)',
      description: 'Material YoY changes in wages, dividends, total income, and tax liability make sense for this client.',
      kind: 'manual',
      required: false,
      complete: !!manual['yoy-variances'],
      jump: { type: 'field', field: 'wages' },
      jumpLabel: 'View YoY totals',
    },
  ]

  const requiredItems = items.filter(i => i.required)
  const requiredCompleteCount = requiredItems.filter(i => i.complete).length
  const completeCount = items.filter(i => i.complete).length

  const blockers: string[] = []
  if (input.outstandingOpenCount > 0) {
    blockers.push(
      input.outstandingOpenCount === 1
        ? '1 open item still needs attention'
        : `${input.outstandingOpenCount} open items still need attention`,
    )
  }
  for (const item of requiredItems) {
    if (!item.complete) blockers.push(item.label)
  }

  return {
    items,
    completeCount,
    totalCount: items.length,
    requiredCompleteCount,
    requiredTotal: requiredItems.length,
    allRequiredComplete: requiredCompleteCount === requiredItems.length,
    blockers,
  }
}

export function canSignOff(
  checklist: ReviewChecklistState,
  outstandingOpenCount: number,
): boolean {
  return outstandingOpenCount === 0 && checklist.allRequiredComplete
}

export function signOffBlockerText(
  checklist: ReviewChecklistState,
  outstandingOpenCount: number,
): string | null {
  if (canSignOff(checklist, outstandingOpenCount)) return null
  if (checklist.blockers.length === 1) {
    return `${checklist.blockers[0]} before you sign off.`
  }
  if (checklist.blockers.length === 2) {
    return `${checklist.blockers[0]} and ${checklist.blockers[1].toLowerCase()} before you sign off.`
  }
  if (checklist.blockers.length > 2) {
    return `${checklist.blockers.slice(0, 2).join(', ')}, and ${checklist.blockers.length - 2} more before you sign off.`
  }
  return 'Complete the review checklist before you sign off.'
}
