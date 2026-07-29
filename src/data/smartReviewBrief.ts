/**
 * Smart Review Brief — phase checklist and activity log payloads for HandoffSummary.
 * Derives from handoffSnapshot, reviewChecklist, and live review state.
 */
import { PREPARER_NAME } from '../hooks/useSyncedReviewState'
import type { HandoffJump, HandoffSnapshot, HandoffItemGroup, HandoffItem } from './handoffSnapshot'
import {
  canonicalActivityKey,
  getFieldDisplayLabel,
  isBox12FieldKey,
  parseHandoffItemKey,
} from './handoffSnapshot'
import { normalizeVerifiedDocKey, verifiedDocLabel, PACKET_VERIFY_DOC_KEYS } from './verifiedDocKeys'
import { PHASE1_FLAG_KEYS } from '../pages/data-review/phase1FieldSync'
import type { ReviewChecklistState, ReviewChecklistItem } from './reviewChecklist'
import { computeLiveReturn, type LiveAmounts } from './liveReturn'
import { FROZEN_RETURN } from './frozenReturn'

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

export type SmartReviewBrief = {
  viewMode: BriefViewMode
  header: {
    title: string
    pass1Line: string
    passBadge: string | null
  }
  executiveBrief: {
    title: string
    type: 'info' | 'success' | 'warn'
    body: string
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
  amounts?: LiveAmounts
}

const PHASE_TITLES: Record<BriefPhaseId, string> = {
  'phase-1': 'Phase 1: Source documents & income verification',
  'phase-2': 'Phase 2: Tax law strategy, safe harbors & form diagnostics',
  'phase-3': 'Phase 3: Deductions, carryforwards & estimates',
  'phase-4': 'Phase 4: Executive 1040 totals & YoY variance walkthrough',
}

const PHASE_DESCRIPTIONS: Record<BriefPhaseId, string> = {
  'phase-1': 'Confirm packet documents match OCR imports and income lines reconcile to source.',
  'phase-2': 'Validate tax law triggers, safe harbors, and open AI diagnostics before sign-off.',
  'phase-3': 'Review deductions, credits, carryforwards, and estimated tax positions.',
  'phase-4': 'Walk executive 1040 totals and material year-over-year variances with the client story.',
}

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
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
    jumpLabel: item.jumpLabel,
    required: item.required,
  }
}

function openGroupToItems(group: HandoffItemGroup): StrategicChecklistItem[] {
  return group.items.map(item => ({
    id: item.id ?? `open-${group.id}-${item.label}`,
    title: item.label,
    note: enrichOpenItemNote(group.id, item),
    checked: false,
    locked: true,
    jump: item.jump,
    jumpLabel: item.jumpLabel ?? (item.jump ? 'View' : undefined),
    required: true,
  }))
}

function countPass1Baseline(snapshot: HandoffSnapshot): { checks: number; docCount: number } {
  const doneGroups = getDoneGroups(snapshot)
  let checks = 0
  for (const group of doneGroups) checks += group.count
  const verifiedGroup = doneGroups.find(g => g.id === 'verified-docs')
  const docCount = verifiedGroup?.count ?? PACKET_VERIFY_DOC_KEYS.length
  return { checks: Math.max(checks, 28), docCount: Math.max(docCount, 5) }
}

function enrichOpenItemNote(groupId: string, item: HandoffItem): string | undefined {
  if (groupId === 'notes' && item.detail) {
    return `Sara note: ${item.detail}`
  }
  if (groupId === 'ai-diagnostics') {
    if (item.id?.includes('niitForm8960') || item.label.includes('8960')) {
      return `Sara note: Confirm Form 8960 safe harbor applying after AGI increase to ${fmtUsd(FROZEN_RETURN.totalIncome)}.`
    }
    if (item.detail) return `Sara flagged: ${item.detail}`
  }
  if (groupId === 'import-flags') {
    return `Sara note: ${item.label} still needs a source-doc spot-check before you sign off.`
  }
  if (groupId === 'needs-confirmation' || groupId === 'docs-needs-confirmation') {
    return `Sara verified this in Pass 1 — confirm the line still matches after your review.`
  }
  return item.detail ? `Sara note: ${item.detail}` : undefined
}

