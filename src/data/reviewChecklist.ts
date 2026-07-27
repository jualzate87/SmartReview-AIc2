/**
 * Process-level review checklist for Phase 2 sign-off attestation.
 * Distinct from granular open items in handoffSnapshot.
 */
import type { ActivityEntry } from '../hooks/useSyncedReviewState'
import { computeLiveReturn, type LiveAmounts } from './liveReturn'
import {
  PHASE1_FLAG_KEYS,
  isPhase1FlagResolved,
  type Phase1FlagKey,
} from '../pages/data-review/phase1FieldSync'
import { getPhase2Progress } from '../pages/data-review/phase2FlagSync'
import type { Note } from '../pages/data-review/NotesPane'
import type { HandoffJump } from './handoffSnapshot'

/** Source documents expected on a typical Jessica Drake 1040 return */
export const EXPECTED_SOURCE_DOCS = [
  'w2-techCircle',
  '1099-div-northmark',
  '1099-div-beacon',
  '1099-div-token',
  '1099-int-harborline',
  '1099-int-cascade',
  '1099-int-unwavering',
  '1099-r-meridian',
  '1099-nec',
] as const

export type ManualChecklistId = 'final-walkthrough' | 'yoy-variances'

export type ReviewChecklistItemId =
  | 'source-docs'
  | 'preparer-notes'
  | 'import-accuracy'
  | 'ai-diagnostics'
  | 'summary-lines'
  | ManualChecklistId

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
  reviewedFields: Map<string, ActivityEntry>
  verifiedDocs: Set<string>
  reviewerConfirmedDocs: Set<string>
  summaryCheckedFields: Set<string>
  reviewerConfirmedFields: Set<string>
  reviewerConfirmStaleFields: Set<string>
  notes: Note[]
  amounts: LiveAmounts
  manualChecklistItems: Record<string, boolean>
  outstandingOpenCount: number
}

function openPreparerNotes(notes: Note[]): Note[] {
  return notes.filter(n => {
    if ((n.status ?? 'open') !== 'open') return false
    const role = n.role ?? 'preparer'
    return role === 'preparer'
  })
}

