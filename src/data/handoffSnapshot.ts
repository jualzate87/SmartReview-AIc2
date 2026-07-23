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
  label: string
  detail?: string
  status: 'done' | 'open' | 'info'
  jump?: HandoffJump
  jumpLabel?: string
}

export type HandoffSection = {
  id: string
  title: string
  /** Optional lead-in under the section title */
  intro?: string
  /** Numeric badge count (IDS NumericBadge) */
  count: number
  /** Accessible label for the count, e.g. "3 open" */
  countLabel: string
  bucket: 'critical' | 'done'
  defaultOpen?: boolean
  items: HandoffItem[]
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
  const diagsOpen = p2.activeKeys.filter(k => !input.reviewedFields.has(k))

  const openNotes = input.notes.filter(n => (n.status ?? 'open') === 'open')
  const verifiedList = [...input.verifiedDocs]
  const unverifiedDocs = KNOWN_DOCS.filter(d => !input.verifiedDocs.has(d))

  const checks = [...input.summaryChecked.entries()]
  const humanFlags = [...input.summaryFlagged.entries()]
  const edits = [...input.editedFields.entries()]
  const editKeys = edits.map(([k]) => k)
  const editedClears = clearedFlags.filter(k => editKeys.some(ek => editTouchesFlag(ek, k)))
  const markedOnly = clearedFlags.filter(k => !editKeys.some(ek => editTouchesFlag(ek, k)))

  // ── Still open (grouped story beats, not a flat dump) ─────────────────
  const openItems: HandoffItem[] = []

  if (openNotes.length) {
    for (const n of openNotes) {
      openItems.push({
        label: isBriefing
          ? `${who} left a note${n.context ? ` on ${n.context}` : ''}`
          : n.context
            ? `Your note on ${n.context}`
            : 'Open note',
        detail: n.text,
        status: 'open',
        jump: { type: 'note', noteId: n.id },
        jumpLabel: 'Read note',
      })
    }
  }

  if (humanFlags.length) {
    for (const [field, meta] of humanFlags) {
      const note = input.summaryFlagNotes[field]
      openItems.push({
        label: isBriefing
          ? `${who} flagged ${fieldLabel(field) !== field ? fieldLabel(field) : field}`
          : `Flagged: ${fieldLabel(field) !== field ? fieldLabel(field) : field}`,
        detail: note
          ? `"${note}" · ${formatCheckMeta(meta)}`
          : `Marked for follow-up · ${formatCheckMeta(meta)}`,
        status: 'open',
        jump: { type: 'field', field },
        jumpLabel: 'View field',
      })
    }
  }

  if (openImportFlags.length) {
    const names = openImportFlags.map(fieldLabel)
    openItems.push({
      label: isBriefing
        ? `${openImportFlags.length} import flag${openImportFlags.length === 1 ? '' : 's'} still open`
        : `${openImportFlags.length} import flag${openImportFlags.length === 1 ? '' : 's'} still open`,
      detail: isBriefing
        ? `${who} didn’t clear these yet: ${listPhrase(names)}. Worth confirming against the source docs.`
        : `Still need a look: ${listPhrase(names)}.`,
      status: 'open',
      jump: { type: 'field', field: openImportFlags[0] },
      jumpLabel: 'View first flag',
    })
  }

  if (diagsOpen.length) {
    const names = diagsOpen.map(k => DIAG_LABELS[k] ?? k)
    openItems.push({
      label: isBriefing
        ? `AI still has ${diagsOpen.length} diagnostic${diagsOpen.length === 1 ? '' : 's'} to walk through`
        : `${diagsOpen.length} AI diagnostic${diagsOpen.length === 1 ? '' : 's'} not reviewed yet`,
      detail: isBriefing
        ? `${listPhrase(names)}. These weren’t marked reviewed in Pass 1 — pick them up after the import picture feels solid.`
        : `${listPhrase(names)} — not marked reviewed yet.`,
      status: 'open',
      jump: { type: 'diagnostic', issueKey: diagsOpen[0] },
      jumpLabel: 'Open AI review',
    })
  }

  if (unverifiedDocs.length) {
    openItems.push({
      label: isBriefing
        ? `${unverifiedDocs.length} source document${unverifiedDocs.length === 1 ? '' : 's'} not marked verified`
        : `${unverifiedDocs.length} document${unverifiedDocs.length === 1 ? '' : 's'} not verified`,
      detail: isBriefing
        ? `${who} didn’t mark these done: ${listPhrase(unverifiedDocs.map(docLabel))}.`
        : listPhrase(unverifiedDocs.map(docLabel)),
      status: 'open',
      jump: { type: 'doc', docId: unverifiedDocs[0] },
      jumpLabel: 'Open first document',
    })
  }

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
          : `Marked ${markedOnly.length} correct — no amount edit`,
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
          ? `Verified ${cleanDocs.length} document${cleanDocs.length === 1 ? '' : 's'} that looked clean — no flags or edits`
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
  const hasOpen = openItems.length > 0

  // ── Conversational story + verdict ────────────────────────────────────
  const story: string[] = []
  if (isBriefing) {
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
      story.push(`${who} ${listPhrase(beats)}.`)
    } else {
      story.push(`${who} didn’t leave much of a trail yet — you may want a fuller Pass 1 pass before you dig into AI.`)
    }
    if (openNotes.length) {
      story.push(
        openNotes.length === 1
          ? `There’s 1 open note from ${who} — start there if you want their intent in their own words.`
          : `There are ${openNotes.length} open notes from ${who} — start there if you want their intent in their own words.`,
      )
    }
  } else {
    story.push(
      pass === 2
        ? `Here’s where Pass 2 stands with your work, ${who}.`
        : `Here’s the story of this pass so far — what’s still open, then what you’ve already handled.`,
    )
    if (clearedFlags.length || verifiedList.length || diagsReviewed.length) {
      const bits: string[] = []
      if (clearedFlags.length) bits.push(`${clearedFlags.length} import flag${clearedFlags.length === 1 ? '' : 's'} cleared`)
      if (verifiedList.length) bits.push(`${verifiedList.length} doc${verifiedList.length === 1 ? '' : 's'} verified`)
      if (diagsReviewed.length) bits.push(`${diagsReviewed.length} diagnostic${diagsReviewed.length === 1 ? '' : 's'} reviewed`)
      story.push(`So far you’ve got ${listPhrase(bits)}.`)
    }
  }

  const verdict = !hasOpen
    ? {
        tone: 'clear' as const,
        title: isBriefing
          ? `${who} left you a clean handoff`
          : 'Looks clear for the next step',
        detail: isBriefing
          ? 'No open flags, notes, or unverified docs in this snapshot. Spot-check what they did, then move through AI diagnostics if you want a second opinion.'
          : 'No open anomalies, flags, or notes left in this snapshot.',
      }
    : {
        tone: 'attention' as const,
        title: isBriefing
          ? `${who} left a few things for you`
          : 'A few things still need a look',
        detail: isBriefing
          ? [
              openNotes.length ? `${openNotes.length} note${openNotes.length === 1 ? '' : 's'}` : null,
              openImportFlags.length ? `${openImportFlags.length} open import flag${openImportFlags.length === 1 ? '' : 's'}` : null,
              diagsOpen.length ? `${diagsOpen.length} AI diagnostic${diagsOpen.length === 1 ? '' : 's'}` : null,
              humanFlags.length ? `${humanFlags.length} preparer flag${humanFlags.length === 1 ? '' : 's'}` : null,
              unverifiedDocs.length ? `${unverifiedDocs.length} unverified doc${unverifiedDocs.length === 1 ? '' : 's'}` : null,
            ]
              .filter(Boolean)
              .join(' · ') + '.'
          : 'Work through open notes and flags first, then AI diagnostics and any documents still unverified.',
      }

  const storySection: HandoffSection = {
    id: 'whatWasDone',
    title: isBriefing ? `What ${who} did in Pass 1` : 'What happened this pass',
    count: doneOnlyCount,
    countLabel: doneOnlyCount
      ? `${doneOnlyCount} completed`
      : 'Nothing completed yet',
    intro: isBriefing
      ? 'This is the trail they left — edits tied to flags, clean verifies, and anything they already walked through in AI.'
      : 'Edits, clears, verifies, and diagnostics you’ve already handled.',
    bucket: 'done',
    defaultOpen: true,
    items: doneItems,
  }

  const openSection: HandoffSection = {
    id: 'needsAttention',
    title: isBriefing ? 'Still open for you' : 'Still open',
    count: hasOpen ? openItems.length : 0,
    countLabel: hasOpen
      ? `${openItems.length} open`
      : 'All clear',
    intro: isBriefing
      ? 'Suggested order: notes and flags first (intent + data accuracy), then AI diagnostics, then any docs still unverified.'
      : 'Clear these before you hand off or file.',
    bucket: 'critical',
    defaultOpen: true,
    items: hasOpen
      ? openItems
      : [
          {
            label: isBriefing ? 'Nothing waiting on you in this snapshot' : 'Nothing critical left',
            detail: 'No open diagnostics, import flags, preparer flags, notes, or unverified docs.',
            status: 'info',
          },
        ],
  }

  // Reviewer: story first, then open. Self: open first, then story.
  const sections: HandoffSection[] = isBriefing
    ? [storySection, openSection]
    : [openSection, storySection]

  const nextSteps: string[] = isBriefing
    ? [
        hasOpen
          ? `Start with ${who}’s notes and any open import flags — that context will make the AI diagnostics easier to judge.`
          : `Spot-check what ${who} verified, then walk the AI diagnostics catalog if you want a second pass.`,
        'You can reply on notes, add your own checks or flags, then wrap Pass 2 when you’re ready.',
      ]
    : mode === 'finish-and-file'
      ? [
          hasOpen
            ? 'Clear or document what’s still open before transmitting.'
            : 'Return looks clear of open follow-ups — proceed to file.',
          'Confirm e-file checklist and state returns if applicable.',
        ]
      : mode === 'pass-to-reviewer' || mode === 'signoff-review'
        ? [
            hasOpen
              ? 'If you pass this on, the next reviewer will see your open notes and flags first.'
              : 'Looks like a clean handoff — the next reviewer can spot-check your trail.',
            'They can reply on notes and add their own checks or flags.',
          ]
        : [
            'Waiting for the next reviewer.',
            'Use “Open as reviewer” to start Pass 2 in this prototype.',
          ]

  return {
    mode,
    pass,
    actorLabel,
    voice,
    story,
    verdict,
    sections,
    nextSteps,
    quickLinks: [],
  }
}
