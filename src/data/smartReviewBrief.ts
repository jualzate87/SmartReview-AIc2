/**
 * Smart Review Brief — phase checklist and activity log payloads for HandoffSummary.
 * Derives from handoffSnapshot, reviewChecklist, and live review state.
 */
import { milestoneActorLabel, PREPARER_NAME, REVIEWER_NAME } from '../hooks/useSyncedReviewState'
import type { HandoffJump, HandoffSnapshot, HandoffItemGroup, HandoffItem } from './handoffSnapshot'
import {
  canonicalActivityKey,
  getFieldDisplayLabel,
  isBox12FieldKey,
  parseHandoffItemKey,
} from './handoffSnapshot'
import { normalizeVerifiedDocKey, verifiedDocLabel, PACKET_VERIFY_DOC_KEYS } from './verifiedDocKeys'
import { PHASE1_FLAG_KEYS } from '../pages/data-review/phase1FieldSync'
import type { ReviewChecklistState } from './reviewChecklist'
import type { LiveAmounts } from './liveReturn'
import {
  countMilestonesByRole,
  formatMilestoneAttribution,
  formatMilestoneAttributionTooltip,
  MILESTONE_PHASE_DESCRIPTIONS,
  MILESTONE_PHASE_TITLES,
  type MilestoneCompletionType,
  type MilestoneState,
  type ResolvedMilestone,
} from './reviewMilestones'

export type BriefPhaseId = 'phase-1' | 'phase-2' | 'phase-3' | 'phase-4' | 'phase-5'

export type StrategicChecklistItem = {
  id: string
  title: string
  note?: string
  checked: boolean
  /** Pending open items cannot be attested until underlying work is cleared */
  locked?: boolean
  jump?: HandoffJump
  jumpLabel?: string
  required: boolean
  completionType?: MilestoneCompletionType
  /** Who completed — e.g. "Jordan · Jul 29" */
  attribution?: string
  /** Full name + time for hover tooltip */
  attributionTooltip?: string
  canToggle?: boolean
}

export type BriefPhase = {
  id: BriefPhaseId
  title: string
  description: string
  status: 'action-needed' | 'verified'
  items: StrategicChecklistItem[]
}

export type ActivityLogEntry = {
  id: string
  label: string
  detail?: string
}

export type ActivityLogCategory = {
  id: string
  title: string
  badge: string | null
  entries: ActivityLogEntry[]
}

export type BriefViewMode = 'preparer-summary' | 'reviewer-briefing' | 'reviewer-strategic'

export type BriefTextPart = { text: string; bold?: boolean }

export type ConversationalBriefItem = {
  id: string
  parts: BriefTextPart[]
}

export type ConversationalBriefSection = {
  label: string
  items: ConversationalBriefItem[]
}

export type ConversationalBrief = {
  reviewerFirstName: string
  heading: string
  intro: string
  completed: ConversationalBriefSection
  attention: ConversationalBriefSection | null
  syncedAt: string
}

export type SmartReviewBrief = {
  viewMode: BriefViewMode
  header: {
    title: string
    pass1Line: string
    passBadge: string | null
  }
  executiveBrief: ConversationalBrief | null
  phases: BriefPhase[]
  activityLog: ActivityLogCategory[]
  signOff: {
    ready: boolean
    statusText: string
    blockerText: string | null
  }
  /** All required strategic checklist items complete (Tab 1) */
  allPhasesComplete: boolean
}

export type SmartReviewBriefInputs = {
  snapshot: HandoffSnapshot
  checklist: ReviewChecklistState
  milestoneState?: MilestoneState
  outstandingOpenCount: number
  manualChecklistItems: Record<string, boolean>
  syncedAt?: string
  reviewPass: 1 | 2
  showStrategicChecklist: boolean
  isPreparer: boolean
  amounts?: LiveAmounts
  singlePersonMode?: boolean
}

const BRIEF_PHASE_IDS: BriefPhaseId[] = ['phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5']

function briefPhaseId(num: 1 | 2 | 3 | 4 | 5): BriefPhaseId {
  return `phase-${num}` as BriefPhaseId
}

