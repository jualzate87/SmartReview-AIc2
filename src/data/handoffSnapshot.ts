/**
 * C2 handoff snapshot — aggregates Pass 1/2 state for the handoff preview
 * and finish-and-file closing view.
 */
import type { ActivityEntry } from '../hooks/useSyncedReviewState'
import { computeLiveReturn, type LiveAmounts } from './liveReturn'
import { PHASE1_FLAG_KEYS } from '../pages/data-review/phase1FieldSync'
import { getPhase2Progress } from '../pages/data-review/phase2FlagSync'
import type { Note } from '../pages/data-review/NotesPane'

export type HandoffMode = 'pass-to-reviewer' | 'finish-and-file' | 'awaiting-reviewer'

export type HandoffSection = {
  id: string
  title: string
  items: { label: string; detail?: string; status: 'done' | 'open' | 'info' }[]
}

export type HandoffSnapshot = {
  mode: HandoffMode
  pass: 1 | 2
  actorLabel: string
  sections: HandoffSection[]
  nextSteps: string[]
}

export type HandoffInputs = {
  reviewedFields: Map<string, ActivityEntry>
  verifiedDocs: Set<string>
  editedFields: Map<string, ActivityEntry>
  summaryChecked: Map<string, ActivityEntry>
  summaryFlagged: Map<string, ActivityEntry>
  summaryFlagNotes: Record<string, string>
  notes: Note[]
  amounts: LiveAmounts
}

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

export function buildHandoffSnapshot(
  mode: HandoffMode,
  pass: 1 | 2,
  actorLabel: string,
  input: HandoffInputs,
): HandoffSnapshot {
  const phase1Keys = PHASE1_FLAG_KEYS as readonly string[]
  const phase1Cleared = phase1Keys.filter(k => input.reviewedFields.has(k)).length
  const phase1Open = phase1Keys.length - phase1Cleared

  const live = computeLiveReturn(input.amounts)
  const p2 = getPhase2Progress({
    reviewedFields: input.reviewedFields,
    live,
    amounts: input.amounts,
  })
  const openNotes = input.notes.filter(n => (n.status ?? 'open') === 'open')
  const resolvedNotes = input.notes.filter(n => n.status === 'resolved')

  const verifiedCount = input.verifiedDocs.size
  const checks = [...input.summaryChecked.entries()]
  const flags = [...input.summaryFlagged.entries()]
  const edits = [...input.editedFields.entries()]

  const sections: HandoffSection[] = [
    {
      id: 'import',
      title: 'Import accuracy',
      items: [
        {
          label: `${phase1Cleared} of ${phase1Keys.length} import flags cleared`,
          status: phase1Open === 0 ? 'done' : 'open',
          detail: phase1Open > 0 ? `${phase1Open} still open` : undefined,
        },
        {
          label: `${verifiedCount} source document${verifiedCount === 1 ? '' : 's'} marked verified`,
          status: verifiedCount > 0 ? 'done' : 'open',
        },
      ],
    },
    {
      id: 'diagnostics',
      title: 'AI diagnostics',
      items: [
        {
          label: `${p2.reviewed} of ${p2.total} diagnostics reviewed`,
          status: p2.complete ? 'done' : 'open',
          detail: p2.complete ? undefined : `${p2.remaining} remaining`,
        },
      ],
    },
    {
      id: 'checks',
      title: 'Checks (who verified)',
      items: checks.length
        ? checks.map(([field, meta]) => ({
            label: field,
            detail: formatCheckMeta(meta),
            status: 'done' as const,
          }))
        : [{ label: 'No line checks yet', status: 'info' }],
    },
    {
      id: 'flags',
      title: 'Open flags & follow-ups',
      items: flags.length
        ? flags.map(([field, meta]) => ({
            label: field,
            detail: [formatCheckMeta(meta), input.summaryFlagNotes[field]].filter(Boolean).join(' — '),
            status: 'open' as const,
          }))
        : [{ label: 'No open flags', status: 'done' }],
    },
    {
      id: 'notes',
      title: 'Notes',
      items: [
        {
          label: `${openNotes.length} open · ${resolvedNotes.length} resolved · ${input.notes.length} total`,
          status: openNotes.length ? 'open' : 'done',
        },
        ...openNotes.slice(0, 4).map(n => ({
          label: n.context ? `${n.context}: ${n.text}` : n.text,
          detail: `${initials(n.author)} · ${n.at}`,
          status: 'open' as const,
        })),
      ],
    },
    {
      id: 'edits',
      title: 'Edits this pass',
      items: edits.length
        ? edits.slice(0, 8).map(([field, meta]) => ({
            label: field,
            detail: formatCheckMeta(meta),
            status: 'info' as const,
          }))
        : [{ label: 'No amount edits recorded', status: 'info' }],
    },
  ]

  const nextSteps: string[] =
    mode === 'finish-and-file'
      ? [
          'Confirm e-file checklist and state returns if applicable.',
          openNotes.length || flags.length
            ? 'Clear remaining open flags/notes before transmitting, or document why they remain.'
            : 'Return looks clear of open human follow-ups — proceed to file.',
          'Archive this snapshot with the client workpapers.',
        ]
      : mode === 'pass-to-reviewer'
        ? [
            'Reviewer should start from open flags and unresolved notes first.',
            'Import OCR flags stay cleared — spot-check only if risk warrants.',
            'Reviewer can reply/resolve notes and add their own checks or flags.',
          ]
        : [
            'Waiting for the next reviewer/approver.',
            'Use “Open as reviewer” to start Pass 2 in this prototype.',
          ]

  return { mode, pass, actorLabel, sections, nextSteps }
}
