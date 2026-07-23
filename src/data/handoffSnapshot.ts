/**
 * C2 handoff snapshot — conversational storyline for preparer sign-off and reviewer briefing.
 */
import type { ActivityEntry } from '../hooks/useSyncedReviewState'
import { computeLiveReturn, type LiveAmounts } from './liveReturn'
import {
  PHASE1_FLAG_KEYS,
  isPhase1FlagResolved,
  type Phase1FlagKey,
} from '../pages/data-review/phase1FieldSync'
import {
  getPhase2Progress,
  type Phase2IssueKey,
} from '../pages/data-review/phase2FlagSync'
import type { Note } from '../pages/data-review/NotesPane'

export type HandoffMode =
  | 'signoff-review'
  | 'pass-to-reviewer'
  | 'finish-and-file'
  | 'awaiting-reviewer'

export type HandoffVoice = 'self' | 'reviewer-briefing'

export type HandoffJump =
  | { type: 'field'; field: string }
  | { type: 'doc'; docId: string }
  | { type: 'note'; noteId: string }
  | { type: 'diagnostic'; issueKey: string }
  | { type: 'notesPane' }

export type HandoffItem = {
  /** Stable anchor id for open-item subnav (open items only) */
  id?: string
  label: string
  detail?: string
  status: 'done' | 'open' | 'info'
  jump?: HandoffJump
  jumpLabel?: string
}

export type HandoffItemGroup = {
  id: string
  title: string
  count: number
  countLabel: string
  defaultOpen?: boolean
  items: HandoffItem[]
}

export type HandoffOpenNavItem = {
  id: string
  label: string
}

export type HandoffSection = {
  id: string
  title: string
  /** Optional lead-in under the section title */
  intro?: string
  /** Badge count — total granular items for open sections */
  count: number
  /** Accessible label for the count, e.g. "3 open" */
  countLabel: string
  bucket: 'critical' | 'done'
  defaultOpen?: boolean
  items: HandoffItem[]
  /** Second-level grouping for open items (notes, flags, diagnostics, etc.) */
  groups?: HandoffItemGroup[]
}

export type HandoffSnapshot = {
  mode: HandoffMode
  pass: 1 | 2
  actorLabel: string
  voice: HandoffVoice
  /** Short narrative before the lists */
  story: string[]
  verdict: {
    tone: 'clear' | 'attention'
    title: string
    detail: string
  }
  sections: HandoffSection[]
  /** Jump targets for open-item subnav; empty when nothing is open */
  openNav: HandoffOpenNavItem[]
  nextSteps: string[]
  quickLinks: {
    id: string
    label: string
    count: number
    jump?: HandoffJump
    sectionId?: string
  }[]
}

export type HandoffInputs = {
  reviewedFields: Map<string, ActivityEntry>
  verifiedDocs: Set<string>
  verifiedDocsMeta?: Map<string, ActivityEntry>
  editedFields: Map<string, ActivityEntry>
  summaryChecked: Map<string, ActivityEntry>
  summaryFlagged: Map<string, ActivityEntry>
  summaryFlagNotes: Record<string, string>
  notes: Note[]
  amounts: LiveAmounts
}

const DIAG_LABELS: Record<Phase2IssueKey, string> = {
  importMismatches: 'Import mismatches',
  underpaymentRisk: 'Underpayment risk',
  necScheduleC: 'NEC → Schedule C',
  niitForm8960: 'NIIT Form 8960',
  optItemize: 'Itemize opportunity',
}

const FLAG_LABELS: Record<string, string> = {
  'ssn-techCircle': 'W-2 SSN',
  'wages-techCircle': 'W-2 wages',
  box12: 'W-2 Box 12',
  'ein-techCircle': 'W-2 EIN',
  divCollectibles: '1099-DIV collectibles',
  divNonDiv: '1099-DIV non-dividend',
  fedTaxWithheld: 'Federal tax withheld',
  taxableInterest: 'Taxable interest',
  'grossDistrib-meridian': '1099-R gross distribution',
  'ordinaryDivs-northmark': 'Ordinary dividends (Northmark)',
}

