import { useEffect, useRef, useState } from 'react'
import { SEED_AMOUNTS, type LiveAmounts } from '../data/liveReturn'
import type { W2Employer } from '../pages/data-review/DetailFields'
import type { TopTab } from '../pages/data-review/ReviewTab'
import type { DivPayer } from '../pages/data-review/DetailFieldsDiv'
import type { IntPayer } from '../pages/data-review/DetailFields1099'
import { PHASE1_TO_PHASE2_ISSUES } from '../pages/data-review/phase2FlagSync'
import { getPhase1FlagKeysForVerifiedDoc } from '../pages/data-review/phase1FieldSync'
import { normalizeVerifiedDocEntries, normalizeVerifiedDocKey } from '../data/verifiedDocKeys'
import type { MilestoneCompletion } from '../data/reviewMilestones'
import {
  coerceTimestamp,
  formatActivityTimestamp,
  sanitizeActivityEntry,
} from '../lib/coerceTimestamp'

// ProtoC2: source-doc review state persisted in localStorage so preparer work in
// tab A is visible when the reviewer opens tab B (same origin). BroadcastChannel
// + storage events keep open tabs in sync.

/** @deprecated Prefer LiveAmounts — kept for DetailFields prop shims. */
export interface FieldValues {
  withholding: { techCircle: number }
  box12: number
  taxableInterest: number
  qualifiedDivs: number
}

export interface ReviewedEntry { by: string; at: string }
/** Who/when for last check, flag, edit, or doc verify — same shape as reviewed. */
export type ActivityEntry = ReviewedEntry

interface SyncedState {
  activeTopTab: TopTab
  activeSubTab: W2Employer
  selectedField: string | null
  /** All editable return amounts — single source of truth for 1040 recalculation */
  amounts: LiveAmounts
  reviewedFieldsList: [string, ReviewedEntry][]
  /** Field keys the preparer has edited+saved this session (with who/when) */
  editedFieldsList: [string, ActivityEntry][]
  /** Docs marked verified — with who/when */
  verifiedDocsList: [string, ActivityEntry][]
  /** Summary-row checks (preparer verified against source) — mutually exclusive with flags */
  summaryCheckedFieldsList: [string, ActivityEntry][]
  /** Summary-row reviewer sign-off confirmations — independent of preparer checks */
  reviewerConfirmedFieldsList: [string, ActivityEntry][]
  /** Docs marked verified by preparer */
  reviewerConfirmedDocsList: [string, ActivityEntry][]
  /** Per output form / schedule reviewer sign-off (e.g. schedule-c, form-1040) */
  reviewerSignedOffFormsList: [string, ActivityEntry][]
  /** Summary fields needing reviewer re-confirm after post-verify edit */
  reviewerConfirmStaleFieldsList: string[]
  /** Manual attestation checkboxes for review checklist (Phase 2 sign-off) */
  manualChecklistItems: Record<string, boolean>
  /** Declaration milestone completions — who/when for flexible checklist */
  completedMilestones: Record<string, MilestoneCompletion>
  /**
   * Summary-row user flags (preparer attention markers).
   * Mutually exclusive with checks. Notes may remain when flag is off.
   */
  summaryFlaggedFieldsList: [string, ActivityEntry][]
  /** Optional short notes keyed by Summary field id — kept when flag is turned off */
  summaryFlagNotes: Record<string, string>
  /**
   * Last flag activity (set/note Done) even after flag is cleared —
   * used for lightweight meta display.
   */
  summaryFlagActivity: Record<string, ActivityEntry>
  /**
   * Free-text / static detail-field overrides (employer name, addresses, etc.).
   * Keys match DetailFields row keys (e.g. `employerName-techCircle`).
   * Persists across tabs and Phase 2 so edits never disappear.
   */
  fieldOverrides: Record<string, string>
  activeDivPayer: DivPayer
  activeIntPayer: IntPayer
}

const CHANNEL_NAME = 'protoc2-data-review-sync'
// Bump whenever DEFAULT_STATE shape or seed values change so stale sessions reset.
const STATE_VERSION = 28
const STORAGE_KEY = 'protoc2-data-review-state-v' + STATE_VERSION
/** Prior keys — sessionStorage (tab-scoped) and older localStorage versions */
const LEGACY_STORAGE_KEYS = [
  STORAGE_KEY,
  'protoc2-data-review-state-v27',
  'protoc2-data-review-state-v26',
] as const

function readPersistedRaw(): string | null {
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      const fromLocal = localStorage.getItem(key)
      if (fromLocal) {
        if (key !== STORAGE_KEY) localStorage.setItem(STORAGE_KEY, fromLocal)
        return fromLocal
      }
      const fromSession = sessionStorage.getItem(key)
      if (fromSession) {
        localStorage.setItem(STORAGE_KEY, fromSession)
        sessionStorage.removeItem(key)
        return fromSession
      }
    } catch {
      // ignore quota / private mode
    }
  }
  return null
}