export function deriveReviewChecklist(input: ReviewChecklistInputs): ReviewChecklistState {
  const phase1Keys = PHASE1_FLAG_KEYS as readonly Phase1FlagKey[]
  const openImportFlags = phase1Keys.filter(k => !isPhase1FlagResolved(k, input.reviewedFields))

  const live = computeLiveReturn(input.amounts)
  const p2 = getPhase2Progress({
    reviewedFields: input.reviewedFields,
    live,
    amounts: input.amounts,
  })
  const diagsOpenRaw = p2.activeKeys.filter(k => !input.reviewedFields.has(k))
  const diagsOpen =
    openImportFlags.length > 0
      ? diagsOpenRaw.filter(k => k !== 'importMismatches')
      : diagsOpenRaw

  const docsMissingVerify = EXPECTED_SOURCE_DOCS.filter(d => !input.verifiedDocs.has(d))
  const docsMissingConfirm = EXPECTED_SOURCE_DOCS.filter(
    d => input.verifiedDocs.has(d) && !input.reviewerConfirmedDocs.has(d),
  )
  const docsIncomplete = [...new Set([...docsMissingVerify, ...docsMissingConfirm])]
  const sourceDocsComplete = docsIncomplete.length === 0

  const prepNotes = openPreparerNotes(input.notes)
  const preparerNotesComplete = prepNotes.length === 0

  const importComplete = openImportFlags.length === 0
  const aiComplete = diagsOpen.length === 0

  const needsConfirm = [...input.summaryCheckedFields].filter(
    f => !input.reviewerConfirmedFields.has(f),
  )
  const summaryIncomplete = needsConfirm.length > 0 || input.reviewerConfirmStaleFields.size > 0
  const summaryComplete = !summaryIncomplete

  const firstSummaryGap =
    input.reviewerConfirmStaleFields.size > 0
      ? [...input.reviewerConfirmStaleFields][0]
      : needsConfirm[0]

  const firstDocGap = docsMissingVerify[0] ?? docsMissingConfirm[0]
  const firstImportFlag = openImportFlags[0]
  const firstDiag = diagsOpen[0]
  const firstPrepNote = prepNotes[0]

  const manual = input.manualChecklistItems

  const items: ReviewChecklistItem[] = [
    {
      id: 'source-docs',
      label: 'All source documents verified and confirmed',
      description: sourceDocsComplete
        ? 'Every expected document is verified and confirmed for sign-off.'
        : docsMissingVerify.length
          ? `${docsMissingVerify.length} document${docsMissingVerify.length === 1 ? '' : 's'} still need verification.`
          : `${docsMissingConfirm.length} document${docsMissingConfirm.length === 1 ? '' : 's'} verified but awaiting your confirmation.`,
      kind: 'auto',
      required: true,
      complete: sourceDocsComplete,
      jump: firstDocGap ? { type: 'doc', docId: firstDocGap } : undefined,
      jumpLabel: 'View document',
    },
    {
      id: 'preparer-notes',
      label: 'Preparer notes reviewed',
      description: preparerNotesComplete
        ? 'No open notes from the preparer.'
        : `${prepNotes.length} preparer note${prepNotes.length === 1 ? '' : 's'} still open.`,
      kind: 'auto',
      required: true,
      complete: preparerNotesComplete,
      jump: firstPrepNote
        ? { type: 'note', noteId: firstPrepNote.id }
        : prepNotes.length
          ? { type: 'notesPane' }
          : undefined,
      jumpLabel: firstPrepNote ? 'Read note' : 'Open notes',
    },
    {
      id: 'import-accuracy',
      label: 'Import accuracy cleared',
      description: importComplete
        ? 'All Phase 1 import flags are resolved.'
        : `${openImportFlags.length} import flag${openImportFlags.length === 1 ? '' : 's'} still open.`,
      kind: 'auto',
      required: true,
      complete: importComplete,
      jump: firstImportFlag ? { type: 'field', field: firstImportFlag } : undefined,
      jumpLabel: 'View field',
    },
    {
      id: 'ai-diagnostics',
      label: 'AI diagnostics reviewed',
      description: aiComplete
        ? 'All active AI diagnostics have been reviewed.'
        : `${diagsOpen.length} diagnostic${diagsOpen.length === 1 ? '' : 's'} still open.`,
      kind: 'auto',
      required: true,
      complete: aiComplete,
      jump: firstDiag ? { type: 'diagnostic', issueKey: firstDiag } : undefined,
      jumpLabel: 'Open AI review',
    },
    {
      id: 'summary-lines',
      label: 'Return summary lines confirmed',
      description: summaryComplete
        ? 'Summary lines are confirmed for sign-off.'
        : input.reviewerConfirmStaleFields.size > 0
          ? `${input.reviewerConfirmStaleFields.size} line${input.reviewerConfirmStaleFields.size === 1 ? '' : 's'} edited since verify. Confirm again.`
          : `${needsConfirm.length} verified line${needsConfirm.length === 1 ? '' : 's'} awaiting your confirmation.`,
      kind: 'auto',
      required: true,
      complete: summaryComplete,
      jump: firstSummaryGap ? { type: 'field', field: firstSummaryGap } : undefined,
      jumpLabel: 'View summary',
    },
    {
      id: 'final-walkthrough',
      label: 'Final 1040 walkthrough complete',
      description: 'I walked the return summary and key outputs one last time.',
      kind: 'manual',
      required: true,
      complete: !!manual['final-walkthrough'],
    },
    {
      id: 'yoy-variances',
      label: 'Year-over-year variances reviewed',
      description: 'Material YoY changes make sense for this client.',
      kind: 'manual',
      required: false,
      complete: !!manual['yoy-variances'],
      jump: { type: 'field', field: 'wages' },
      jumpLabel: 'View summary',
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
