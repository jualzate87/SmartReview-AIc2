/**
 * C2 handoff snapshot — conversational storyline for preparer sign-off and reviewer briefing.
 */
import type { ActivityEntry } from '../hooks/useSyncedReviewState'
import { coerceTimestamp } from '../lib/coerceTimestamp'
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
import {
  normalizeVerifiedDocKey,
  isVerifiedInSet,
  isPreparerDocVerified,
  getVerifiedDocEntry,
  PACKET_VERIFY_DOC_KEYS,
  PHASE1_FLAG_TO_VERIFY_DOC,
  verifiedDocLabel,
} from './verifiedDocKeys'

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
  | { type: 'outputForm'; formId: string }

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
  reviewerConfirmedDocs?: Set<string>
  reviewerConfirmedDocsMeta?: Map<string, ActivityEntry>
  editedFields: Map<string, ActivityEntry>
  /** Preparer verified summary rows */
  summaryChecked: Map<string, ActivityEntry>
  /** Reviewer confirmed summary rows */
  reviewerConfirmed?: Map<string, ActivityEntry>
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

const W2_EMPLOYER_NAMES: Record<string, string> = {
  techCircle: 'Tech Circle',
  bingEquipment: 'Bing Equipment',
}

const INT_PAYER_NAMES: Record<string, string> = {
  unwaverIngFinancial: 'Unwavering Financial',
  harborlineCredit: 'Harborline Credit Union',
  cascadeFederal: 'Cascade Federal Savings',
}

const DIV_PAYER_NAMES: Record<string, string> = {
  tokenFinancial: 'Token Financial',
  northmarkIndex: 'Northmark Index Funds',
  beaconDividend: 'Beacon Dividend Trust',
}

/** Plain-language labels for import flags, detail fields, and summary rows. */
export const FIELD_LABELS: Record<string, string> = {
  'ssn-techCircle': 'W-2 SSN',
  'wages-techCircle': 'W-2 wages',
  box12: 'W-2 Box 12 codes',
  'ein-techCircle': 'W-2 EIN',
  divCollectibles: '1099-DIV collectibles',
  divNonDiv: '1099-DIV non-dividend distributions',
  fedTaxWithheld: 'Federal tax withheld',
  taxableInterest: 'Taxable interest',
  'grossDistrib-meridian': '1099-R gross distribution',
  'ordinaryDivs-northmark': 'Ordinary dividends (Northmark)',
  qualifiedDivs: 'Qualified dividends',
  'r-taxableAmt': '1099-R taxable amount',
  'r-fedTaxWithheld': '1099-R federal withholding',
  withholding: 'W-2 federal withholding',
  wages: '1040 line 1a — W-2 wages',
  taxExemptInterest: '1040 line 2a — Tax-exempt interest',
  ordinaryDivs: '1040 line 3b — Ordinary dividends',
  withholding1099: '1099-R federal withholding',
  iraDistrib: '1040 line 4b — IRA distributions',
  otherIncome: '1040 line 8 — Other income',
  stdDeduction: 'Standard deduction',
  totalIncome: '1040 line 9 — Total income',
  totalTax: '1040 line 24 — Total tax',
}

const FLAG_TO_DOC = PHASE1_FLAG_TO_VERIFY_DOC

/** True for W-2 Box 12 flag or sub-row edit keys (box12a-techCircle, box12a-amt-techCircle, …). */
export function isBox12FieldKey(key: string): boolean {
  return key === 'box12' || /^box12[a-d](?:-amt)?-/i.test(key)
}

/** Roll up box12* keys to one canonical id per employer. */
export function box12RollupKey(key: string): string {
  if (key === 'box12') return 'box12:techCircle'
  const match = key.match(/^box12[a-d](?:-amt)?-(.+)$/i)
  return match ? `box12:${match[1]}` : `box12:${key}`
}

function payerSuffixLabel(suffix: string): string {
  return (
    W2_EMPLOYER_NAMES[suffix]
    ?? INT_PAYER_NAMES[suffix]
    ?? DIV_PAYER_NAMES[suffix]
    ?? suffix.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())
  )
}

