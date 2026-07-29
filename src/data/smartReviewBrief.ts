/**
 * Smart Review Brief — phase checklist and activity log payloads for HandoffSummary.
 * Derives from handoffSnapshot, reviewChecklist, and live review state.
 */
import { PREPARER_NAME } from '../hooks/useSyncedReviewState'
import type { HandoffJump, HandoffSnapshot, HandoffItemGroup } from './handoffSnapshot'
import type { ReviewChecklistState, ReviewChecklistItem } from './reviewChecklist'

export type BriefPhaseId = 'phase-1' | 'phase-2' | 'phase-3' | 'phase-4'

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
}

export type BriefPhase = {
  id: BriefPhaseId
  title: string
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

export type SmartReviewBrief = {
  viewMode: BriefViewMode
  header: {
    title: string
    pass1Line: string
    passBadge: string | null
  }
  executiveBrief: {
    paragraphs: string[]
    syncedAt: string
  } | null
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
  outstandingOpenCount: number
  manualChecklistItems: Record<string, boolean>
  syncedAt?: string
  reviewPass: 1 | 2
  showStrategicChecklist: boolean
  isPreparer: boolean
}

const PHASE_TITLES: Record<BriefPhaseId, string> = {
  'phase-1': 'Phase 1: Source documents & income verification',
  'phase-2': 'Phase 2: Tax law strategy, safe harbors & form diagnostics',
  'phase-3': 'Phase 3: Deductions, carryforwards & estimates',
  'phase-4': 'Phase 4: Executive 1040 totals & YoY variance walkthrough',
}

const OPEN_GROUP_PHASE: Record<string, BriefPhaseId> = {
  'unverified-docs': 'phase-1',
  'import-flags': 'phase-1',
  'docs-needs-confirmation': 'phase-1',
  notes: 'phase-1',
  'needs-confirmation': 'phase-4',
  'ai-diagnostics': 'phase-2',
  'preparer-flags': 'phase-3',
}

const CHECKLIST_PHASE: Record<string, BriefPhaseId> = {
  'source-docs': 'phase-1',
  'reviewed-inputs': 'phase-1',
  'reviewed-notes': 'phase-1',
  'law-compliance': 'phase-2',
  'deductions-optimization': 'phase-3',
  'summary-lines': 'phase-4',
  'reviewed-outputs': 'phase-4',
  'output-forms-signoff': 'phase-4',
  'final-walkthrough': 'phase-4',
  'yoy-variances': 'phase-4',
}

function firstName(full: string): string {
  return full.split(/\s+/)[0] || full
}

function phaseStatus(items: StrategicChecklistItem[]): 'action-needed' | 'verified' {
  const required = items.filter(i => i.required)
  if (required.length === 0) return 'verified'
  return required.every(i => i.checked && !i.locked) ? 'verified' : 'action-needed'
}

function checklistToStrategicItem(item: ReviewChecklistItem): StrategicChecklistItem {
  return {
    id: item.id,
    title: item.label,
    note: item.description,
    checked: item.complete,
    locked: item.kind === 'auto',
    jump: item.jump,
    jumpLabel: item.jumpLabel ? `${item.jumpLabel} ↗` : undefined,
    required: item.required,
  }
}

function openGroupToItems(group: HandoffItemGroup): StrategicChecklistItem[] {
  return group.items.map(item => ({
    id: item.id ?? `open-${group.id}-${item.label}`,
    title: item.label,
    note: item.detail,
    checked: false,
    locked: true,
    jump: item.jump,
    jumpLabel: item.jumpLabel ? `${item.jumpLabel} ↗` : item.jump ? 'View ↗' : undefined,
    required: true,
  }))
}

function getOpenGroups(snapshot: HandoffSnapshot): HandoffItemGroup[] {
  const openSection = snapshot.sections.find(s => s.id === 'needsAttention')
  return openSection?.groups ?? []
}

function getDoneGroups(snapshot: HandoffSnapshot): HandoffItemGroup[] {
  const doneSection = snapshot.sections.find(s => s.id === 'preparerDone')
  return doneSection?.groups ?? []
}

function buildPhases(
  checklist: ReviewChecklistState,
  snapshot: HandoffSnapshot,
  manualChecklistItems: Record<string, boolean>,
): BriefPhase[] {
  const phaseItems: Record<BriefPhaseId, StrategicChecklistItem[]> = {
    'phase-1': [],
    'phase-2': [],
    'phase-3': [],
    'phase-4': [],
  }

  const seenIds = new Set<string>()

  for (const item of checklist.items) {
    const phaseId = CHECKLIST_PHASE[item.id]
    if (!phaseId) continue
    if (item.kind === 'manual') {
      phaseItems[phaseId].push({
        id: item.id,
        title: item.label,
        note: item.description,
        checked: !!manualChecklistItems[item.id],
        jump: item.jump,
        jumpLabel: item.jumpLabel ? `${item.jumpLabel} ↗` : undefined,
        required: item.required,
      })
    } else {
      phaseItems[phaseId].push(checklistToStrategicItem(item))
    }
    seenIds.add(item.id)
  }

  for (const group of getOpenGroups(snapshot)) {
    const phaseId = OPEN_GROUP_PHASE[group.id] ?? 'phase-1'
    for (const item of openGroupToItems(group)) {
      if (seenIds.has(item.id)) continue
      phaseItems[phaseId].push(item)
      seenIds.add(item.id)
    }
  }

  return (Object.keys(PHASE_TITLES) as BriefPhaseId[]).map(id => {
    const items = phaseItems[id]
    return {
      id,
      title: PHASE_TITLES[id],
      status: phaseStatus(items),
      items,
    }
  })
}

function groupEntries(group: HandoffItemGroup | undefined): ActivityLogEntry[] {
  if (!group) return []
  return group.items.map((item, i) => ({
    id: item.id ?? `${group.id}-${i}`,
    label: item.label,
    detail: item.detail,
  }))
}

function buildActivityLog(snapshot: HandoffSnapshot, preparerFirstName: string): ActivityLogCategory[] {
  const doneGroups = getDoneGroups(snapshot)
  const byId = (id: string) => doneGroups.find(g => g.id === id)

  const sourceDocs = groupEntries(byId('verified-docs'))
  const flagsCleared = groupEntries(byId('import-flags-cleared'))
  const sourceEntries = [...sourceDocs, ...flagsCleared]

  const summaryLines = groupEntries(byId('summary-lines'))
  const amountEdits = groupEntries(byId('amount-edits'))
  const reconcileEntries = [...summaryLines, ...amountEdits]

  const diagsReviewed = groupEntries(byId('ai-diagnostics-reviewed'))

  const allCleared = (entries: ActivityLogEntry[]) =>
    entries.length > 0 ? 'All cleared' : null

  return [
    {
      id: 'source-docs-ocr',
      title: 'Source documents & OCR flags',
      badge: allCleared(sourceEntries) ?? (sourceEntries.length === 0 ? null : 'In progress'),
      entries: sourceEntries,
    },
    {
      id: 'form-reconciliations',
      title: 'Form & schedule line reconciliations',
      badge: reconcileEntries.length > 0 ? 'All confirmed' : null,
      entries: reconcileEntries,
    },
    {
      id: 'first-pass-diags',
      title: 'First-pass diagnostics & null checks',
      badge: diagsReviewed.length > 0 ? 'All cleared' : null,
      entries: diagsReviewed,
    },
  ]
}

function buildPreparerActivityLog(snapshot: HandoffSnapshot): ActivityLogCategory[] {
  return buildActivityLog(snapshot, firstName(snapshot.actorLabel))
}

function buildExecutiveBrief(snapshot: HandoffSnapshot): { paragraphs: string[]; syncedAt: string } {
  const paragraphs: string[] = []
  if (snapshot.story.length > 0) {
    paragraphs.push(...snapshot.story)
  } else {
    paragraphs.push(snapshot.verdict.detail)
  }
  if (snapshot.verdict.tone === 'attention' && snapshot.verdict.title) {
    paragraphs.push(snapshot.verdict.title)
  }
  return {
    paragraphs,
    syncedAt: 'Synced just now',
  }
}

function buildSignOffStatus(
  allPhasesComplete: boolean,
  outstandingOpenCount: number,
  checklist: ReviewChecklistState,
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
    const incomplete = checklist.items.filter(i => i.required && !i.complete).length
    if (incomplete > 0) {
      blockers.push(
        incomplete === 1
          ? '1 checklist item still needs attestation'
          : `${incomplete} checklist items still need attestation`,
      )
    }
  }
  const blockerText =
    blockers.length === 0
      ? 'Complete the strategic checklist before you sign off.'
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
    outstandingOpenCount,
    manualChecklistItems,
    syncedAt,
    reviewPass,
    showStrategicChecklist,
    isPreparer,
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
    viewMode === 'reviewer-strategic'
      ? buildPhases(checklist, snapshot, manualChecklistItems)
      : []

  const allPhasesComplete = phases.length > 0 ? allRequiredPhasesComplete(phases) : checklist.allRequiredComplete

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
      viewMode === 'reviewer-strategic' ? buildExecutiveBrief(snapshot) : null,
    phases,
    activityLog,
    signOff: buildSignOffStatus(allPhasesComplete, outstandingOpenCount, checklist),
    allPhasesComplete,
  }
}

export function canApproveSignOff(brief: SmartReviewBrief): boolean {
  return brief.signOff.ready
}