function writePersisted(state: SyncedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota / private mode
  }
}

function hydrateSyncedState(raw: string): SyncedState {
  const parsed = JSON.parse(raw) as Partial<SyncedState> & {
    verifiedDocsList?: unknown
    editedFieldsList?: unknown
    reviewedFieldsList?: unknown
    summaryCheckedFieldsList?: unknown
    reviewerConfirmedFieldsList?: unknown
    reviewerConfirmedDocsList?: unknown
    reviewerSignedOffFormsList?: unknown
    reviewerConfirmStaleFieldsList?: unknown
    manualChecklistItems?: unknown
    completedMilestones?: unknown
    summaryFlaggedFieldsList?: unknown
    summaryFlagActivity?: unknown
  }
  return sanitizeSyncedState({
    ...DEFAULT_STATE,
    ...parsed,
    amounts: {
      ...SEED_AMOUNTS,
      ...(parsed.amounts ?? {}),
      box12Rows: {
        ...SEED_AMOUNTS.box12Rows,
        ...(parsed.amounts?.box12Rows ?? {}),
      },
    },
    manualChecklistItems: parsed.manualChecklistItems && typeof parsed.manualChecklistItems === 'object'
      ? parsed.manualChecklistItems as Record<string, boolean>
      : {},
    summaryFlagNotes: parsed.summaryFlagNotes ?? {},
    fieldOverrides: parsed.fieldOverrides ?? {},
    reviewerConfirmStaleFieldsList: Array.isArray(parsed.reviewerConfirmStaleFieldsList)
      ? parsed.reviewerConfirmStaleFieldsList.filter((k): k is string => typeof k === 'string')
      : [],
    reviewedFieldsList: migrateActivityList(parsed.reviewedFieldsList),
    editedFieldsList: migrateActivityList(parsed.editedFieldsList),
    ...migrateDualSlotLists(parsed),
    completedMilestones: migrateCompletedMilestones(parsed.completedMilestones),
    reviewerSignedOffFormsList: migrateActivityList(parsed.reviewerSignedOffFormsList),
    summaryFlaggedFieldsList: migrateActivityList(parsed.summaryFlaggedFieldsList),
    summaryFlagActivity: migrateActivityRecord(parsed.summaryFlagActivity),
  })
}

/** Re-sanitize in-memory or cross-tab state so every `at` field is a string. */
export function sanitizeSyncedState(state: SyncedState): SyncedState {
  const dualSlots = {
    summaryCheckedFieldsList: migrateActivityList(state.summaryCheckedFieldsList),
    reviewerConfirmedFieldsList: migrateActivityList(state.reviewerConfirmedFieldsList),
    verifiedDocsList: normalizeVerifiedDocEntries(migrateActivityList(state.verifiedDocsList)),
    reviewerConfirmedDocsList: normalizeVerifiedDocEntries(migrateActivityList(state.reviewerConfirmedDocsList)),
  }
  const loaded: SyncedState = {
    ...DEFAULT_STATE,
    ...state,
    reviewedFieldsList: migrateActivityList(state.reviewedFieldsList),
    editedFieldsList: migrateActivityList(state.editedFieldsList),
    ...dualSlots,
    completedMilestones: migrateCompletedMilestones(state.completedMilestones),
    reviewerSignedOffFormsList: migrateActivityList(state.reviewerSignedOffFormsList),
    summaryFlaggedFieldsList: migrateActivityList(state.summaryFlaggedFieldsList),
    summaryFlagActivity: migrateActivityRecord(state.summaryFlagActivity),
  }
  return reconcileVerifiedDocFlags(enforceMutualExclusion(loaded))
}
export const PREPARER_NAME = 'Sara Chen'
export const REVIEWER_NAME = 'Jordan Lee'
/** Storage key for review state — exported for tests and diagnostics */
export { STORAGE_KEY }

/** C2: who stamps checks/flags/edits — switched when “Open as reviewer” */
let currentActorName = PREPARER_NAME

export function setReviewActor(name: string) {
  currentActorName = name
}

export function getReviewActor(): string {
  return currentActorName
}

export { formatActivityTimestamp }
/** @deprecated Use coerceTimestamp from lib/coerceTimestamp — kept for existing imports */
export const coerceActivityAt = coerceTimestamp

function migrateCompletedMilestones(raw: unknown): Record<string, MilestoneCompletion> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, MilestoneCompletion> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const v = value as Partial<MilestoneCompletion>
    const name = typeof v.name === 'string' ? v.name : PREPARER_NAME
    const by: MilestoneCompletion['by'] =
      v.by === 'reviewer' || v.by === 'preparer'
        ? v.by
        : name === REVIEWER_NAME
          ? 'reviewer'
          : 'preparer'
    out[id] = { by, name, at: coerceTimestamp(v.at) }
  }
  return out
}