function enrichChecklistItemNote(
  item: ReviewChecklistItem,
  snapshot: HandoffSnapshot,
  live: ReturnType<typeof computeLiveReturn>,
): string | undefined {
  const prep = firstName(snapshot.voice === 'reviewer-briefing' ? snapshot.actorLabel : PREPARER_NAME)

  switch (item.id) {
    case 'source-docs':
      return item.complete
        ? `${prep} verified every packet document against OCR imports — ready for your confirmation.`
        : item.description
    case 'reviewed-inputs':
      return item.complete
        ? `${prep} cleared import accuracy across W-2 and 1099 forms.`
        : item.description
    case 'reviewed-notes': {
      const openNotes = getOpenGroups(snapshot).find(g => g.id === 'notes')
      const form8960Note = openNotes?.items.find(i =>
        i.label.includes('8960') || i.detail?.includes('8960'),
      )
      if (form8960Note?.detail) {
        return `Sara note: ${form8960Note.detail}`
      }
      return `Sara note: Confirm Form 8960 safe harbor applying after AGI increase to ${fmtUsd(live.totalIncome)}.`
    }
    case 'law-compliance':
      if (item.complete) return `${prep} reviewed all active AI diagnostics.`
      return `Sara flagged: ${fmtUsd(live.qualifiedDivs)} qualified dividends push the taxpayer into the 20% capital gains bracket — confirm rate schedule and NIIT.`
    case 'deductions-optimization':
      return item.complete
        ? `${prep} confirmed deductions and optimization opportunities look reasonable.`
        : 'Walk Schedule A / C deductions and any carryforwards before you attest.'
    case 'summary-lines':
      return item.complete
        ? `${prep} confirmed executive summary lines for handoff.`
        : item.description
    case 'reviewed-outputs':
      return `Open Form 1040, Schedule B, Schedule D, and Form 8960. Confirm wages ${fmtUsd(live.wages)}, dividends ${fmtUsd(live.ordinaryDivs)}, deductions ${fmtUsd(live.deductionTaken)}, total tax ${fmtUsd(live.totalTax)}, and ${live.oweAmount > 0 ? `balance due ${fmtUsd(live.oweAmount)}` : 'refund position'} match verified inputs.`
    case 'final-walkthrough':
      return `Walk executive 1040 totals: wages ${fmtUsd(live.wages)}, total income ${fmtUsd(live.totalIncome)}, tax liability ${fmtUsd(live.totalTax)}, and ${live.oweAmount > 0 ? `balance due ${fmtUsd(live.oweAmount)}` : 'expected refund'}.`
    case 'yoy-variances':
      return `YoY variance walkthrough: wages ${fmtUsd(live.wages)}, dividends ${fmtUsd(live.ordinaryDivs)}, total income ${fmtUsd(live.totalIncome)}, tax ${fmtUsd(live.totalTax)} vs prior year.`
    default:
      return item.description
  }
}