function firstName(full: string): string {
  return full.split(/\s+/)[0] || full
}

function phaseStatus(items: StrategicChecklistItem[]): 'action-needed' | 'verified' {
  const required = items.filter(i => i.required)
  if (required.length === 0) return 'verified'
  return required.every(i => i.checked && !i.locked) ? 'verified' : 'action-needed'
}

function milestoneToStrategicItem(m: ResolvedMilestone): StrategicChecklistItem {
  return {
    id: m.id,
    title: m.title,
    note: m.complete && m.completion
      ? m.description
      : m.description,
    checked: m.complete,
    locked: m.locked,
    jump: m.jumpTarget,
    jumpLabel: m.jumpLabel,
    required: m.required,
    completionType: m.completionType,
    attribution: formatMilestoneAttribution(m.completion),
    attributionTooltip: formatMilestoneAttributionTooltip(m.completion),
    canToggle: m.canToggle,
  }
}

function countPass1Baseline(snapshot: HandoffSnapshot): { checks: number; docCount: number } {
  const doneGroups = getDoneGroups(snapshot)
  let checks = 0
  for (const group of doneGroups) checks += group.count
  const verifiedGroup = doneGroups.find(g => g.id === 'verified-docs')
  const docCount = verifiedGroup?.count ?? PACKET_VERIFY_DOC_KEYS.length
  return { checks: Math.max(checks, 28), docCount: Math.max(docCount, 5) }
}

function getOpenGroups(snapshot: HandoffSnapshot): HandoffItemGroup[] {
  const openSection = snapshot.sections.find(s => s.id === 'needsAttention')
  return openSection?.groups ?? []
}

function getDoneGroups(snapshot: HandoffSnapshot): HandoffItemGroup[] {
  const doneSection = snapshot.sections.find(s => s.id === 'preparerDone')
  return doneSection?.groups ?? []
}

function buildPhasesFromMilestones(milestoneState: MilestoneState): BriefPhase[] {
  const phaseItems: Record<BriefPhaseId, StrategicChecklistItem[]> = {
    'phase-1': [],
    'phase-2': [],
    'phase-3': [],
    'phase-4': [],
    'phase-5': [],
  }

  for (const m of milestoneState.milestones) {
    const phaseId = briefPhaseId(m.phase)
    phaseItems[phaseId].push(milestoneToStrategicItem(m))
  }

  return BRIEF_PHASE_IDS.map(id => {
    const phaseNum = Number(id.replace('phase-', '')) as 1 | 2 | 3 | 4 | 5
    const items = phaseItems[id]
    return {
      id,
      title: MILESTONE_PHASE_TITLES[phaseNum],
      description: MILESTONE_PHASE_DESCRIPTIONS[phaseNum],
      status: phaseStatus(items),
      items,
    }
  })
}


const PHASE1_FLAG_KEY_SET = new Set<string>(PHASE1_FLAG_KEYS)

function isPhase1ImportFlag(key: string): boolean {
  return PHASE1_FLAG_KEY_SET.has(key)
}

function docVerificationDetail(docItem: HandoffItem): string | undefined {
  if (!docItem.detail) return 'Marked verified against source document'
  const metaOnly = docItem.detail.split(' · ')[0]
  if (metaOnly && !metaOnly.startsWith('Cleared')) return metaOnly
  return 'Marked verified against source document'
}

function editTouchesClearedFlag(editKey: string, clearedFlagKeys: string[]): boolean {
  return clearedFlagKeys.some(flag => {
    if (editKey === flag) return true
    if (isBox12FieldKey(editKey) && (flag === 'box12' || isBox12FieldKey(flag))) return true
    const base = flag.split('-')[0]
    return editKey === base || editKey.startsWith(`${base}-`) || flag.startsWith(`${editKey}-`)
  })
}

function summaryReviewDetail(item: HandoffItem): string | undefined {
  if (item.detail && !item.detail.includes('awaiting your confirmation')) {
    return item.detail
  }
  return 'Attested as reviewed on the 1040 summary'
}