const DOC_LABELS: Record<string, string> = {
  'w2-techCircle': 'W-2 · Tech Circle',
  '1099-div-northmark': '1099-DIV · Northmark',
  '1099-div-beacon': '1099-DIV · Beacon',
  '1099-div-token': '1099-DIV · Token',
  '1099-int-harborline': '1099-INT · Harborline',
  '1099-int-cascade': '1099-INT · Cascade',
  '1099-int-unwavering': '1099-INT · Unwavering',
  '1099-r-meridian': '1099-R · Meridian',
  '1099-nec': '1099-NEC · Summit',
}

const FLAG_TO_DOC: Record<string, string> = {
  'ssn-techCircle': 'w2-techCircle',
  'wages-techCircle': 'w2-techCircle',
  box12: 'w2-techCircle',
  'ein-techCircle': 'w2-techCircle',
  divCollectibles: '1099-div-token',
  divNonDiv: '1099-div-token',
  fedTaxWithheld: '1099-div-token',
  taxableInterest: '1099-int-unwavering',
  'grossDistrib-meridian': '1099-r-meridian',
  'ordinaryDivs-northmark': '1099-div-northmark',
}

const KNOWN_DOCS = [
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)
}

export function formatCheckMeta(entry: ActivityEntry): string {
  return `${initials(entry.by)} · ${entry.at}`
}

function fieldLabel(key: string): string {
  return FLAG_LABELS[key] ?? key
}

function docLabel(docId: string): string {
  return DOC_LABELS[docId] ?? docId
}

function editTouchesFlag(editKey: string, flagKey: string): boolean {
  if (editKey === flagKey) return true
  const base = flagKey.split('-')[0]
  return editKey === base || editKey.startsWith(`${base}-`) || flagKey.startsWith(`${editKey}-`)
}

function docRelatedEdits(docId: string, editKeys: string[]): string[] {
  return editKeys.filter(k => {
    const mapped = FLAG_TO_DOC[k]
    if (mapped === docId) return true
    if (docId.startsWith('w2') && (k.startsWith('wages') || k === 'ssn' || k === 'ein' || k.startsWith('box12'))) return true
    if (docId.includes('div') && (k.includes('Div') || k.includes('div') || k === 'fedTaxWithheld')) return true
    if (docId.includes('int') && (k.includes('Interest') || k.includes('interest') || k.includes('taxExempt'))) return true
    if (docId.includes('1099-r') && (k.includes('grossDistrib') || k.includes('r-') || k.includes('ira'))) return true
    if (docId.includes('nec') && (k.includes('nec') || k.includes('otherIncome'))) return true
    return false
  })
}

function listPhrase(parts: string[], max = 3): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  const shown = parts.slice(0, max)
  const rest = parts.length - shown.length
  if (rest <= 0) {
    return `${shown.slice(0, -1).join(', ')}, and ${shown[shown.length - 1]}`
  }
  return `${shown.join(', ')}, and ${rest} more`
}

export function jumpActionLabel(jump: HandoffJump): string {
  switch (jump.type) {
    case 'field':
      return 'View field'
    case 'doc':
      return 'Open document'
    case 'note':
      return 'Open note'
    case 'notesPane':
      return 'Open notes'
    case 'diagnostic':
      return 'Open AI review'
    default:
      return 'View'
  }
}

function firstName(full: string): string {
  return full.split(/\s+/)[0] || full
}

function attentionVerdictTitle(openCount: number): string {
  return openCount === 1
    ? 'There is 1 item that needs your attention'
    : `There are ${openCount} items that need your attention`
}

function clearVerdictTitle(): string {
  return 'No items need your attention'
}

