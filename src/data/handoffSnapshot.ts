/**
 * C2 handoff snapshot — expandable done / open / outstanding sections
 * with jump targets for AI-panel navigation.
 */
import type { ActivityEntry } from '../hooks/useSyncedReviewState'
import { computeLiveReturn, type LiveAmounts } from './liveReturn'
import { PHASE1_FLAG_KEYS } from '../pages/data-review/phase1FieldSync'
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
}

export type HandoffSection = {
  id: string
  title: string
  /** Collapsed summary, e.g. "3 cleared" */
  summary: string
  bucket: 'done' | 'open' | 'outstanding'
  defaultOpen?: boolean
  items: HandoffItem[]
}

export type HandoffSnapshot = {
  mode: HandoffMode
  pass: 1 | 2
  actorLabel: string
  sections: HandoffSection[]
  nextSteps: string[]
  /** Quick-link chips for Pass 2 AI panel */
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
  'ordinaryDivs-northmark': 'Ordinary dividends',
}

/** Known source-doc keys used in this prototype for overlooked checks */
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

export function buildHandoffSnapshot(
  mode: HandoffMode,
  pass: 1 | 2,
  actorLabel: string,
  input: HandoffInputs,
): HandoffSnapshot {
  const phase1Keys = PHASE1_FLAG_KEYS as readonly string[]
  const clearedFlags = phase1Keys.filter(k => input.reviewedFields.has(k))
  const openImportFlags = phase1Keys.filter(k => !input.reviewedFields.has(k))

  const live = computeLiveReturn(input.amounts)
  const p2 = getPhase2Progress({
    reviewedFields: input.reviewedFields,
    live,
    amounts: input.amounts,
  })
  const diagsReviewed = p2.activeKeys.filter(k => input.reviewedFields.has(k))
  const diagsOpen = p2.activeKeys.filter(k => !input.reviewedFields.has(k))

  const openNotes = input.notes.filter(n => (n.status ?? 'open') === 'open')
  const resolvedNotes = input.notes.filter(n => n.status === 'resolved')

  const verifiedList = [...input.verifiedDocs]
  const unverifiedDocs = KNOWN_DOCS.filter(d => !input.verifiedDocs.has(d))

  const checks = [...input.summaryChecked.entries()]
  const flags = [...input.summaryFlagged.entries()]
  const edits = [...input.editedFields.entries()]

  const sections: HandoffSection[] = [
    {
      id: 'flagsCleared',
      title: 'Import flags cleared',
      summary: `${clearedFlags.length} of ${phase1Keys.length}`,
      bucket: 'done',
      items: clearedFlags.length
        ? clearedFlags.map(k => {
            const meta = input.reviewedFields.get(k)
            return {
              label: fieldLabel(k),
              detail: meta ? formatCheckMeta(meta) : undefined,
              status: 'done' as const,
              jump: { type: 'field' as const, field: k },
            }
          })
        : [{ label: 'None cleared yet', status: 'info' }],
    },
    {
      id: 'diagnostics',
      title: 'Diagnostics marked reviewed',
      summary: `${diagsReviewed.length} of ${p2.total}`,
      bucket: 'done',
      items: diagsReviewed.length
        ? diagsReviewed.map(k => {
            const meta = input.reviewedFields.get(k)
            return {
              label: DIAG_LABELS[k] ?? k,
              detail: meta ? formatCheckMeta(meta) : undefined,
              status: 'done' as const,
              jump: { type: 'diagnostic' as const, issueKey: k },
            }
          })
        : [{ label: 'No diagnostics reviewed yet', status: 'info' }],
    },
    {
      id: 'docsVerified',
      title: 'Documents marked verified',
      summary: `${verifiedList.length} verified`,
      bucket: 'done',
      items: verifiedList.length
        ? verifiedList.map(docId => {
            const meta = input.verifiedDocsMeta?.get(docId)
            return {
              label: docId,
              detail: meta ? formatCheckMeta(meta) : undefined,
              status: 'done' as const,
              jump: { type: 'doc' as const, docId },
            }
          })
        : [{ label: 'No documents marked verified', status: 'info' }],
    },
    {
      id: 'checks',
      title: 'Fields marked as correct',
      summary: `${checks.length} checked`,
      bucket: 'done',
      items: checks.length
        ? checks.map(([field, meta]) => ({
            label: field,
            detail: formatCheckMeta(meta),
            status: 'done' as const,
            jump: { type: 'field' as const, field },
          }))
        : [{ label: 'No line checks yet', status: 'info' }],
    },
    {
      id: 'edits',
      title: 'Fields changed',
      summary: `${edits.length} edited`,
      bucket: 'done',
      items: edits.length
        ? edits.map(([field, meta]) => ({
            label: field,
            detail: formatCheckMeta(meta),
            status: 'info' as const,
            jump: { type: 'field' as const, field },
          }))
        : [{ label: 'No amount edits recorded', status: 'info' }],
    },
    {
      id: 'flags',
      title: 'Fields flagged for follow-up',
      summary: flags.length ? `${flags.length} open` : 'None',
      bucket: 'open',
      defaultOpen: flags.length > 0,
      items: flags.length
        ? flags.map(([field, meta]) => ({
            label: field,
            detail: [formatCheckMeta(meta), input.summaryFlagNotes[field]].filter(Boolean).join(' — '),
            status: 'open' as const,
            jump: { type: 'field' as const, field },
          }))
        : [{ label: 'No open flags', status: 'done' }],
    },
    {
      id: 'notes',
      title: 'Notes',
      summary: `${openNotes.length} open · ${resolvedNotes.length} resolved`,
      bucket: 'open',
      defaultOpen: openNotes.length > 0,
      items: [
        ...openNotes.map(n => ({
          label: n.context ? `${n.context}: ${n.text}` : n.text,
          detail: `${initials(n.author)} · ${n.at}`,
          status: 'open' as const,
          jump: { type: 'note' as const, noteId: n.id },
        })),
        ...resolvedNotes.slice(0, 3).map(n => ({
          label: n.context ? `${n.context}: ${n.text}` : n.text,
          detail: `Resolved · ${initials(n.author)} · ${n.at}`,
          status: 'done' as const,
          jump: { type: 'note' as const, noteId: n.id },
        })),
        ...(input.notes.length === 0
          ? [{ label: 'No notes yet', status: 'info' as const }]
          : []),
      ],
    },
    {
      id: 'outstanding',
      title: 'Outstanding & overlooked',
      summary: [
        openImportFlags.length ? `${openImportFlags.length} import flags` : null,
        diagsOpen.length ? `${diagsOpen.length} diagnostics` : null,
        unverifiedDocs.length ? `${unverifiedDocs.length} docs unverified` : null,
        flags.length ? `${flags.length} human flags` : null,
        openNotes.length ? `${openNotes.length} open notes` : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Clear',
      bucket: 'outstanding',
      defaultOpen: true,
      items: [
        ...openImportFlags.map(k => ({
          label: `Overlooked import flag: ${fieldLabel(k)}`,
          status: 'open' as const,
          jump: { type: 'field' as const, field: k },
        })),
        ...diagsOpen.map(k => ({
          label: `Outstanding diagnostic: ${DIAG_LABELS[k] ?? k}`,
          status: 'open' as const,
          jump: { type: 'diagnostic' as const, issueKey: k },
        })),
        ...unverifiedDocs.slice(0, 6).map(docId => ({
          label: `Unverified document: ${docId}`,
          status: 'open' as const,
          jump: { type: 'doc' as const, docId },
        })),
        ...flags.map(([field]) => ({
          label: `Open flag: ${field}`,
          status: 'open' as const,
          jump: { type: 'field' as const, field },
        })),
        ...openNotes.map(n => ({
          label: `Open note: ${n.context ?? n.text.slice(0, 40)}`,
          status: 'open' as const,
          jump: { type: 'note' as const, noteId: n.id },
        })),
        ...(openImportFlags.length === 0 &&
        diagsOpen.length === 0 &&
        flags.length === 0 &&
        openNotes.length === 0
          ? [{ label: 'No outstanding human follow-ups', status: 'done' as const }]
          : []),
      ],
    },
  ]

  const quickLinks = [
    {
      id: 'openFlags',
      label: 'Open flags',
      count: flags.length,
      sectionId: 'flags',
      jump: flags[0] ? { type: 'field' as const, field: flags[0][0] } : undefined,
    },
    {
      id: 'openNotes',
      label: 'Unresolved notes',
      count: openNotes.length,
      sectionId: 'notes',
      jump: { type: 'notesPane' as const },
    },
    { id: 'edits', label: 'Edits', count: edits.length, sectionId: 'edits' },
    { id: 'checks', label: 'Marked correct', count: checks.length, sectionId: 'checks' },
    {
      id: 'docs',
      label: 'Verified docs',
      count: verifiedList.length,
      sectionId: 'docsVerified',
    },
    {
      id: 'outstanding',
      label: 'Outstanding',
      count:
        openImportFlags.length + diagsOpen.length + flags.length + openNotes.length,
      sectionId: 'outstanding',
    },
  ]

  const nextSteps: string[] =
    mode === 'finish-and-file'
      ? [
          'Confirm e-file checklist and state returns if applicable.',
          openNotes.length || flags.length
            ? 'Clear or document remaining open flags/notes before transmitting.'
            : 'Return looks clear of open human follow-ups — proceed to file.',
          'Archive this snapshot with the client workpapers.',
        ]
      : mode === 'pass-to-reviewer' || mode === 'signoff-review'
        ? [
            'Reviewer should start from open flags and unresolved notes first.',
            'Import OCR flags stay cleared — spot-check only if risk warrants.',
            'Reviewer can reply/resolve notes and add their own checks or flags.',
          ]
        : [
            'Waiting for the next reviewer/approver.',
            'Use “Open as reviewer” to start Pass 2 in this prototype.',
          ]

  return { mode, pass, actorLabel, sections, nextSteps, quickLinks }
}