/** User-facing label for any field / flag / edit key. */
export function getFieldDisplayLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]

  if (isBox12FieldKey(key)) {
    const employerKey = key === 'box12' ? 'techCircle' : key.split('-').pop() ?? 'techCircle'
    const employer = W2_EMPLOYER_NAMES[employerKey] ?? payerSuffixLabel(employerKey)
    return `W-2 Box 12 codes (${employer})`
  }

  if (key.startsWith('usBonds-')) {
    return `US bonds (${payerSuffixLabel(key.slice('usBonds-'.length))})`
  }
  if (key.startsWith('taxExempt-')) {
    return `Tax-exempt interest (${payerSuffixLabel(key.slice('taxExempt-'.length))})`
  }
  if (key.startsWith('taxableInterest-')) {
    return `Taxable interest (${payerSuffixLabel(key.slice('taxableInterest-'.length))})`
  }
  if (key.startsWith('qualifiedDivs-')) {
    return `Qualified dividends (${payerSuffixLabel(key.slice('qualifiedDivs-'.length))})`
  }
  if (key.startsWith('ordinaryDivs-')) {
    return `Ordinary dividends (${payerSuffixLabel(key.slice('ordinaryDivs-'.length))})`
  }
  if (key.startsWith('fedTaxWithheld-')) {
    return `Federal tax withheld (${payerSuffixLabel(key.slice('fedTaxWithheld-'.length))})`
  }
  if (key.startsWith('wages-')) {
    return `W-2 wages (${payerSuffixLabel(key.slice('wages-'.length))})`
  }
  if (key.startsWith('ssn-')) {
    return `W-2 SSN (${payerSuffixLabel(key.slice('ssn-'.length))})`
  }
  if (key.startsWith('ein-')) {
    return `W-2 EIN (${payerSuffixLabel(key.slice('ein-'.length))})`
  }

  return key
}

/** Extract underlying field/doc/diagnostic key from a handoff done/open item. */
export function parseHandoffItemKey(item: HandoffItem): string | null {
  if (item.jump?.type === 'field') return item.jump.field
  if (item.jump?.type === 'diagnostic') return item.jump.issueKey
  if (item.jump?.type === 'doc') return item.jump.docId
  const m = item.id?.match(/(?:done|import|confirm|flag|note)-(?:flag|edit|summary|doc|diag)?-?(.+)/)
  return m?.[1] ?? null
}

/** Dedupe key — box12 sub-rows share one slot; phase-1 flags stay distinct for doc mapping. */
export function canonicalActivityKey(fieldKey: string): string {
  if (isBox12FieldKey(fieldKey)) return box12RollupKey(fieldKey)
  return fieldKey
}

function buildFlagClearDetail(flagKey: string, wasEdited: boolean): string {
  if (flagKey === 'ssn-techCircle') {
    return wasEdited
      ? 'Corrected SSN after OCR mismatch on W-2'
      : 'Marked correct after OCR mismatch on SSN'
  }
  if (flagKey === 'wages-techCircle') {
    return wasEdited
      ? 'Verified Box 1 against W-2 source after amount edit'
      : 'Verified Box 1 against W-2 source'
  }
  if (flagKey === 'ein-techCircle') {
    return wasEdited
      ? 'Corrected EIN after OCR mismatch on W-2'
      : 'Marked correct after OCR mismatch on EIN'
  }
  if (flagKey === 'box12' || isBox12FieldKey(flagKey)) {
    return wasEdited
      ? 'Updated Box 12 codes to match W-2 source'
      : 'Confirmed Box 12 codes match W-2 source'
  }
  if (flagKey === 'taxableInterest') {
    return wasEdited
      ? 'Reconciled taxable interest against 1099-INT source'
      : 'Verified taxable interest against 1099-INT source'
  }
  if (flagKey === 'fedTaxWithheld' || flagKey.startsWith('fedTaxWithheld')) {
    return wasEdited
      ? 'Reconciled federal withholding against 1099-DIV source'
      : 'Verified federal withholding against source document'
  }
  if (flagKey === 'qualifiedDivs' || flagKey.startsWith('qualifiedDivs')) {
    return wasEdited
      ? 'Reconciled qualified dividends against 1099-DIV source'
      : 'Verified qualified dividends against source document'
  }
  if (flagKey === 'r-taxableAmt' || flagKey === 'grossDistrib-meridian') {
    return wasEdited
      ? 'Reconciled 1099-R taxable amount against source'
      : 'Verified 1099-R distribution against source document'
  }
  const label = getFieldDisplayLabel(flagKey)
  return wasEdited
    ? `Resolved ${label.toLowerCase()} with an amount edit`
    : `Marked ${label.toLowerCase()} correct without changing amounts`
}