export function buildHandoffSnapshot(
  mode: HandoffMode,
  pass: 1 | 2,
  actorLabel: string,
  input: HandoffInputs,
  options?: { voice?: HandoffVoice },
): HandoffSnapshot {
  const voice: HandoffVoice = options?.voice ?? 'self'
  const isBriefing = voice === 'reviewer-briefing'
  const who = firstName(actorLabel)

  const phase1Keys = PHASE1_FLAG_KEYS as readonly Phase1FlagKey[]
  const clearedFlags = phase1Keys.filter(k => isPhase1FlagResolved(k, input.reviewedFields))
  const openImportFlags = phase1Keys.filter(k => !isPhase1FlagResolved(k, input.reviewedFields))

  const live = computeLiveReturn(input.amounts)
  const p2 = getPhase2Progress({
    reviewedFields: input.reviewedFields,
    live,
    amounts: input.amounts,
  })
  const diagsReviewed = p2.activeKeys.filter(k => input.reviewedFields.has(k))
  const diagsOpenRaw = p2.activeKeys.filter(k => !input.reviewedFields.has(k))
  // Phase 1 import flags and the importMismatches diagnostic describe the same gaps.
  // Keep field-level flags under Import flags; drop importMismatches from AI diagnostics
  // while any Phase 1 import flags remain open so the handoff list does not double-count.
  const diagsOpen =
    openImportFlags.length > 0
      ? diagsOpenRaw.filter(k => k !== 'importMismatches')
      : diagsOpenRaw

  const openNotes = input.notes.filter(n => (n.status ?? 'open') === 'open')
  const verifiedList = [...input.verifiedDocs]
  const unverifiedDocs = KNOWN_DOCS.filter(d => !input.verifiedDocs.has(d))

  const checks = [...input.summaryChecked.entries()]
  const humanFlags = [...input.summaryFlagged.entries()]
  const edits = [...input.editedFields.entries()]
  const editKeys = edits.map(([k]) => k)
  const editedClears = clearedFlags.filter(k => editKeys.some(ek => editTouchesFlag(ek, k)))
  const markedOnly = clearedFlags.filter(k => !editKeys.some(ek => editTouchesFlag(ek, k)))

  // ── Still open — granular items grouped by category ───────────────────
  const openGroups: HandoffItemGroup[] = []

  if (openNotes.length) {
    openGroups.push({
      id: 'notes',
      title: 'Notes',
      count: openNotes.length,
      countLabel: `${openNotes.length} note${openNotes.length === 1 ? '' : 's'}`,
      items: openNotes.map(n => ({
        id: `note-${n.id}`,
        label: n.context
          ? isBriefing
            ? `Note on ${n.context}`
            : `Your note on ${n.context}`
          : 'Open note',
        detail: n.text,
        status: 'open' as const,
        jump: { type: 'note' as const, noteId: n.id },
        jumpLabel: 'Read note',
      })),
    })
  }

  if (openImportFlags.length) {
    openGroups.push({
      id: 'import-flags',
      title: 'Import flags',
      count: openImportFlags.length,
      countLabel: `${openImportFlags.length} open import flag${openImportFlags.length === 1 ? '' : 's'}`,
      items: openImportFlags.map(flag => ({
        id: `import-${flag}`,
        label: fieldLabel(flag),
        detail: isBriefing
          ? 'Still needs a look against the source document.'
          : 'Import flag still open.',
        status: 'open' as const,
        jump: { type: 'field' as const, field: flag },
        jumpLabel: 'View field',
      })),
    })
  }

  if (diagsOpen.length) {
    openGroups.push({
      id: 'ai-diagnostics',
      title: 'AI diagnostics',
      count: diagsOpen.length,
      countLabel: `${diagsOpen.length} AI diagnostic${diagsOpen.length === 1 ? '' : 's'}`,
      items: diagsOpen.map(k => ({
        id: `diag-${k}`,
        label: DIAG_LABELS[k] ?? k,
        detail: isBriefing
          ? 'Not marked reviewed in Pass 1. Finish import accuracy first.'
          : 'Not marked reviewed yet.',
        status: 'open' as const,
        jump: { type: 'diagnostic' as const, issueKey: k },
        jumpLabel: 'Open AI review',
      })),
    })
  }

  if (unverifiedDocs.length) {
    openGroups.push({
      id: 'unverified-docs',
      title: 'Unverified docs',
      count: unverifiedDocs.length,
      countLabel: `${unverifiedDocs.length} unverified doc${unverifiedDocs.length === 1 ? '' : 's'}`,
      items: unverifiedDocs.map(docId => ({
        id: `doc-${docId}`,
        label: docLabel(docId),
        status: 'open' as const,
        jump: { type: 'doc' as const, docId },
        jumpLabel: 'Open document',
      })),
    })
  }

  if (humanFlags.length) {
    openGroups.push({
      id: 'preparer-flags',
      title: 'Preparer flags',
      count: humanFlags.length,
      countLabel: `${humanFlags.length} preparer flag${humanFlags.length === 1 ? '' : 's'}`,
      items: humanFlags.map(([field, meta]) => {
        const note = input.summaryFlagNotes[field]
        const name = fieldLabel(field) !== field ? fieldLabel(field) : field
        return {
          id: `flag-${field}`,
          label: isBriefing ? `${name} flagged for follow-up` : `Flagged: ${name}`,
          detail: note
            ? `"${note}" · ${formatCheckMeta(meta)}`
            : `Marked for follow-up · ${formatCheckMeta(meta)}`,
          status: 'open' as const,
          jump: { type: 'field' as const, field },
          jumpLabel: 'View field',
        }
      }),
    })
  }

  const granularOpenCount = openGroups.reduce((sum, g) => sum + g.count, 0)

  // ── What happened (connected story) ───────────────────────────────────
  const doneItems: HandoffItem[] = []

  if (editedClears.length || markedOnly.length) {
    if (editedClears.length) {
      doneItems.push({
        label: isBriefing
          ? `Edited ${editedClears.length} field${editedClears.length === 1 ? '' : 's'} to clear import flags`
          : `Edited to clear ${editedClears.length} import flag${editedClears.length === 1 ? '' : 's'}`,
        detail: listPhrase(editedClears.map(fieldLabel)),
        status: 'done',
        jump: { type: 'field', field: editedClears[0] },
        jumpLabel: 'View field',
      })
    }
    if (markedOnly.length) {
      doneItems.push({
        label: isBriefing
          ? `Marked ${markedOnly.length} flagged field${markedOnly.length === 1 ? '' : 's'} correct without changing amounts`
          : `Marked ${markedOnly.length} correct, no amount edit`,
        detail: listPhrase(markedOnly.map(fieldLabel)),
        status: 'done',
        jump: { type: 'field', field: markedOnly[0] },
        jumpLabel: 'View field',
      })
    }
  }

  const extraChecks = checks.filter(([field]) => !clearedFlags.includes(field as Phase1FlagKey))
  if (extraChecks.length) {
    const editedOnes = extraChecks.filter(([field]) => editKeys.some(ek => editTouchesFlag(ek, field)))
    const reviewOnly = extraChecks.filter(([field]) => !editKeys.some(ek => editTouchesFlag(ek, field)))
    if (editedOnes.length) {
      doneItems.push({
        label: isBriefing
          ? `Also edited and checked ${editedOnes.length} summary line${editedOnes.length === 1 ? '' : 's'}`
          : `Edited and checked ${editedOnes.length} summary line${editedOnes.length === 1 ? '' : 's'}`,
        detail: listPhrase(editedOnes.map(([f]) => f)),
        status: 'done',
        jump: { type: 'field', field: editedOnes[0][0] },
        jumpLabel: 'View field',
      })
    }
    if (reviewOnly.length) {
      doneItems.push({
        label: isBriefing
          ? `Reviewed ${reviewOnly.length} summary line${reviewOnly.length === 1 ? '' : 's'} without edits`
          : `Reviewed ${reviewOnly.length} line${reviewOnly.length === 1 ? '' : 's'} without edits`,
        detail: listPhrase(reviewOnly.map(([f]) => f)),
        status: 'done',
        jump: { type: 'field', field: reviewOnly[0][0] },
        jumpLabel: 'View field',
      })
    }
  }

  const orphanEdits = edits.filter(
    ([k]) => !clearedFlags.some(f => editTouchesFlag(k, f)) && !checks.some(([c]) => editTouchesFlag(k, c)),
  )
  if (orphanEdits.length) {
    doneItems.push({
      label: `${orphanEdits.length} other amount change${orphanEdits.length === 1 ? '' : 's'}`,
      detail: listPhrase(orphanEdits.map(([k, meta]) => `${k} (${formatCheckMeta(meta)})`), 4),
      status: 'info',
      jump: { type: 'field', field: orphanEdits[0][0] },
      jumpLabel: 'View field',
    })
  }

  if (verifiedList.length) {
    const cleanDocs = verifiedList.filter(docId => {
      const relatedFlags = clearedFlags.filter(f => FLAG_TO_DOC[f] === docId)
      const relatedEdits = docRelatedEdits(docId, editKeys)
      return relatedFlags.length === 0 && relatedEdits.length === 0
    })
    const touchedDocs = verifiedList.filter(docId => !cleanDocs.includes(docId))

    if (touchedDocs.length) {
      doneItems.push({
        label: isBriefing
          ? `Verified ${touchedDocs.length} document${touchedDocs.length === 1 ? '' : 's'} after working flags or edits`
          : `Verified ${touchedDocs.length} document${touchedDocs.length === 1 ? '' : 's'} with related work`,
        detail: listPhrase(touchedDocs.map(docLabel)),
        status: 'done',
        jump: { type: 'doc', docId: touchedDocs[0] },
        jumpLabel: 'Open document',
      })
    }
    if (cleanDocs.length) {
      doneItems.push({
        label: isBriefing
          ? `Verified ${cleanDocs.length} document${cleanDocs.length === 1 ? '' : 's'} with no flags or edits`
          : `Verified ${cleanDocs.length} clean document${cleanDocs.length === 1 ? '' : 's'}`,
        detail: listPhrase(cleanDocs.map(docLabel)),
        status: 'done',
        jump: { type: 'doc', docId: cleanDocs[0] },
        jumpLabel: 'Open document',
      })
    }
  }

  if (diagsReviewed.length) {
    doneItems.push({
      label: isBriefing
        ? `Walked through ${diagsReviewed.length} AI diagnostic${diagsReviewed.length === 1 ? '' : 's'}`
        : `Reviewed ${diagsReviewed.length} AI diagnostic${diagsReviewed.length === 1 ? '' : 's'}`,
      detail: listPhrase(diagsReviewed.map(k => DIAG_LABELS[k] ?? k)),
      status: 'done',
      jump: { type: 'diagnostic', issueKey: diagsReviewed[0] },
      jumpLabel: 'Open AI review',
    })
  }

  if (doneItems.length === 0) {
    doneItems.push({
      label: isBriefing
        ? `${who} hasn’t recorded edits, checks, or verified docs yet`
        : 'No completed actions recorded yet',
      detail: 'As work happens, it’ll show up here as the story of the pass.',
      status: 'info',
    })
  }

  const doneOnlyCount = doneItems.filter(i => i.status === 'done').length
  const hasOpen = granularOpenCount > 0

  // ── Conversational story + verdict ────────────────────────────────────
  const story: string[] = []
  if (isBriefing) {
    story.push(`${actorLabel} concluded her review. This is what you should know before you start Pass 2.`)
    const beats: string[] = []
    if (clearedFlags.length) {
      beats.push(
        editedClears.length && markedOnly.length
          ? `cleared ${clearedFlags.length} import flags (${editedClears.length} with edits, ${markedOnly.length} marked correct as-is)`
          : editedClears.length
            ? `cleared ${clearedFlags.length} import flag${clearedFlags.length === 1 ? '' : 's'} with edits`
            : `cleared ${clearedFlags.length} import flag${clearedFlags.length === 1 ? '' : 's'} without changing amounts`,
      )
    }
    if (verifiedList.length) beats.push(`verified ${verifiedList.length} source document${verifiedList.length === 1 ? '' : 's'}`)
    if (diagsReviewed.length) beats.push(`reviewed ${diagsReviewed.length} AI diagnostic${diagsReviewed.length === 1 ? '' : 's'}`)
    if (edits.length && !editedClears.length) beats.push(`made ${edits.length} amount change${edits.length === 1 ? '' : 's'}`)
    if (beats.length) {
      story.push(`In Pass 1, ${who} ${listPhrase(beats)}.`)
    } else if (!hasOpen) {
      story.push(`Pass 1 does not show much completed work yet. Consider a fuller first pass before AI diagnostics.`)
    }
    if (openNotes.length) {
      story.push(
        openNotes.length === 1
          ? 'There is 1 open note. Read it first for the preparer’s intent in their own words.'
          : `There are ${openNotes.length} open notes. Read those first for the preparer’s intent in their own words.`,
      )
    }
  } else {
    story.push(
      pass === 2
        ? `Here’s where Pass 2 stands with your work, ${who}.`
        : `Here’s where this pass stands: what’s still open, then what you’ve already handled.`,
    )
    if (clearedFlags.length || verifiedList.length || diagsReviewed.length) {
      const bits: string[] = []
      if (clearedFlags.length) bits.push(`${clearedFlags.length} import flag${clearedFlags.length === 1 ? '' : 's'} cleared`)
      if (verifiedList.length) bits.push(`${verifiedList.length} doc${verifiedList.length === 1 ? '' : 's'} verified`)
      if (diagsReviewed.length) bits.push(`${diagsReviewed.length} diagnostic${diagsReviewed.length === 1 ? '' : 's'} reviewed`)
      story.push(`So far you’ve got ${listPhrase(bits)}.`)
    }
  }

  const openBreakdown = [
    openNotes.length ? `${openNotes.length} note${openNotes.length === 1 ? '' : 's'}` : null,
    openImportFlags.length ? `${openImportFlags.length} open import flag${openImportFlags.length === 1 ? '' : 's'}` : null,
    diagsOpen.length ? `${diagsOpen.length} AI diagnostic${diagsOpen.length === 1 ? '' : 's'}` : null,
    unverifiedDocs.length ? `${unverifiedDocs.length} unverified doc${unverifiedDocs.length === 1 ? '' : 's'}` : null,
    humanFlags.length ? `${humanFlags.length} preparer flag${humanFlags.length === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const verdict = !hasOpen
    ? {
        tone: 'clear' as const,
        title: clearVerdictTitle(),
        detail: isBriefing
          ? 'No open flags, notes, or unverified docs in this snapshot. Spot-check Pass 1 work, then move through AI diagnostics if you want a second opinion.'
          : 'No open anomalies, flags, or notes in this snapshot.',
      }
    : {
        tone: 'attention' as const,
        title: attentionVerdictTitle(granularOpenCount),
        detail: isBriefing
          ? `${openBreakdown}.`
          : `${openBreakdown}. Work through open notes and flags first, then AI diagnostics and any documents still unverified.`,
      }

  const storySection: HandoffSection = {
    id: 'whatWasDone',
    title: isBriefing ? `What ${who} did in Pass 1` : 'What happened this pass',
    count: doneOnlyCount,
    countLabel: doneOnlyCount
      ? `${doneOnlyCount} completed`
      : 'Nothing completed yet',
    intro: isBriefing
      ? 'Edits tied to flags, clean verifies, and AI diagnostics they already reviewed.'
      : 'Edits, clears, verifies, and diagnostics you’ve already handled.',
    bucket: 'done',
    defaultOpen: true,
    items: doneItems,
  }

  const openSection: HandoffSection = {
    id: 'needsAttention',
    title: isBriefing ? 'Still open for you' : 'Still open',
    count: hasOpen ? granularOpenCount : 0,
    countLabel: hasOpen
      ? `${granularOpenCount} open`
      : 'All clear',
    intro: isBriefing
      ? 'Expand each group to see every item. Start with notes and import flags, then AI diagnostics and unverified docs.'
      : 'Clear these before you hand off or file.',
    bucket: 'critical',
    defaultOpen: true,
    groups: hasOpen ? openGroups : undefined,
    items: hasOpen
      ? []
      : [
          {
            label: isBriefing ? 'Nothing waiting on you in this snapshot' : 'Nothing critical left',
            detail: 'No open diagnostics, import flags, preparer flags, notes, or unverified docs.',
            status: 'info',
          },
        ],
  }

  // Open items first, then completed work — same order for self and reviewer briefing.
  const sections: HandoffSection[] = [openSection, storySection]

  const openNav: HandoffOpenNavItem[] = []
  const nextSteps: string[] = []

  return {
    mode,
    pass,
    actorLabel,
    voice,
    story,
    verdict,
    sections,
    openNav,
    nextSteps,
    quickLinks: [],
  }
}