function categoryCompleteBadge(entries: ActivityLogEntry[], label: string): string | null {
  return entries.length > 0 ? label : null
}

function buildActivityLog(_snapshot: HandoffSnapshot, _preparerFirstName: string): ActivityLogCategory[] {
  const doneGroups = getDoneGroups(_snapshot)
  const byId = (id: string) => doneGroups.find(g => g.id === id)

  const verifiedDocItems = byId('verified-docs')?.items ?? []
  const clearedFlagItems = byId('import-flags-cleared')?.items ?? []
  const summaryItems = byId('summary-lines')?.items ?? []
  const editItems = byId('amount-edits')?.items ?? []
  const diagItems = byId('ai-diagnostics-reviewed')?.items ?? []

  const clearedFlagKeys = clearedFlagItems
    .map(item => parseHandoffItemKey(item))
    .filter((fk): fk is string => !!fk)

  const consumed = new Set<string>()

  // ── 1. Documents verified ───────────────────────────────────────────────
  const docEntries: ActivityLogEntry[] = []
  for (const docItem of verifiedDocItems) {
    const docId = docItem.jump?.type === 'doc' ? docItem.jump.docId : parseHandoffItemKey(docItem)
    if (!docId) continue
    const canonicalDoc = normalizeVerifiedDocKey(docId)
    docEntries.push({
      id: docItem.id ?? `activity-doc-${canonicalDoc}`,
      label: verifiedDocLabel(canonicalDoc),
      detail: docVerificationDetail(docItem),
    })
  }

  // ── 2. Import flags cleared ───────────────────────────────────────────
  const flagEntries: ActivityLogEntry[] = []
  for (const item of clearedFlagItems) {
    const fk = parseHandoffItemKey(item)
    if (!fk) continue
    flagEntries.push({
      id: item.id ?? `activity-flag-${fk}`,
      label: item.label || getFieldDisplayLabel(fk),
      detail: item.detail,
    })
    consumed.add(canonicalActivityKey(fk))
  }

  // Edits tied to cleared import flags belong with the flag action, not amount edits.
  for (const item of editItems) {
    const fk = parseHandoffItemKey(item)
    if (!fk) continue
    if (editTouchesClearedFlag(fk, clearedFlagKeys)) {
      consumed.add(canonicalActivityKey(fk))
    }
  }

  // ── 3. Amount edits (no flag) ─────────────────────────────────────────
  const editEntries: ActivityLogEntry[] = []
  for (const item of editItems) {
    const fk = parseHandoffItemKey(item)
    if (!fk || consumed.has(canonicalActivityKey(fk))) continue
    if (isPhase1ImportFlag(fk)) continue
    editEntries.push({
      id: item.id ?? `activity-edit-${fk}`,
      label: item.label || getFieldDisplayLabel(fk),
      detail: item.detail,
    })
    consumed.add(canonicalActivityKey(fk))
  }

  // ── 4. Return summary reviewed ────────────────────────────────────────
  const summaryEntries: ActivityLogEntry[] = []
  for (const item of summaryItems) {
    const fk = parseHandoffItemKey(item)
    if (!fk || consumed.has(canonicalActivityKey(fk))) continue
    summaryEntries.push({
      id: item.id ?? `activity-summary-${fk}`,
      label: getFieldDisplayLabel(fk),
      detail: summaryReviewDetail(item),
    })
    consumed.add(canonicalActivityKey(fk))
  }

  // ── 5. First-pass diagnostics cleared ─────────────────────────────────
  const diagEntries: ActivityLogEntry[] = diagItems.map((item, i) => ({
    id: item.id ?? `activity-diag-${i}`,
    label: item.label,
    detail: item.detail ?? 'Reviewed and cleared in first-pass diagnostics',
  }))

  return [
    {
      id: 'documents-verified',
      title: 'Documents verified',
      badge: categoryCompleteBadge(docEntries, 'All verified'),
      entries: docEntries,
    },
    {
      id: 'import-flags-cleared',
      title: 'Import flags cleared',
      badge: categoryCompleteBadge(flagEntries, 'All cleared'),
      entries: flagEntries,
    },
    {
      id: 'amount-edits-no-flag',
      title: 'Amount edits (no flag)',
      badge: categoryCompleteBadge(editEntries, 'All recorded'),
      entries: editEntries,
    },
    {
      id: 'return-summary-reviewed',
      title: 'Return summary reviewed',
      badge: categoryCompleteBadge(summaryEntries, 'All verified'),
      entries: summaryEntries,
    },
    {
      id: 'first-pass-diags',
      title: 'First-pass diagnostics cleared',
      badge: categoryCompleteBadge(diagEntries, 'All cleared'),
      entries: diagEntries,
    },
  ]
}