export function formatActivityMeta(entry?: ActivityEntry | null): string {
  if (!entry) return ''
  return `${entry.by} · ${coerceTimestamp(entry.at)}`
}

export function actorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)
}

/** Short milestone / checklist attribution — Sara Chen → SC, Jordan Lee → Jordan */
export function milestoneActorLabel(name: string): string {
  if (name === PREPARER_NAME) return 'SC'
  if (name === REVIEWER_NAME) return 'Jordan'
  const initials = actorInitials(name)
  if (initials.length >= 2) return initials
  return name.split(/\s+/)[0] || name
}

/** Inline dual-slot trail — preparer muted, reviewer emphasized */
export function formatDualCheckTrail(
  preparer?: ActivityEntry | null,
  reviewer?: ActivityEntry | null,
): string {
  const parts: string[] = []
  if (preparer) parts.push(`${actorInitials(preparer.by)} ✓`)
  if (reviewer) parts.push(`${actorInitials(reviewer.by)} ✓`)
  return parts.join(' · ')
}

export function formatDualCheckTooltip(
  preparer?: ActivityEntry | null,
  reviewer?: ActivityEntry | null,
): string {
  const lines: string[] = []
  if (preparer) lines.push(`Verified by ${preparer.by} · ${preparer.at}`)
  if (reviewer) lines.push(`Confirmed by ${reviewer.by} · ${reviewer.at}`)
  return lines.join('\n')
}

function isReviewerActor(): boolean {
  return currentActorName === REVIEWER_NAME
}

/** Split legacy single-slot checks/docs by actor into dual maps */
function migrateDualSlotLists(parsed: {
  summaryCheckedFieldsList?: unknown
  verifiedDocsList?: unknown
  reviewerConfirmedFieldsList?: unknown
  reviewerConfirmedDocsList?: unknown
}): Pick<
  SyncedState,
  'summaryCheckedFieldsList' | 'reviewerConfirmedFieldsList' | 'verifiedDocsList' | 'reviewerConfirmedDocsList'
> {
  const preparerChecks: [string, ActivityEntry][] = []
  const reviewerChecks: [string, ActivityEntry][] = []
  for (const [k, e] of migrateActivityList(parsed.summaryCheckedFieldsList)) {
    if (e.by === REVIEWER_NAME) reviewerChecks.push([k, e])
    else preparerChecks.push([k, e])
  }
  for (const [k, e] of migrateActivityList(parsed.reviewerConfirmedFieldsList)) {
    if (!reviewerChecks.some(([rk]) => rk === k)) reviewerChecks.push([k, e])
  }

  const preparerDocs: [string, ActivityEntry][] = []
  const reviewerDocs: [string, ActivityEntry][] = []
  for (const [k, e] of migrateActivityList(parsed.verifiedDocsList)) {
    if (e.by === REVIEWER_NAME) reviewerDocs.push([k, e])
    else preparerDocs.push([k, e])
  }
  for (const [k, e] of migrateActivityList(parsed.reviewerConfirmedDocsList)) {
    if (!reviewerDocs.some(([rk]) => rk === k)) reviewerDocs.push([k, e])
  }

  return {
    summaryCheckedFieldsList: preparerChecks,
    reviewerConfirmedFieldsList: reviewerChecks,
    verifiedDocsList: preparerDocs,
    reviewerConfirmedDocsList: reviewerDocs,
  }
}

/** Summary field ids that may be affected by a detail-field edit */
function summaryFieldsAffectedByEdit(fieldKey: string): string[] {
  const out = new Set<string>([fieldKey])
  const base = fieldKey.split('-')[0]
  if (base) out.add(base)
  if (fieldKey.startsWith('wages')) out.add('wages')
  if (fieldKey === 'box12' || fieldKey.startsWith('box12')) out.add('box12')
  if (fieldKey.includes('taxableInterest')) out.add('taxableInterest')
  if (fieldKey.includes('qualifiedDivs')) out.add('qualifiedDivs')
  if (fieldKey.includes('ordinaryDivs')) out.add('ordinaryDivs')
  if (fieldKey.includes('grossDistrib')) out.add('grossDistrib-meridian')
  return [...out]
}

function applyEditStaleMarkers(state: SyncedState, fieldKey: string): string[] {
  const stale = new Set(state.reviewerConfirmStaleFieldsList)
  const preparerChecked = new Set(state.summaryCheckedFieldsList.map(([k]) => k))
  const beforeReviewer = new Set(state.reviewerConfirmedFieldsList.map(([k]) => k))
  const afterReviewer = new Set(
    reviewerConfirmKeysToClear(state.reviewerConfirmedFieldsList, fieldKey).map(([k]) => k),
  )
  for (const k of beforeReviewer) {
    if (!afterReviewer.has(k)) stale.add(k)
  }
  for (const sf of summaryFieldsAffectedByEdit(fieldKey)) {
    if (preparerChecked.has(sf)) stale.add(sf)
  }
  return [...stale]
}