const KNOWN_DOCS = PACKET_VERIFY_DOC_KEYS

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)
}

export function formatCheckMeta(entry: ActivityEntry): string {
  const at = coerceTimestamp(entry.at)
  return `${initials(entry.by)} · ${at}`
}

function fieldLabel(key: string): string {
  return getFieldDisplayLabel(key)
}

function docLabel(docId: string): string {
  return verifiedDocLabel(docId)
}

function editTouchesFlag(editKey: string, flagKey: string): boolean {
  if (editKey === flagKey) return true
  const base = flagKey.split('-')[0]
  return editKey === base || editKey.startsWith(`${base}-`) || flagKey.startsWith(`${editKey}-`)
}

function docRelatedEdits(docId: string, editKeys: string[]): string[] {
  const key = normalizeVerifiedDocKey(docId)
  return editKeys.filter(k => {
    const mapped = FLAG_TO_DOC[k]
    if (mapped === key) return true
    if (key === 'techCircle' && (k.startsWith('wages') || k === 'ssn' || k === 'ein' || k.startsWith('box12'))) return true
    if (key.startsWith('1099-div-') && (k.includes('Div') || k.includes('div') || k === 'fedTaxWithheld')) return true
    if (key.startsWith('1099-int-') && (k.includes('Interest') || k.includes('interest') || k.includes('taxExempt'))) return true
    if (key === '1099-r' && (k.includes('grossDistrib') || k.includes('r-') || k.includes('ira'))) return true
    if (key === '1099-nec' && (k.includes('nec') || k.includes('otherIncome'))) return true
    return false
  })
}