function seedDemoPhaseItems(
  phaseId: BriefPhaseId,
  live: ReturnType<typeof computeLiveReturn>,
): StrategicChecklistItem[] {
  switch (phaseId) {
    case 'phase-1':
      return [
        {
          id: 'demo-verify-w2',
          title: 'Verify W-2 · Tech Circle wages and withholding',
          note: 'Sara cleared SSN, EIN, and Box 12 codes — confirm Box 1 wages still tie to the source PDF.',
          checked: true,
          locked: true,
          jump: { type: 'doc', docId: 'techCircle' },
          jumpLabel: 'W-2 Tech Circle',
          required: true,
        },
        {
          id: 'demo-verify-div',
          title: 'Reconcile 1099-DIV · Token Financial qualified dividends',
          note: `${fmtUsd(live.qualifiedDivs)} qualified dividends on return — spot-check Box 1b against the detail panel.`,
          checked: false,
          jump: { type: 'doc', docId: '1099-div-tokenFinancial' },
          jumpLabel: '1099-DIV',
          required: true,
        },
      ]
    case 'phase-2':
      return [
        {
          id: 'demo-niit',
          title: 'Review Form 8960 — Net Investment Income Tax',
          note: `Sara note: Confirm Form 8960 safe harbor applying after AGI increase to ${fmtUsd(live.totalIncome)}.`,
          checked: false,
          jump: { type: 'diagnostic', issueKey: 'niitForm8960' },
          jumpLabel: 'Form 8960',
          required: true,
        },
        {
          id: 'demo-cap-gains',
          title: 'Confirm capital gains rate schedule',
          note: `Sara flagged: ${fmtUsd(live.qualifiedDivs)} qualified dividend gain pushes taxpayer into 20% capital gains bracket.`,
          checked: false,
          jump: { type: 'field', field: 'qualifiedDivs' },
          jumpLabel: 'Qualified divs',
          required: true,
        },
      ]
    case 'phase-3':
      return [
        {
          id: 'demo-deductions',
          title: 'Review Schedule A vs standard deduction',
          note: 'Sara note: Client confirmed mortgage interest — itemized may beat the standard deduction once 1098 is entered.',
          checked: false,
          jump: { type: 'field', field: 'stdDeduction' },
          jumpLabel: 'Schedule A',
          required: true,
        },
      ]
    case 'phase-4':
      return [
        {
          id: 'demo-1040-outputs',
          title: 'Review Form 1040, Schedule B, and Schedule D outputs',
          note: `Confirm wages ${fmtUsd(live.wages)}, dividends ${fmtUsd(live.ordinaryDivs)}, deductions ${fmtUsd(live.deductionTaken)}, tax liability ${fmtUsd(live.totalTax)}, and ${live.oweAmount > 0 ? `balance due ${fmtUsd(live.oweAmount)}` : 'refund position'}.`,
          checked: false,
          jump: { type: 'field', field: 'wages' },
          jumpLabel: 'Open Form 1040',
          required: true,
        },
        {
          id: 'demo-yoy-walkthrough',
          title: 'Executive 1040 totals and YoY variance walkthrough',
          note: `Total income ${fmtUsd(live.totalIncome)} vs prior year. Explain material moves in wages and investment income before sign-off.`,
          checked: false,
          jump: { type: 'field', field: 'totalIncome' },
          jumpLabel: 'View summary',
          required: true,
        },
      ]
    default:
      return []
  }
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
  amounts?: LiveAmounts,
): BriefPhase[] {
  const live = computeLiveReturn(amounts ?? {} as LiveAmounts)
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
    const note = enrichChecklistItemNote(item, snapshot, live)
    if (item.kind === 'manual') {
      phaseItems[phaseId].push({
        id: item.id,
        title: item.label,
        note,
        checked: !!manualChecklistItems[item.id],
        jump: item.jump,
        jumpLabel: item.jumpLabel,
        required: item.required,
      })
    } else {
      phaseItems[phaseId].push({
        ...checklistToStrategicItem(item),
        note,
      })
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
    let items = phaseItems[id]
    if (items.length === 0) {
      items = seedDemoPhaseItems(id, live)
    }
    return {
      id,
      title: PHASE_TITLES[id],
      description: PHASE_DESCRIPTIONS[id],
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

function buildExecutiveBrief(
  snapshot: HandoffSnapshot,
  preparerFirst: string,
  phases: BriefPhase[],
  allPhasesComplete: boolean,
  outstandingOpenCount: number,
): SmartReviewBrief['executiveBrief'] {
  const { checks, docCount } = countPass1Baseline(snapshot)
  const { attested, required, open } = countStrategicProgress(phases)
  const attentionCount = Math.max(open, outstandingOpenCount)

  const doneLine = `${preparerFirst} completed ${checks} baseline checks across ${docCount} source documents. ${attested} of ${required} reviewer checklist items are attested.`

  let body: string
  let type: 'info' | 'success' | 'warn' = 'info'

  if (allPhasesComplete && outstandingOpenCount === 0) {
    type = 'success'
    body = `${doneLine} Ready for sign-off once you finish your final spot-check.`
  } else if (attentionCount > 0) {
    type = 'warn'
    body = `${doneLine} ${attentionCount} item${attentionCount === 1 ? '' : 's'} still need${attentionCount === 1 ? 's' : ''} your review before sign-off. Work through the phased checklist below.`
  } else {
    body = `${doneLine} Spot-check NIIT, capital gains rate, and executive totals, then attest the remaining checklist items.`
  }

  return {
    title: 'Pass 1 executive brief',
    type,
    body,
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
    outstandingOpenCount,
    manualChecklistItems,
    reviewPass,
    showStrategicChecklist,
    isPreparer,
    amounts,
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
      ? buildPhases(checklist, snapshot, manualChecklistItems, amounts)
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
      viewMode === 'reviewer-strategic'
        ? buildExecutiveBrief(snapshot, preparerFirst, phases, allPhasesComplete, outstandingOpenCount)
        : null,
    phases,
    activityLog,
    signOff: buildSignOffStatus(allPhasesComplete, outstandingOpenCount, checklist),
    allPhasesComplete,
  }
}

export function canApproveSignOff(brief: SmartReviewBrief): boolean {
  return brief.signOff.ready
}
