/**
 * C2 handoff snapshot — critical-first hierarchy, then connected “what was done”.
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
  /** Button label when jump is available */
  jumpLabel?: string
}

export type HandoffSection = {
  id: string
  title: string
  /** Collapsed summary, e.g. "3 cleared" */
  summary: string
  /** critical = needs attention first; done = completed work */
  bucket: 'critical' | 'done'
  defaultOpen?: boolean
  items: HandoffItem[]
}

export type HandoffSnapshot = {
  mode: HandoffMode
  pass: 1 | 2
  actorLabel: string
  /** One-line AI / readiness verdict */
  verdict: {
    tone: 'clear' | 'attention'
    title: string
    detail: string
  }
  sections: HandoffSection[]
  nextSteps: string[]
  /** Quick-link chips for Pass 2 AI panel — keep sparse */
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

/** Map Phase 1 flag keys → related source doc ids for “connect the dots” */
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

export function buildHandoffSnapshot(
  mode: HandoffMode,
  pass: 1 | 2,
  actorLabel: string,
  input: HandoffInputs,
): HandoffSnapshot {
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

  const criticalItems: HandoffItem[] = []

  if (diagsOpen.length) {
    for (const k of diagsOpen) {
      criticalItems.push({
        label: DIAG_LABELS[k] ?? k,
        detail: 'Open AI diagnostic — not marked reviewed yet',
        status: 'open',
        jump: { type: 'diagnostic', issueKey: k },
        jumpLabel: 'Open AI review',
      })
    }
  }

  if (openImportFlags.length) {
    for (const k of openImportFlags) {
      criticalItems.push({
        label: fieldLabel(k),
        detail: 'Import / mismatch flag still open',
        status: 'open',
        jump: { type: 'field', field: k },
        jumpLabel: 'View field',
      })
    }
  }

  if (humanFlags.length) {
    for (const [field, meta] of humanFlags) {
      const note = input.summaryFlagNotes[field]
      criticalItems.push({
        label: fieldLabel(field) !== field ? fieldLabel(field) : field,
        detail: [formatCheckMeta(meta), note].filter(Boolean).join(' — ') || 'Preparer flag for follow-up',
        status: 'open',
        jump: { type: 'field', field },
        jumpLabel: 'View field',
      })
    }
  }

  if (openNotes.length) {
    for (const n of openNotes) {
      criticalItems.push({
        label: n.context ? `${n.context}` : 'Preparer note',
        detail: n.text,
        status: 'open',
        jump: { type: 'note', noteId: n.id },
        jumpLabel: 'Open note',
      })
    }
  }

  if (unverifiedDocs.length) {
    if (unverifiedDocs.length <= 3) {
      for (const docId of unverifiedDocs) {
        criticalItems.push({
          label: docLabel(docId),
          detail: 'Not marked verified',
          status: 'open',
          jump: { type: 'doc', docId },
          jumpLabel: 'Open document',
        })
      }
    } else {
      criticalItems.push({
        label: `${unverifiedDocs.length} documents not verified`,
        detail: unverifiedDocs.slice(0, 3).map(docLabel).join(', ') + ', and more',
        status: 'open',
        jump: { type: 'doc', docId: unverifiedDocs[0] },
        jumpLabel: 'Open first document',
      })
    }
  }

  const attentionCount = criticalItems.length
  const verdict =
    attentionCount === 0
      ? {
          tone: 'clear' as const,
          title: 'Looks clear for the next step',
          detail:
            diagsReviewed.length || clearedFlags.length
              ? 'No open anomalies, flags, or preparer notes left in this snapshot.'
              : 'No open items recorded — confirm the work matches your pass before finishing.',
        }
      : {
          tone: 'attention' as const,
          title: `${attentionCount} item${attentionCount === 1 ? '' : 's'} still need attention`,
          detail: 'Review open diagnostics, flags, notes, and unverified documents before handoff or filing.',
        }

  // ── What was done: connected story (fewer, denser items) ──────────────
  const doneItems: HandoffItem[] = []

  for (const k of clearedFlags) {
    const meta = input.reviewedFields.get(k)
    const edited = editKeys.some(ek => editTouchesFlag(ek, k))
    doneItems.push({
      label: fieldLabel(k),
      detail: edited
        ? `Edited to clear import flag${meta ? ` · ${formatCheckMeta(meta)}` : ''}`
        : `Marked correct — no amount edit${meta ? ` · ${formatCheckMeta(meta)}` : ''}`,
      status: 'done',
      jump: { type: 'field', field: k },
      jumpLabel: 'View field',
    })
  }

  // Summary line checks that aren’t already covered as cleared import flags
  for (const [field, meta] of checks) {
    if (clearedFlags.includes(field)) continue
    const edited = editKeys.some(ek => editTouchesFlag(ek, field))
    doneItems.push({
      label: field,
      detail: edited
        ? `Edited, then marked correct · ${formatCheckMeta(meta)}`
        : `Reviewed without edits · ${formatCheckMeta(meta)}`,
      status: 'done',
      jump: { type: 'field', field },
      jumpLabel: 'View field',
    })
  }

  // Edits that didn’t clear a flag / become a check — still worth listing briefly
  const orphanEdits = edits.filter(
    ([k]) => !clearedFlags.some(f => editTouchesFlag(k, f)) && !checks.some(([c]) => editTouchesFlag(k, c)),
  )
  if (orphanEdits.length) {
    const preview = orphanEdits.slice(0, 4).map(([k, meta]) => `${k} (${formatCheckMeta(meta)})`)
    doneItems.push({
      label: `${orphanEdits.length} other field edit${orphanEdits.length === 1 ? '' : 's'}`,
      detail: preview.join(' · ') + (orphanEdits.length > 4 ? ' · …' : ''),
      status: 'info',
      jump: orphanEdits[0] ? { type: 'field', field: orphanEdits[0][0] } : undefined,
      jumpLabel: orphanEdits[0] ? 'View field' : undefined,
    })
  }

  for (const docId of verifiedList) {
    const meta = input.verifiedDocsMeta?.get(docId)
    const relatedFlags = clearedFlags.filter(f => FLAG_TO_DOC[f] === docId)
    const relatedEdits = docRelatedEdits(docId, editKeys)
    let detail: string
    if (relatedFlags.length && relatedEdits.length) {
      detail = `Verified after clearing ${relatedFlags.length} flag${relatedFlags.length === 1 ? '' : 's'} and ${relatedEdits.length} edit${relatedEdits.length === 1 ? '' : 's'}`
    } else if (relatedFlags.length) {
      detail = `Verified after clearing ${relatedFlags.length} import flag${relatedFlags.length === 1 ? '' : 's'}`
    } else if (relatedEdits.length) {
      detail = `Verified with ${relatedEdits.length} related edit${relatedEdits.length === 1 ? '' : 's'}`
    } else {
      detail = 'Verified with no flags or edits on this document'
    }
    if (meta) detail += ` · ${formatCheckMeta(meta)}`
    doneItems.push({
      label: docLabel(docId),
      detail,
      status: 'done',
      jump: { type: 'doc', docId },
      jumpLabel: 'Open document',
    })
  }

  for (const k of diagsReviewed) {
    const meta = input.reviewedFields.get(k)
    doneItems.push({
      label: DIAG_LABELS[k] ?? k,
      detail: meta ? `Diagnostic marked reviewed · ${formatCheckMeta(meta)}` : 'Diagnostic marked reviewed',
      status: 'done',
      jump: { type: 'diagnostic', issueKey: k },
      jumpLabel: 'Open AI review',
    })
  }

  if (doneItems.length === 0) {
    doneItems.push({
      label: 'No completed actions recorded yet',
      detail: 'Edits, checks, cleared flags, verified docs, and reviewed diagnostics will show up here.',
      status: 'info',
    })
  }

  const doneOnlyCount = doneItems.filter(i => i.status === 'done').length

  const sections: HandoffSection[] = [
    {
      id: 'needsAttention',
      title: 'Needs attention',
      summary: attentionCount ? `${attentionCount} open` : 'All clear',
      bucket: 'critical',
      defaultOpen: true,
      items: attentionCount
        ? criticalItems
        : [
            {
              label: 'Nothing critical left in this snapshot',
              detail: 'No open diagnostics, import flags, preparer flags, notes, or unverified docs.',
              status: 'info',
            },
          ],
    },
    {
      id: 'whatWasDone',
      title: 'What was done',
      summary: doneOnlyCount ? `${doneOnlyCount} recorded` : 'Nothing yet',
      bucket: 'done',
      defaultOpen: attentionCount === 0,
      items: doneItems,
    },
  ]

  const quickLinks = [
    {
      id: 'needsAttention',
      label: attentionCount ? 'Needs attention' : 'All clear',
      count: attentionCount,
      sectionId: 'needsAttention',
    },
    {
      id: 'notes',
      label: openNotes.length ? 'Open notes' : 'No open notes',
      count: openNotes.length,
      jump: openNotes.length ? ({ type: 'notesPane' as const }) : undefined,
    },
    {
      id: 'whatWasDone',
      label: 'What was done',
      count: doneOnlyCount,
      sectionId: 'whatWasDone',
    },
  ]

  const nextSteps: string[] =
    mode === 'finish-and-file'
      ? [
          attentionCount
            ? 'Clear or document remaining open items before transmitting.'
            : 'Return looks clear of open follow-ups — proceed to file.',
          'Confirm e-file checklist and state returns if applicable.',
        ]
      : mode === 'pass-to-reviewer' || mode === 'signoff-review'
        ? [
            attentionCount
              ? 'Start Pass 2 from Needs attention — open flags, notes, and unverified docs first.'
              : 'Snapshot looks clear; reviewer can spot-check What was done.',
            'Reviewer can reply/resolve notes and add their own checks or flags.',
          ]
        : [
            'Waiting for the next reviewer.',
            'Use “Open as reviewer” to start Pass 2 in this prototype.',
          ]

  return { mode, pass, actorLabel, verdict, sections, nextSteps, quickLinks }
}