function buildPreparerActivityLog(snapshot: HandoffSnapshot): ActivityLogCategory[] {
  return buildActivityLog(snapshot, firstName(snapshot.actorLabel))
}

function countStrategicProgress(phases: BriefPhase[]): {
  attested: number
  required: number
  open: number
} {
  const requiredItems = phases.flatMap(p => p.items).filter(i => i.required)
  const attested = requiredItems.filter(i => i.checked && !i.locked).length
  const open = requiredItems.filter(i => !i.checked || i.locked).length
  return { attested, required: requiredItems.length, open }
}

/** Open strategic checklist items (for Summary toolbar badge in Pass 2). */
export function countStrategicOpenItems(phases: BriefPhase[]): number {
  return countStrategicProgress(phases).open
}

function briefItem(id: string, parts: BriefTextPart[]): ConversationalBriefItem {
  return { id, parts }
}

function countActivityEntries(snapshot: HandoffSnapshot): {
  docsVerified: number
  flagsCleared: number
  diagsCleared: number
} {
  const doneGroups = getDoneGroups(snapshot)
  const byId = (id: string) => doneGroups.find(g => g.id === id)
  return {
    docsVerified: byId('verified-docs')?.count ?? byId('verified-docs')?.items.length ?? 0,
    flagsCleared: byId('import-flags-cleared')?.count ?? byId('import-flags-cleared')?.items.length ?? 0,
    diagsCleared: byId('ai-diagnostics-reviewed')?.count ?? byId('ai-diagnostics-reviewed')?.items.length ?? 0,
  }
}

function getPass2OpenStats(snapshot: HandoffSnapshot): {
  openImportFlags: number
  unverifiedDocs: number
  openDiags: number
  openNotes: number
} {
  const openGroups = getOpenGroups(snapshot)
  return {
    openImportFlags: openGroups.find(g => g.id === 'import-flags')?.count ?? 0,
    unverifiedDocs: openGroups.find(g => g.id === 'unverified-docs')?.count ?? 0,
    openDiags: openGroups.find(g => g.id === 'ai-diagnostics')?.count ?? 0,
    openNotes: openGroups.find(g => g.id === 'notes')?.count ?? 0,
  }
}