function clearStaleMarker(list: string[], fieldName: string): string[] {
  return list.filter(k => k !== fieldName)
}

/** Clear reviewer confirmations touched by an edit on fieldKey or its summary/base alias */
function reviewerConfirmKeysToClear(
  list: [string, ActivityEntry][],
  fieldKey: string,
): [string, ActivityEntry][] {
  const base = fieldKey.split('-')[0]
  return list.filter(([k]) => {
    if (k === fieldKey || k === base) return false
    if (fieldKey.startsWith(`${k}-`) || k.startsWith(`${fieldKey}-`)) return false
    if (base && k.startsWith(`${base}-`)) return false
    return true
  })
}

function nowEntry(): ActivityEntry {
  return { by: currentActorName, at: formatActivityTimestamp() }
}

/** Migrate legacy string[] lists → [key, ActivityEntry][] */
function migrateActivityList(
  raw: unknown,
  fallbackAt = 'earlier',
): [string, ActivityEntry][] {
  if (!Array.isArray(raw)) return []
  return raw.map((item): [string, ActivityEntry] | null => {
    if (typeof item === 'string') {
      return [item, { by: PREPARER_NAME, at: fallbackAt }]
    }
    if (Array.isArray(item) && typeof item[0] === 'string') {
      const entry = item[1]
      if (entry && typeof entry === 'object' && 'by' in entry) {
        const e = entry as Partial<ActivityEntry>
        const by = typeof e.by === 'string' ? e.by : PREPARER_NAME
        return [item[0], sanitizeActivityEntry(e, by, fallbackAt)]
      }
      return [item[0], { by: PREPARER_NAME, at: fallbackAt }]
    }
    return null
  }).filter((x): x is [string, ActivityEntry] => x !== null)
}

function migrateActivityRecord(raw: unknown): Record<string, ActivityEntry> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, ActivityEntry> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = sanitizeActivityEntry(value, PREPARER_NAME)
  }
  return out
}

const DEFAULT_STATE: SyncedState = {
  activeTopTab: 'w2s',
  activeSubTab: 'techCircle',
  selectedField: null,
  amounts: { ...SEED_AMOUNTS },
  reviewedFieldsList: [],
  editedFieldsList: [],
  verifiedDocsList: [],
  summaryCheckedFieldsList: [],
  reviewerConfirmedFieldsList: [],
  reviewerConfirmedDocsList: [],
  reviewerSignedOffFormsList: [],
  reviewerConfirmStaleFieldsList: [],
  manualChecklistItems: {},
  completedMilestones: {},
  summaryFlaggedFieldsList: [],
  summaryFlagNotes: {},
  summaryFlagActivity: {},
  fieldOverrides: {},
  activeDivPayer: 'tokenFinancial',
  activeIntPayer: 'unwaverIngFinancial',
}

/** Ensure check and flag never coexist for the same field (check wins if both present). */
function enforceMutualExclusion(state: SyncedState): SyncedState {
  const checked = new Set(state.summaryCheckedFieldsList.map(([k]) => k))
  const flagged = state.summaryFlaggedFieldsList.filter(([k]) => !checked.has(k))
  if (flagged.length === state.summaryFlaggedFieldsList.length) return state
  return { ...state, summaryFlaggedFieldsList: flagged }
}

function reconcileVerifiedDocFlags(state: SyncedState): SyncedState {
  // If a doc is Verified but its Phase 1 flags were never written (stale session /
  // older Mark as verified), clear those flags so tab badges match what the user sees.
  if (!state.verifiedDocsList.length) return state
  const nextReviewed = new Map(state.reviewedFieldsList)
  let changed = false
  const stamp = sanitizeActivityEntry(
    state.verifiedDocsList[0]?.[1],
    PREPARER_NAME,
    formatActivityTimestamp(),
  )
  const { at, by } = stamp
  for (const [docKey] of state.verifiedDocsList) {
    for (const flag of getPhase1FlagKeysForVerifiedDoc(docKey)) {
      if (!nextReviewed.has(flag)) {
        nextReviewed.set(flag, { by, at })
        changed = true
      }
    }
  }
  if (!changed) return state
  return { ...state, reviewedFieldsList: Array.from(nextReviewed.entries()) }
}

function loadInitialState(): SyncedState {
  try {
    const raw = readPersistedRaw()
    if (raw) return hydrateSyncedState(raw)
  } catch {
    // ignore malformed storage — fall through to defaults
  }
  return DEFAULT_STATE
}