export function listPhrase(parts: string[], max = 3): string {
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

/** Packet docs the preparer marked verified (canonical, deduped). */
function preparerVerifiedPacketDocs(verifiedDocs: Set<string>): string[] {
  return KNOWN_DOCS.filter(d => isPreparerDocVerified(verifiedDocs, d))
}

/** Progressive disclosure trigger for open-item groups (action + count, no dot-separated hints). */
export function getOpenGroupToggleLabel(
  group: HandoffItemGroup,
  expanded: boolean,
  isBriefing = false,
): string {
  const n = group.count
  if (expanded) {
    switch (group.id) {
      case 'unverified-docs':
        return isBriefing ? 'Hide documents not verified in Pass 1' : 'Hide unverified documents'
      case 'notes':
        return 'Hide open notes'
      case 'import-flags':
        return 'Hide import flags'
      case 'ai-diagnostics':
        return 'Hide AI diagnostics'
      case 'preparer-flags':
        return 'Hide preparer follow-ups'
      case 'needs-confirmation':
        return 'Hide items needing confirmation'
      case 'docs-needs-confirmation':
        return 'Hide documents awaiting confirmation'
      default:
        return `Hide ${group.title.toLowerCase()}`
    }
  }
  switch (group.id) {
    case 'unverified-docs':
      return isBriefing
        ? n === 1
          ? 'View 1 document not verified in Pass 1'
          : `View ${n} documents not verified in Pass 1`
        : n === 1
          ? 'View 1 unverified document'
          : `View ${n} unverified documents`
    case 'notes':
      return n === 1 ? 'View 1 open note' : `View ${n} open notes`
    case 'import-flags':
      return n === 1 ? 'View 1 import flag' : `View ${n} import flags`
    case 'ai-diagnostics':
      return n === 1 ? 'View 1 open diagnostic' : `View ${n} open diagnostics`
    case 'preparer-flags':
      return n === 1 ? 'View 1 preparer follow-up' : `View ${n} preparer follow-ups`
    case 'needs-confirmation':
      return n === 1 ? 'View 1 item needing confirmation' : `View ${n} items needing confirmation`
    case 'docs-needs-confirmation':
      return n === 1 ? 'View 1 document awaiting confirmation' : `View ${n} documents awaiting confirmation`
    default:
      return n === 1 ? `View 1 item` : `View ${n} items`
  }
}

/** Progressive disclosure trigger for preparer-done groups (mirrors open-item copy). */
export function getPreparerDoneGroupToggleLabel(
  group: HandoffItemGroup,
  expanded: boolean,
  isBriefing: boolean,
  preparerFirstName: string,
): string {
  const n = group.count
  if (expanded) {
    switch (group.id) {
      case 'verified-docs':
        return 'Hide verified documents'
      case 'import-flags-cleared':
        return 'Hide cleared import flags'
      case 'summary-lines':
        return 'Hide verified summary lines'
      case 'amount-edits':
        return 'Hide amount edits'
      case 'ai-diagnostics-reviewed':
        return 'Hide reviewed AI diagnostics'
      default:
        return `Hide ${group.title.toLowerCase()}`
    }
  }
  switch (group.id) {
    case 'verified-docs':
      return n === 1 ? 'View 1 verified document' : `View ${n} verified documents`
    case 'import-flags-cleared':
      return n === 1 ? 'View 1 cleared import flag' : `View ${n} cleared import flags`
    case 'summary-lines':
      return n === 1 ? 'View 1 verified summary line' : `View ${n} verified summary lines`
    case 'amount-edits':
      return n === 1 ? 'View 1 amount edit' : `View ${n} amount edits`
    case 'ai-diagnostics-reviewed':
      return n === 1 ? 'View 1 reviewed diagnostic' : `View ${n} reviewed diagnostics`
    default:
      return n === 1 ? 'View 1 item' : `View ${n} items`
  }
}

/** Section-level fallback when the done plate has a flat list (no sub-groups). */
export function getDoneSectionToggleLabel(
  count: number,
  expanded: boolean,
  isBriefing: boolean,
  preparerFirstName: string,
): string {
  if (expanded) {
    return isBriefing
      ? `Hide what ${preparerFirstName} cleared`
      : 'Hide what you cleared'
  }
  if (count <= 0) {
    return isBriefing ? `See what ${preparerFirstName} cleared` : 'See what you cleared'
  }
  if (isBriefing) {
    return count === 1
      ? `See what ${preparerFirstName} cleared (1 item)`
      : `See what ${preparerFirstName} cleared (${count} items)`
  }
  return count === 1
    ? 'See what you cleared (1 item)'
    : `See what you cleared (${count} items)`
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
      return 'Open AI diagnostics'
    case 'outputForm':
      return 'Open form'
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
  const reviewerConfirmedDocs = input.reviewerConfirmedDocs ?? new Set<string>()

  // Preparer-verified packet docs only — aligns with tab checkmarks (isDocShownVerified preparer slot).
  const preparerVerifiedDocs = preparerVerifiedPacketDocs(input.verifiedDocs)
  // Not preparer-verified — never overlaps with preparerVerifiedDocs or done-list doc rows.
  const unverifiedDocs = KNOWN_DOCS.filter(d => !isPreparerDocVerified(input.verifiedDocs, d))
  // Reviewer briefing: preparer verified but reviewer has not confirmed yet.
  const docsAwaitingConfirmation = isBriefing
    ? preparerVerifiedDocs.filter(d => !isVerifiedInSet(reviewerConfirmedDocs, d))
    : []

  const checks = [...input.summaryChecked.entries()]
  const humanFlags = [...input.summaryFlagged.entries()]
  const edits = [...input.editedFields.entries()]
  const editKeys = edits.map(([k]) => k)

  // ── Still open — granular items grouped by category ───────────────────
  const openGroups: HandoffItemGroup[] = []

  // Soften group titles — categories in a brief, not a findings catalog
  if (openNotes.length) {
    openGroups.push({
      id: 'notes',
      title: 'Open notes',
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
      title: 'Import accuracy',
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
      title: 'AI diagnostics still open',
      count: diagsOpen.length,
      countLabel: `${diagsOpen.length} diagnostics remaining`,
      items: diagsOpen.map(k => ({
        id: `diag-${k}`,
        label: DIAG_LABELS[k] ?? k,
        detail: isBriefing
          ? 'Not marked reviewed in Pass 1. Finish import accuracy first.'
          : 'Not marked reviewed yet.',
        status: 'open' as const,
        jump: { type: 'diagnostic' as const, issueKey: k },
        jumpLabel: 'Open AI diagnostics',
      })),
    })
  }

  if (unverifiedDocs.length) {
    openGroups.push({
      id: 'unverified-docs',
      title: isBriefing ? 'Documents not verified in Pass 1' : 'Documents not yet verified',
      count: unverifiedDocs.length,
      countLabel: isBriefing
        ? `${unverifiedDocs.length} not verified in Pass 1`
        : `${unverifiedDocs.length} unverified doc${unverifiedDocs.length === 1 ? '' : 's'}`,
      items: unverifiedDocs.map(docId => ({
        id: `doc-${docId}`,
        label: docLabel(docId),
        detail: isBriefing
          ? `${who} has not marked this document verified yet.`
          : 'Not marked verified yet.',
        status: 'open' as const,
        jump: { type: 'doc' as const, docId },
        jumpLabel: 'Open document',
      })),
    })
  }

  if (humanFlags.length) {
    openGroups.push({
      id: 'preparer-flags',
      title: 'Preparer follow-ups',
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

  // Reviewer pass: preparer verified but reviewer has not confirmed yet
  const needsConfirmation = checks.filter(
    ([field]) => !input.reviewerConfirmed?.has(field),
  )
  if (isBriefing && needsConfirmation.length) {
    openGroups.push({
      id: 'needs-confirmation',
      title: 'Needs your confirmation',
      count: needsConfirmation.length,
      countLabel: `${needsConfirmation.length} verified-only`,
      items: needsConfirmation.map(([field, meta]) => ({
        id: `confirm-${field}`,
        label: fieldLabel(field),
        detail: `${firstName(meta.by)} verified · ${formatCheckMeta(meta)} — confirm for sign-off`,
        status: 'open' as const,
        jump: { type: 'field' as const, field },
        jumpLabel: 'Confirm field',
      })),
    })
  }

  if (isBriefing && docsAwaitingConfirmation.length) {
    openGroups.push({
      id: 'docs-needs-confirmation',
      title: 'Documents awaiting confirmation',
      count: docsAwaitingConfirmation.length,
      countLabel: `${docsAwaitingConfirmation.length} awaiting confirmation`,
      items: docsAwaitingConfirmation.map(docId => {
        const meta = getVerifiedDocEntry(input.verifiedDocsMeta, docId)
        return {
          id: `doc-confirm-${docId}`,
          label: docLabel(docId),
          detail: meta
            ? `${firstName(meta.by)} verified · ${formatCheckMeta(meta)} — confirm for sign-off`
            : 'Preparer verified — confirm for sign-off',
          status: 'open' as const,
          jump: { type: 'doc' as const, docId },
          jumpLabel: 'Confirm document',
        }
      }),
    })
  }

  const granularOpenCount = openGroups.reduce((sum, g) => sum + g.count, 0)

  // ── Preparer completed work — granular rows (same pattern as open items) ─
  const preparerDoneGroups: HandoffItemGroup[] = []

  if (preparerVerifiedDocs.length) {
    preparerDoneGroups.push({
      id: 'verified-docs',
      title: 'Documents verified',
      count: preparerVerifiedDocs.length,
      countLabel: `${preparerVerifiedDocs.length} verified doc${preparerVerifiedDocs.length === 1 ? '' : 's'}`,
      items: preparerVerifiedDocs.map(docId => {
        const meta = getVerifiedDocEntry(input.verifiedDocsMeta, docId)
        const relatedFlags = clearedFlags.filter(f => normalizeVerifiedDocKey(FLAG_TO_DOC[f] ?? '') === docId)
        const relatedEdits = docRelatedEdits(docId, editKeys)
        const detailParts: string[] = []
        if (meta) detailParts.push(`${formatCheckMeta(meta)}`)
        if (relatedFlags.length) {
          detailParts.push(`Cleared ${relatedFlags.length} import flag${relatedFlags.length === 1 ? '' : 's'}`)
        }
        if (relatedEdits.length) {
          detailParts.push(`${relatedEdits.length} related edit${relatedEdits.length === 1 ? '' : 's'}`)
        }
        return {
          id: `done-doc-${docId}`,
          label: docLabel(docId),
          detail: detailParts.length ? detailParts.join(' · ') : undefined,
          status: 'done' as const,
          jump: { type: 'doc' as const, docId },
          jumpLabel: 'Open document',
        }
      }),
    })
  }

  if (clearedFlags.length) {
    preparerDoneGroups.push({
      id: 'import-flags-cleared',
      title: 'Import flags cleared',
      count: clearedFlags.length,
      countLabel: `${clearedFlags.length} cleared flag${clearedFlags.length === 1 ? '' : 's'}`,
      items: clearedFlags.map(flag => {
        const wasEdited = editKeys.some(ek => editTouchesFlag(ek, flag))
        return {
          id: `done-flag-${flag}`,
          label: fieldLabel(flag),
          detail: buildFlagClearDetail(flag, wasEdited),
          status: 'done' as const,
          jump: { type: 'field' as const, field: flag },
          jumpLabel: 'View field',
        }
      }),
    })
  }

  if (checks.length) {
    preparerDoneGroups.push({
      id: 'summary-lines',
      title: 'Summary lines verified',
      count: checks.length,
      countLabel: `${checks.length} summary line${checks.length === 1 ? '' : 's'}`,
      items: checks.map(([field, meta]) => {
        const reviewerMeta = input.reviewerConfirmed?.get(field)
        const awaiting = isBriefing && !reviewerMeta
        return {
          id: `done-summary-${field}`,
          label: fieldLabel(field),
          detail: reviewerMeta
            ? `${formatCheckMeta(meta)} · Confirmed ${formatCheckMeta(reviewerMeta)}`
            : awaiting
              ? `${formatCheckMeta(meta)} · awaiting your confirmation`
              : formatCheckMeta(meta),
          status: awaiting ? ('info' as const) : ('done' as const),
          jump: { type: 'field' as const, field },
          jumpLabel: awaiting ? 'Confirm field' : 'View field',
        }
      }),
    })
  }

  if (edits.length) {
    const box12Rollups = new Map<string, { fields: string[]; meta: ActivityEntry }>()
    const nonBox12Edits: [string, ActivityEntry][] = []
    for (const [field, meta] of edits) {
      if (isBox12FieldKey(field)) {
        const rollup = box12RollupKey(field)
        const existing = box12Rollups.get(rollup)
        if (existing) existing.fields.push(field)
        else box12Rollups.set(rollup, { fields: [field], meta })
      } else {
        nonBox12Edits.push([field, meta])
      }
    }
    const editItems: HandoffItem[] = nonBox12Edits.map(([field, meta]) => ({
      id: `done-edit-${field}`,
      label: getFieldDisplayLabel(field),
      detail: formatCheckMeta(meta),
      status: 'done' as const,
      jump: { type: 'field' as const, field },
      jumpLabel: 'View field',
    }))
    for (const [rollup, { fields, meta }] of box12Rollups) {
      const employerKey = rollup.split(':')[1] ?? 'techCircle'
      editItems.push({
        id: `done-edit-${rollup}`,
        label: getFieldDisplayLabel(`box12-${employerKey}`),
        detail: `Updated ${fields.length} Box 12 code${fields.length === 1 ? '' : 's'} · ${formatCheckMeta(meta)}`,
        status: 'done' as const,
        jump: { type: 'field' as const, field: fields[0] ?? 'box12' },
        jumpLabel: 'View field',
      })
    }
    preparerDoneGroups.push({
      id: 'amount-edits',
      title: 'Amount edits',
      count: editItems.length,
      countLabel: `${editItems.length} edit${editItems.length === 1 ? '' : 's'}`,
      items: editItems,
    })
  }

  if (diagsReviewed.length) {
    preparerDoneGroups.push({
      id: 'ai-diagnostics-reviewed',
      title: 'AI diagnostics reviewed',
      count: diagsReviewed.length,
      countLabel: `${diagsReviewed.length} diagnostics reviewed`,
      items: diagsReviewed.map(k => ({
        id: `done-diag-${k}`,
        label: DIAG_LABELS[k] ?? k,
        status: 'done' as const,
        jump: { type: 'diagnostic' as const, issueKey: k },
        jumpLabel: 'Open AI diagnostics',
      })),
    })
  }

  const preparerDoneCount = preparerDoneGroups.reduce((sum, g) => sum + g.count, 0)
  const hasOpen = granularOpenCount > 0
  const hasPreparerDone = preparerDoneCount > 0

  // ── Briefing narrative (review history tone, not diagnostics catalog) ─
  const story: string[] = []
  if (isBriefing) {
    story.push(
      `${actorLabel} finished Pass 1. Here’s what you should know before you pick up the return.`,
    )
    if (clearedFlags.length || preparerVerifiedDocs.length || diagsReviewed.length) {
      const bits: string[] = []
      if (clearedFlags.length) bits.push(`${clearedFlags.length} import flag${clearedFlags.length === 1 ? '' : 's'} cleared`)
      if (preparerVerifiedDocs.length) bits.push(`${preparerVerifiedDocs.length} doc${preparerVerifiedDocs.length === 1 ? '' : 's'} verified`)
      if (diagsReviewed.length) bits.push(`${diagsReviewed.length} diagnostics reviewed`)
      story.push(`So far they completed: ${listPhrase(bits)}.`)
    }
    if (hasOpen) {
      story.push(
        granularOpenCount === 1
          ? '1 item still needs your attention before this return is ready to hand off or file.'
          : `${granularOpenCount} items still need your attention before this return is ready to hand off or file.`,
      )
      if (needsConfirmation.length) {
        story.push(
          needsConfirmation.length === 1
            ? '1 summary line was verified in Pass 1 but still needs your confirmation.'
            : `${needsConfirmation.length} summary lines were verified in Pass 1 but still need your confirmation.`,
        )
      }
    } else {
      story.push('Nothing is left open in this snapshot — spot-check Pass 1 work if you want a second pair of eyes.')
    }
  } else {
    story.push(
      pass === 2
        ? `${who}, here’s where this pass stands — what’s still open, then what you’ve already cleared.`
        : `${who}, here’s a brief on this pass: what’s outstanding, then what you’ve already handled.`,
    )
    if (clearedFlags.length || preparerVerifiedDocs.length || diagsReviewed.length || edits.length) {
      const bits: string[] = []
      if (clearedFlags.length) bits.push(`${clearedFlags.length} import flag${clearedFlags.length === 1 ? '' : 's'} cleared`)
      if (preparerVerifiedDocs.length) bits.push(`${preparerVerifiedDocs.length} doc${preparerVerifiedDocs.length === 1 ? '' : 's'} verified`)
      if (diagsReviewed.length) bits.push(`${diagsReviewed.length} diagnostics reviewed`)
      if (edits.length && !clearedFlags.length) bits.push(`${edits.length} amount change${edits.length === 1 ? '' : 's'}`)
      if (bits.length) story.push(`Completed so far: ${listPhrase(bits)}.`)
    }
    if (hasOpen) {
      story.push(
        granularOpenCount === 1
          ? '1 item still needs attention before you finish or pass this on.'
          : `${granularOpenCount} items still need attention before you finish or pass this on.`,
      )
    } else {
      story.push('Everything tracked in this snapshot looks clear — you can finish & file or pass to the next reviewer when you’re ready.')
    }
  }

  const openBreakdown = [
    openNotes.length ? `${openNotes.length} note${openNotes.length === 1 ? '' : 's'}` : null,
    openImportFlags.length ? `${openImportFlags.length} open import flag${openImportFlags.length === 1 ? '' : 's'}` : null,
    needsConfirmation.length
      ? `${needsConfirmation.length} summary line${needsConfirmation.length === 1 ? '' : 's'} awaiting confirmation`
      : null,
    docsAwaitingConfirmation.length
      ? `${docsAwaitingConfirmation.length} doc${docsAwaitingConfirmation.length === 1 ? '' : 's'} awaiting confirmation`
      : null,
    diagsOpen.length ? `${diagsOpen.length} diagnostics remaining` : null,
    unverifiedDocs.length
      ? isBriefing
        ? `${unverifiedDocs.length} doc${unverifiedDocs.length === 1 ? '' : 's'} not verified in Pass 1`
        : `${unverifiedDocs.length} unverified doc${unverifiedDocs.length === 1 ? '' : 's'}`
      : null,
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

  const preparerDoneSection: HandoffSection = {
    id: 'preparerDone',
    title: isBriefing ? `What ${who} cleared` : 'What you cleared',
    count: preparerDoneCount,
    countLabel: hasPreparerDone
      ? `${preparerDoneCount} completed`
      : 'Nothing completed yet',
    intro: isBriefing
      ? hasPreparerDone
        ? `${preparerDoneCount} item${preparerDoneCount === 1 ? '' : 's'} ${who} handled in Pass 1. Expand a group for jump links.`
        : `${who} hasn’t recorded edits, checks, or verified docs yet.`
      : hasPreparerDone
        ? 'Work you already cleared on this pass — expand a group for jump links.'
        : 'No completed actions recorded yet.',
    bucket: 'done',
    defaultOpen: false,
    groups: hasPreparerDone ? preparerDoneGroups : undefined,
    items: hasPreparerDone
      ? []
      : [
          {
            label: isBriefing
              ? `${who} hasn’t recorded edits, checks, or verified docs yet`
              : 'No completed actions recorded yet',
            detail: 'As work happens, it’ll show up here with jump links to each item.',
            status: 'info',
          },
        ],
  }

  const openSection: HandoffSection = {
    id: 'needsAttention',
    title: 'Still needs attention',
    count: hasOpen ? granularOpenCount : 0,
    countLabel: hasOpen
      ? `${granularOpenCount} open`
      : 'All clear',
    intro: isBriefing
      ? openBreakdown
        ? `${openBreakdown}. Open a group below for the full list and jump links.`
        : 'Nothing is waiting in this snapshot.'
      : openBreakdown
        ? `${openBreakdown}. Open a group below for jump links to each item.`
        : 'Nothing critical left before handoff or filing.',
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

  // Open items first, then preparer completed work — same order for self and reviewer briefing.
  const sections: HandoffSection[] = [openSection, preparerDoneSection]

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

/** Granular open-item total from a snapshot (notes + flags + diags + docs + preparer flags). */
export function getOutstandingOpenCount(snapshot: HandoffSnapshot): number {
  return snapshot.sections.find(s => s.id === 'needsAttention')?.count ?? 0
}