function buildExecutiveBrief(
  snapshot: HandoffSnapshot,
  preparerFirst: string,
  phases: BriefPhase[],
  allPhasesComplete: boolean,
  outstandingOpenCount: number,
  reviewPass: 1 | 2,
  milestoneState?: MilestoneState,
): SmartReviewBrief['executiveBrief'] {
  const reviewerFirst = firstName(REVIEWER_NAME)

  if (reviewPass === 2) {
    const stats = getPass2OpenStats(snapshot)
    const completedItems: ConversationalBriefItem[] = []

    if (stats.openImportFlags === 0) {
      completedItems.push(briefItem('flags', [{ text: 'She cleared all import flags.' }]))
    } else {
      completedItems.push(
        briefItem('flags', [
          { text: 'She left ' },
          { text: String(stats.openImportFlags), bold: true },
          { text: ` import flag${stats.openImportFlags === 1 ? '' : 's'} still open.` },
        ]),
      )
    }

    if (stats.unverifiedDocs === 0) {
      completedItems.push(
        briefItem('docs', [{ text: 'She marked all source documents as reviewed.' }]),
      )
    } else {
      completedItems.push(
        briefItem('docs', [
          { text: 'She left ' },
          { text: String(stats.unverifiedDocs), bold: true },
          { text: ` document${stats.unverifiedDocs === 1 ? '' : 's'} unverified.` },
        ]),
      )
    }

    if (stats.openDiags === 0) {
      completedItems.push(
        briefItem('diags', [{ text: 'She cleared all first-pass diagnostics.' }]),
      )
    } else {
      completedItems.push(
        briefItem('diags', [
          { text: 'She left ' },
          { text: String(stats.openDiags), bold: true },
          { text: ` diagnostic${stats.openDiags === 1 ? '' : 's'} for your review.` },
        ]),
      )
    }

    if (stats.openNotes > 0) {
      completedItems.push(briefItem('notes', [{ text: 'She left notes for your review.' }]))
    }

    const remainingMilestones = milestoneState
      ? Math.max(0, milestoneState.requiredTotal - milestoneState.requiredCompleteCount)
      : countStrategicProgress(phases).open

    let attention: ConversationalBriefSection | null = null
    if (remainingMilestones > 0) {
      attention = {
        label: 'Needs your attention',
        items: [
          briefItem('milestones-attest', [
            { text: String(remainingMilestones), bold: true },
            {
              text: ` milestone${remainingMilestones === 1 ? '' : 's'} still need${remainingMilestones === 1 ? 's' : ''} your attestation before sign-off.`,
            },
          ]),
        ],
      }
    } else if (!allPhasesComplete && outstandingOpenCount > 0) {
      attention = {
        label: 'Needs your attention',
        items: [
          briefItem('spot-check', [
            { text: 'Spot-check NIIT, capital gains rate, and executive totals before sign-off.' },
          ]),
        ],
      }
    }

    return {
      reviewerFirstName: reviewerFirst,
      heading: `${reviewerFirst}, Pass 2 review`,
      intro: `${preparerFirst} completed the first pass.`,
      completed: {
        label: '',
        items: completedItems,
      },
      attention,
      syncedAt: 'Synced just now',
    }
  }

  const { checks, docCount } = countPass1Baseline(snapshot)
  const { attested, required, open } = countStrategicProgress(phases)
  const attentionCount = Math.max(open, outstandingOpenCount)
  const activity = countActivityEntries(snapshot)
  const resolvedDocCount = Math.max(activity.docsVerified, docCount)
  const resolvedFlagCount = Math.max(activity.flagsCleared, checks > 0 ? checks - resolvedDocCount : 0)
  const milestoneCounts = milestoneState ? countMilestonesByRole(milestoneState) : null

  const passLabel = reviewPass === 2 ? 'Pass 2' : 'Pass 1'
  const heading = `${reviewerFirst}, here's where ${passLabel.toLowerCase()} stands`

  const intro =
    `${preparerFirst} finished ${passLabel} and handed this return to you. Here's what's already done and what still needs your review.`

  const completedItems: ConversationalBriefItem[] = []

  if (milestoneCounts && milestoneCounts.complete > 0) {
    completedItems.push(
      briefItem('milestones-progress', [
        { text: String(milestoneCounts.complete), bold: true },
        { text: ' of ' },
        { text: String(milestoneState!.requiredTotal), bold: true },
        { text: ' required milestones complete' },
      ]),
    )
    const hasPreparer = milestoneCounts.preparer > 0
    const hasReviewer = milestoneCounts.reviewer > 0
    if (hasPreparer && hasReviewer) {
      if (reviewPass === 2 && hasPreparer) {
        completedItems.push(
          briefItem('milestones-preparer', [
            { text: preparerFirst, bold: true },
            { text: ' completed ' },
            { text: String(milestoneCounts.preparer), bold: true },
            { text: ` milestone${milestoneCounts.preparer === 1 ? '' : 's'} in Pass 1` },
          ]),
        )
      }
      if (hasReviewer) {
        completedItems.push(
          briefItem('milestones-reviewer', [
            { text: reviewerFirst, bold: true },
            { text: ' completed ' },
            { text: String(milestoneCounts.reviewer), bold: true },
            { text: ` milestone${milestoneCounts.reviewer === 1 ? '' : 's'} in Pass 2` },
          ]),
        )
      }
    } else if (hasPreparer) {
      completedItems.push(
        briefItem('milestones-actor', [
          { text: milestoneActorLabel(PREPARER_NAME), bold: true },
          { text: ' completed ' },
          { text: String(milestoneCounts.preparer), bold: true },
          { text: ` milestone${milestoneCounts.preparer === 1 ? '' : 's'}` },
        ]),
      )
    } else if (hasReviewer) {
      completedItems.push(
        briefItem('milestones-actor', [
          { text: milestoneActorLabel(REVIEWER_NAME), bold: true },
          { text: ' completed ' },
          { text: String(milestoneCounts.reviewer), bold: true },
          { text: ` milestone${milestoneCounts.reviewer === 1 ? '' : 's'}` },
        ]),
      )
    }
  }

  if (reviewPass === 1) {
    completedItems.push(
      briefItem('docs-verified', [
        { text: preparerFirst, bold: true },
        { text: ' verified ' },
        { text: String(resolvedDocCount), bold: true },
        { text: ` source document${resolvedDocCount === 1 ? '' : 's'} against OCR imports` },
      ]),
    )
    if (resolvedFlagCount > 0) {
      completedItems.push(
        briefItem('flags-cleared', [
          { text: preparerFirst, bold: true },
          { text: ' cleared ' },
          { text: String(resolvedFlagCount), bold: true },
          { text: ` import flag${resolvedFlagCount === 1 ? '' : 's'} across W-2 and 1099 forms` },
        ]),
      )
    }
    if (activity.diagsCleared > 0) {
      completedItems.push(
        briefItem('diags-cleared', [
          { text: preparerFirst, bold: true },
          { text: ' reviewed ' },
          { text: String(activity.diagsCleared), bold: true },
          { text: ` first-pass AI diagnostic${activity.diagsCleared === 1 ? '' : 's'}` },
        ]),
      )
    }
  } else if (!milestoneCounts?.complete) {
    completedItems.push(
      briefItem('pass1-handoff', [
        { text: preparerFirst, bold: true },
        { text: ' completed Pass 1 with ' },
        { text: String(resolvedDocCount), bold: true },
        { text: ` verified document${resolvedDocCount === 1 ? '' : 's'} and ` },
        { text: String(checks), bold: true },
        { text: ' baseline checks' },
      ]),
    )
  }

  if (attested > 0 && !milestoneCounts) {
    completedItems.push(
      briefItem('checklist-attested', [
        { text: String(attested), bold: true },
        { text: ' of ' },
        { text: String(required), bold: true },
        { text: ` checklist item${required === 1 ? '' : 's'} attested so far` },
      ]),
    )
  }

  if (completedItems.length === 0) {
    completedItems.push(
      briefItem('baseline', [
        { text: preparerFirst, bold: true },
        { text: ' completed baseline import accuracy work — start with the phased checklist below.' },
      ]),
    )
  }

  let attention: ConversationalBriefSection | null = null
  const remainingMilestones = milestoneState
    ? milestoneState.requiredTotal - milestoneState.requiredCompleteCount
    : required - attested

  if (attentionCount > 0 || remainingMilestones > 0) {
    const n = Math.max(remainingMilestones, attentionCount)
    attention = {
      label: 'Needs your attention',
      items: [
        briefItem('open-items', [
          { text: String(n), bold: true },
          {
            text: ` item${n === 1 ? '' : 's'} still need${n === 1 ? 's' : ''} your review — work through the checklist below.`,
          },
        ]),
      ],
    }
  } else if (!allPhasesComplete) {
    attention = {
      label: 'Needs your attention',
      items: [
        briefItem('spot-check', [
          { text: 'Spot-check NIIT, capital gains rate, and executive totals, then complete remaining milestones' },
        ]),
      ],
    }
  }

  return {
    reviewerFirstName: reviewerFirst,
    heading,
    intro,
    completed: {
      label: 'Completed so far',
      items: completedItems,
    },
    attention,
    syncedAt: 'Synced just now',
  }
}