/**
 * Shared source-doc review state with localStorage persistence (cross-tab handoff).
 */
export function useSyncedReviewState() {
  const channelRef = useRef<BroadcastChannel | null>(null)
  const [state, setState] = useState<SyncedState>(loadInitialState)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = channel
    channel.onmessage = (e: MessageEvent<SyncedState>) => {
      const next = sanitizeSyncedState(e.data)
      stateRef.current = next
      setState(next)
      writePersisted(next)
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        const next = hydrateSyncedState(e.newValue)
        stateRef.current = next
        setState(next)
      } catch {
        // ignore malformed cross-tab payload
      }
    }
    window.addEventListener('storage', onStorage)

    return () => {
      channel.close()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const publish = (next: SyncedState) => {
    // Update the ref synchronously so back-to-back calls in the same tick (e.g.
    // fieldKeys.forEach(k => markReviewed(k))) each see the previous call's
    // write instead of all reading the same stale snapshot and clobbering
    // each other. setState is still what actually triggers the re-render.
    const safe = sanitizeSyncedState(next)
    stateRef.current = safe
    setState(safe)
    writePersisted(safe)
    channelRef.current?.postMessage(safe)
  }

  const update = (patch: Partial<SyncedState>) => {
    publish({ ...stateRef.current, ...patch })
  }

  const reviewedFields = new Map(state.reviewedFieldsList)
  const editedFields = new Map(state.editedFieldsList)
  const editedFieldKeys = new Set(state.editedFieldsList.map(([k]) => k))

  const markEdited = (fieldKey: string) => {
    const next = new Map(stateRef.current.editedFieldsList)
    next.set(fieldKey, nowEntry())
    const clearedReviewer = reviewerConfirmKeysToClear(
      stateRef.current.reviewerConfirmedFieldsList,
      fieldKey,
    )
    const stale = applyEditStaleMarkers(stateRef.current, fieldKey)
    update({
      editedFieldsList: Array.from(next.entries()),
      ...(clearedReviewer.length !== stateRef.current.reviewerConfirmedFieldsList.length
        ? { reviewerConfirmedFieldsList: clearedReviewer }
        : {}),
      ...(stale.length !== stateRef.current.reviewerConfirmStaleFieldsList.length
        || stale.some((k, i) => k !== stateRef.current.reviewerConfirmStaleFieldsList[i])
        ? { reviewerConfirmStaleFieldsList: stale }
        : {}),
    })
  }

  const markEditedBulk = (fieldKeys: string[]) => {
    const next = new Map(stateRef.current.editedFieldsList)
    const entry = nowEntry()
    fieldKeys.forEach(k => next.set(k, entry))
    let reviewerList = stateRef.current.reviewerConfirmedFieldsList
    let staleList = stateRef.current.reviewerConfirmStaleFieldsList
    fieldKeys.forEach(k => {
      reviewerList = reviewerConfirmKeysToClear(reviewerList, k)
      staleList = applyEditStaleMarkers({ ...stateRef.current, reviewerConfirmedFieldsList: reviewerList, reviewerConfirmStaleFieldsList: staleList }, k)
    })
    update({
      editedFieldsList: Array.from(next.entries()),
      ...(reviewerList.length !== stateRef.current.reviewerConfirmedFieldsList.length
        ? { reviewerConfirmedFieldsList: reviewerList }
        : {}),
      reviewerConfirmStaleFieldsList: staleList,
    })
  }

  /** Persist a static/detail field value and stamp it as edited. */
  const setFieldOverride = (fieldKey: string, value: string) => {
    const nextEdited = new Map(stateRef.current.editedFieldsList)
    nextEdited.set(fieldKey, nowEntry())
    const clearedReviewer = reviewerConfirmKeysToClear(
      stateRef.current.reviewerConfirmedFieldsList,
      fieldKey,
    )
    const stale = applyEditStaleMarkers(stateRef.current, fieldKey)
    update({
      fieldOverrides: { ...stateRef.current.fieldOverrides, [fieldKey]: value },
      editedFieldsList: Array.from(nextEdited.entries()),
      ...(clearedReviewer.length !== stateRef.current.reviewerConfirmedFieldsList.length
        ? { reviewerConfirmedFieldsList: clearedReviewer }
        : {}),
      reviewerConfirmStaleFieldsList: stale,
    })
  }

  const markReviewed = (fieldName: string) => {
    const at = formatActivityTimestamp()
    const next = new Map(stateRef.current.reviewedFieldsList)
    next.set(fieldName, { by: PREPARER_NAME, at })
    // Auto-dismiss linked Phase 2 insights when a Phase 1 flag is resolved
    const linked = PHASE1_TO_PHASE2_ISSUES[fieldName]
    if (linked) {
      linked.forEach(issueKey => {
        if (!next.has(issueKey)) next.set(issueKey, { by: PREPARER_NAME, at })
      })
    }
    update({ reviewedFieldsList: Array.from(next.entries()) })
  }

  const markReviewedBulk = (fieldNames: string[]) => {
    const at = formatActivityTimestamp()
    const next = new Map(stateRef.current.reviewedFieldsList)
    fieldNames.forEach(f => {
      if (!next.has(f)) next.set(f, { by: PREPARER_NAME, at })
      const linked = PHASE1_TO_PHASE2_ISSUES[f]
      if (linked) {
        linked.forEach(issueKey => {
          if (!next.has(issueKey)) next.set(issueKey, { by: PREPARER_NAME, at })
        })
      }
    })
    update({ reviewedFieldsList: Array.from(next.entries()) })
  }

  const verifiedDocs = new Map(state.verifiedDocsList)
  const verifiedDocKeys = new Set(state.verifiedDocsList.map(([k]) => k))
  const reviewerConfirmedDocs = new Map(state.reviewerConfirmedDocsList)
  const reviewerConfirmedDocKeys = new Set(state.reviewerConfirmedDocsList.map(([k]) => k))
  const summaryCheckedFields = new Map(state.summaryCheckedFieldsList)
  const summaryCheckedKeys = new Set(state.summaryCheckedFieldsList.map(([k]) => k))
  const reviewerConfirmedFields = new Map(state.reviewerConfirmedFieldsList)
  const reviewerConfirmedKeys = new Set(state.reviewerConfirmedFieldsList.map(([k]) => k))
  const reviewerConfirmStaleKeys = new Set(state.reviewerConfirmStaleFieldsList)
  const summaryFlaggedFields = new Map(state.summaryFlaggedFieldsList)
  const summaryFlaggedKeys = new Set(state.summaryFlaggedFieldsList.map(([k]) => k))
  const summaryFlagNotes = state.summaryFlagNotes
  const summaryFlagActivity = state.summaryFlagActivity

  const toggleVerifiedDoc = (rawDocKey: string) => {
    const docKey = normalizeVerifiedDocKey(rawDocKey)
    if (isReviewerActor()) {
      const nextConfirmed = new Map(stateRef.current.reviewerConfirmedDocsList)
      const existing = [...nextConfirmed.keys()].find(k => normalizeVerifiedDocKey(k) === docKey)
      if (existing) nextConfirmed.delete(existing)
      else nextConfirmed.set(docKey, nowEntry())
      update({ reviewerConfirmedDocsList: Array.from(nextConfirmed.entries()) })
      return
    }

    const nextVerified = new Map(stateRef.current.verifiedDocsList)
    const existing = [...nextVerified.keys()].find(k => normalizeVerifiedDocKey(k) === docKey)
    if (existing) {
      nextVerified.delete(existing)
      update({ verifiedDocsList: Array.from(nextVerified.entries()) })
      return
    }

    // Marking verified also clears every Phase 1 flag tied to this document
    nextVerified.set(docKey, nowEntry())
    const at = formatActivityTimestamp()
    const nextReviewed = new Map(stateRef.current.reviewedFieldsList)
    getPhase1FlagKeysForVerifiedDoc(docKey).forEach(f => {
      if (!nextReviewed.has(f)) nextReviewed.set(f, { by: PREPARER_NAME, at })
      const linked = PHASE1_TO_PHASE2_ISSUES[f]
      if (linked) {
        linked.forEach(issueKey => {
          if (!nextReviewed.has(issueKey)) nextReviewed.set(issueKey, { by: PREPARER_NAME, at })
        })
      }
    })
    update({
      verifiedDocsList: Array.from(nextVerified.entries()),
      reviewedFieldsList: Array.from(nextReviewed.entries()),
    })
  }

  /** Toggle Summary check/confirm — preparer vs reviewer slot based on current actor */
  const toggleSummaryChecked = (fieldName: string) => {
    if (isReviewerActor()) {
      toggleSummaryReviewerConfirm(fieldName)
    } else {
      toggleSummaryPreparerCheck(fieldName)
    }
  }

  const toggleSummaryPreparerCheck = (fieldName: string) => {
    if (isReviewerActor()) return

    const nextChecked = new Map(stateRef.current.summaryCheckedFieldsList)
    const nextFlagged = new Map(stateRef.current.summaryFlaggedFieldsList)
    if (nextChecked.has(fieldName)) {
      nextChecked.delete(fieldName)
    } else {
      nextChecked.set(fieldName, nowEntry())
      nextFlagged.delete(fieldName)
    }
    update({
      summaryCheckedFieldsList: Array.from(nextChecked.entries()),
      summaryFlaggedFieldsList: Array.from(nextFlagged.entries()),
    })
  }

  const toggleSummaryReviewerConfirm = (fieldName: string) => {
    if (!isReviewerActor()) return

    const nextConfirmed = new Map(stateRef.current.reviewerConfirmedFieldsList)
    if (nextConfirmed.has(fieldName)) nextConfirmed.delete(fieldName)
    else nextConfirmed.set(fieldName, nowEntry())
    const nextStale = nextConfirmed.has(fieldName)
      ? clearStaleMarker(stateRef.current.reviewerConfirmStaleFieldsList, fieldName)
      : stateRef.current.reviewerConfirmStaleFieldsList
    update({
      reviewerConfirmedFieldsList: Array.from(nextConfirmed.entries()),
      reviewerConfirmStaleFieldsList: nextStale,
    })
  }

  /**
   * Toggle Summary user flag — clearing check if turning flag on.
   * Notes are kept when flagging off so re-flagging can restore them.
   */
  const toggleSummaryFlagged = (fieldName: string) => {
    const nextFlagged = new Map(stateRef.current.summaryFlaggedFieldsList)
    const nextChecked = new Map(stateRef.current.summaryCheckedFieldsList)
    const nextActivity = { ...stateRef.current.summaryFlagActivity }
    if (nextFlagged.has(fieldName)) {
      nextFlagged.delete(fieldName)
    } else {
      const entry = nowEntry()
      nextFlagged.set(fieldName, entry)
      nextActivity[fieldName] = entry
      nextChecked.delete(fieldName) // mutual exclusion: flag supersedes check
    }
    update({
      summaryFlaggedFieldsList: Array.from(nextFlagged.entries()),
      summaryCheckedFieldsList: Array.from(nextChecked.entries()),
      summaryFlagActivity: nextActivity,
    })
  }

  const setSummaryFlagNote = (fieldName: string, note: string) => {
    const trimmed = note.trim()
    const next = { ...stateRef.current.summaryFlagNotes }
    if (trimmed) next[fieldName] = trimmed
    else delete next[fieldName]
    const entry = nowEntry()
    const nextActivity = { ...stateRef.current.summaryFlagActivity, [fieldName]: entry }
    // Refresh flag activity timestamp when note is saved (flag already on)
    const nextFlagged = new Map(stateRef.current.summaryFlaggedFieldsList)
    if (nextFlagged.has(fieldName)) nextFlagged.set(fieldName, entry)
    update({
      summaryFlagNotes: next,
      summaryFlagActivity: nextActivity,
      summaryFlaggedFieldsList: Array.from(nextFlagged.entries()),
    })
  }

  const updateAmounts = (patch: Partial<LiveAmounts>) => {
    const prev = stateRef.current.amounts
    const nextAmounts = { ...prev, ...patch }
    // Keep aggregate box12 in sync when rows are patched (deep-merge per letter)
    if (patch.box12Rows) {
      const rows = {
        a: { ...prev.box12Rows.a, ...patch.box12Rows.a },
        b: { ...prev.box12Rows.b, ...patch.box12Rows.b },
        c: { ...prev.box12Rows.c, ...patch.box12Rows.c },
        d: { ...prev.box12Rows.d, ...patch.box12Rows.d },
      }
      nextAmounts.box12Rows = rows
      nextAmounts.box12 =
        rows.a.amount + rows.b.amount + rows.c.amount + rows.d.amount
    }
    update({ amounts: nextAmounts })
  }

  /** Convenience — update W-2 wages object shape used by DetailFields. */
  const setWages = (wages: { techCircle: number }) => {
    updateAmounts({ wages: wages.techCircle })
  }

  /**
   * Legacy FieldValues shim for DetailFields that still call onFieldValueChange
   * with withholding / taxableInterest / qualifiedDivs / box12.
   */
  const updateFieldValue = (
    key: keyof FieldValues,
    value: number | { techCircle: number },
  ) => {
    const a = stateRef.current.amounts
    if (key === 'withholding' && typeof value === 'object') {
      updateAmounts({ w2Withholding: value.techCircle })
      return
    }
    if (typeof value !== 'number') return
    if (key === 'box12') {
      // Legacy single-amount shim — write into row a; aggregate recomputed in updateAmounts
      updateAmounts({
        box12Rows: {
          ...a.box12Rows,
          a: { ...a.box12Rows.a, amount: value },
        },
      })
    } else if (key === 'taxableInterest') updateAmounts({ interestUnwavering: value })
    else if (key === 'qualifiedDivs') updateAmounts({ qualifiedDivsToken: value })
    else if (key === 'withholding') {
      // flat number — treat as W-2 Box 2
      updateAmounts({ w2Withholding: value })
    }
  }

  const amounts = state.amounts
  const wages = { techCircle: amounts.wages }
  const fieldValues: FieldValues = {
    withholding: { techCircle: amounts.w2Withholding },
    box12: amounts.box12,
    taxableInterest: amounts.interestUnwavering,
    qualifiedDivs: amounts.qualifiedDivsToken,
  }

  const toggleManualChecklistItem = (itemId: string) => {
    const next = { ...stateRef.current.manualChecklistItems }
    next[itemId] = !next[itemId]
    update({ manualChecklistItems: next })
  }

  const reviewerSignedOffForms = new Map(state.reviewerSignedOffFormsList)
  const reviewerSignedOffFormKeys = new Set(state.reviewerSignedOffFormsList.map(([k]) => k))

  const toggleReviewerFormSignOff = (formKey: string) => {
    if (!isReviewerActor()) return
    const next = new Map(stateRef.current.reviewerSignedOffFormsList)
    if (next.has(formKey)) next.delete(formKey)
    else next.set(formKey, nowEntry())
    update({ reviewerSignedOffFormsList: Array.from(next.entries()) })
  }

  const setManualChecklistItem = (itemId: string, checked: boolean) => {
    update({
      manualChecklistItems: {
        ...stateRef.current.manualChecklistItems,
        [itemId]: checked,
      },
    })
  }

  const toggleMilestoneDeclaration = (milestoneId: string) => {
    const next = { ...stateRef.current.completedMilestones }
    if (next[milestoneId]) {
      delete next[milestoneId]
    } else {
      const entry = nowEntry()
      next[milestoneId] = {
        by: entry.by === REVIEWER_NAME ? 'reviewer' : 'preparer',
        at: entry.at,
        name: entry.by,
      }
    }
    update({ completedMilestones: next })
  }

  const setMilestoneDeclaration = (milestoneId: string, complete: boolean) => {
    const next = { ...stateRef.current.completedMilestones }
    if (complete) {
      const entry = nowEntry()
      next[milestoneId] = {
        by: entry.by === REVIEWER_NAME ? 'reviewer' : 'preparer',
        at: entry.at,
        name: entry.by,
      }
    } else {
      delete next[milestoneId]
    }
    update({ completedMilestones: next })
  }

  return {
    activeTopTab: state.activeTopTab,
    setActiveTopTab: (tab: TopTab) => update({ activeTopTab: tab }),
    activeSubTab: state.activeSubTab,
    setActiveSubTab: (tab: W2Employer) => update({ activeSubTab: tab }),
    selectedField: state.selectedField,
    setSelectedField: (field: string | null) => update({ selectedField: field }),
    amounts,
    updateAmounts,
    wages,
    setWages,
    fieldValues,
    updateFieldValue,
    reviewedFields,
    /** Set of field keys for components that only need presence */
    editedFields: editedFieldKeys,
    /** Full who/when map for edited fields */
    editedFieldsMeta: editedFields,
    markEdited,
    markEditedBulk,
    fieldOverrides: state.fieldOverrides,
    setFieldOverride,
    activeDivPayer: state.activeDivPayer,
    setActiveDivPayer: (payer: DivPayer) => update({ activeDivPayer: payer }),
    activeIntPayer: state.activeIntPayer,
    setActiveIntPayer: (payer: IntPayer) => update({ activeIntPayer: payer }),
    markReviewed,
    markReviewedBulk,
    /** Set of verified doc keys (presence) — matches prior API */
    verifiedDocs: verifiedDocKeys,
    verifiedDocsMeta: verifiedDocs,
    toggleVerifiedDoc,
    reviewerConfirmedDocs: reviewerConfirmedDocKeys,
    reviewerConfirmedDocsMeta: reviewerConfirmedDocs,
    /** Set of preparer-checked summary field keys */
    summaryCheckedFields: summaryCheckedKeys,
    summaryCheckedMeta: summaryCheckedFields,
    /** Set of reviewer-confirmed summary field keys */
    reviewerConfirmedFields: reviewerConfirmedKeys,
    reviewerConfirmedMeta: reviewerConfirmedFields,
    reviewerConfirmStaleFields: reviewerConfirmStaleKeys,
    toggleSummaryChecked,
    toggleSummaryPreparerCheck,
    toggleSummaryReviewerConfirm,
    /** Set of flagged summary field keys (presence) */
    summaryFlaggedFields: summaryFlaggedKeys,
    summaryFlaggedMeta: summaryFlaggedFields,
    toggleSummaryFlagged,
    summaryFlagNotes,
    summaryFlagActivity,
    setSummaryFlagNote,
    manualChecklistItems: state.manualChecklistItems,
    toggleManualChecklistItem,
    setManualChecklistItem,
    completedMilestones: state.completedMilestones,
    toggleMilestoneDeclaration,
    setMilestoneDeclaration,
    reviewerSignedOffForms: reviewerSignedOffFormKeys,
    reviewerSignedOffFormsMeta: reviewerSignedOffForms,
    toggleReviewerFormSignOff,
  }
}