function buildSignOffStatus(
  allPhasesComplete: boolean,
  outstandingOpenCount: number,
  checklist: ReviewChecklistState,
  milestoneState?: MilestoneState,
): SmartReviewBrief['signOff'] {
  const ready = allPhasesComplete && outstandingOpenCount === 0
  if (ready) {
    return {
      ready: true,
      statusText: 'Ready for sign-off',
      blockerText: null,
    }
  }
  const blockers: string[] = []
  if (outstandingOpenCount > 0) {
    blockers.push(
      outstandingOpenCount === 1
        ? '1 open item still needs attention'
        : `${outstandingOpenCount} open items still need attention`,
    )
  }
  if (!allPhasesComplete) {
    if (milestoneState) {
      const incomplete = milestoneState.requiredTotal - milestoneState.requiredCompleteCount
      if (incomplete > 0) {
        blockers.push(
          incomplete === 1
            ? '1 milestone still needs completion'
            : `${incomplete} milestones still need completion`,
        )
      }
    } else {
      const incomplete = checklist.items.filter(i => i.required && !i.complete).length
      if (incomplete > 0) {
        blockers.push(
          incomplete === 1
            ? '1 checklist item still needs attestation'
            : `${incomplete} checklist items still need attestation`,
        )
      }
    }
  }
  const blockerText =
    blockers.length === 0
      ? 'Complete the reviewer checklist before you sign off.'
      : `${blockers.join('. ')}.`
  return {
    ready: false,
    statusText: 'Not ready for sign-off',
    blockerText,
  }
}

function allRequiredPhasesComplete(phases: BriefPhase[]): boolean {
  for (const phase of phases) {
    for (const item of phase.items) {
      if (item.required && (!item.checked || item.locked)) return false
    }
  }
  return true
}

export function buildSmartReviewBrief(input: SmartReviewBriefInputs): SmartReviewBrief {
  const {
    snapshot,
    checklist,
    milestoneState,
    outstandingOpenCount,
    reviewPass,
    showStrategicChecklist,
    isPreparer,
    singlePersonMode = false,
  } = input

  const preparerName = snapshot.voice === 'reviewer-briefing' ? snapshot.actorLabel : PREPARER_NAME
  const preparerFirst = firstName(preparerName)

  let viewMode: BriefViewMode = 'reviewer-strategic'
  if (isPreparer) {
    viewMode = 'preparer-summary'
  } else if (snapshot.voice === 'reviewer-briefing' || !showStrategicChecklist) {
    viewMode = 'reviewer-briefing'
  }

  const phases =
    viewMode === 'reviewer-strategic' && milestoneState
      ? buildPhasesFromMilestones(milestoneState)
      : []

  const allPhasesComplete = phases.length > 0
    ? allRequiredPhasesComplete(phases)
    : milestoneState?.allRequiredComplete ?? checklist.allRequiredComplete

  const activityLog =
    viewMode === 'preparer-summary'
      ? buildPreparerActivityLog(snapshot)
      : buildActivityLog(snapshot, preparerFirst)

  const passBadge = reviewPass === 2 && viewMode === 'reviewer-strategic' ? 'Pass 2' : null

  return {
    viewMode,
    header: {
      title: 'Smart review brief',
      pass1Line:
        viewMode === 'preparer-summary'
          ? `Pass ${snapshot.pass} · ${snapshot.actorLabel}`
          : `Pass 1 completed by ${preparerName}`,
      passBadge,
    },
    executiveBrief:
      viewMode === 'reviewer-strategic'
        ? buildExecutiveBrief(
          snapshot,
          preparerFirst,
          phases,
          allPhasesComplete,
          outstandingOpenCount,
          reviewPass,
          milestoneState,
        )
        : null,
    phases,
    activityLog,
    signOff: buildSignOffStatus(allPhasesComplete, outstandingOpenCount, checklist, milestoneState),
    allPhasesComplete,
  }
}

export function canApproveSignOff(brief: SmartReviewBrief): boolean {
  return brief.signOff.ready
}
