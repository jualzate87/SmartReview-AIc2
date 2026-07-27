/**
 * Canonical keys for verifiedDocsList / reviewerConfirmedDocsList.
 * Single source of truth — summary, tabs, detail pane, and handoff must all use these.
 */
import type { W2Employer } from '../pages/data-review/DetailFields'
import { W2_PAYER_TABS } from '../pages/data-review/DetailFields'
import type { DivPayer } from '../pages/data-review/DetailFieldsDiv'
import { DIV_PAYER_TABS } from '../pages/data-review/DetailFieldsDiv'
import type { IntPayer } from '../pages/data-review/DetailFields1099'
import { INT_PAYER_TABS } from '../pages/data-review/DetailFields1099'
import type { TopTab } from '../pages/data-review/ReviewTab'

export function divVerifiedDocKey(payer: DivPayer): string {
  return `1099-div-${payer}`
}

export function intVerifiedDocKey(payer: IntPayer): string {
  return `1099-int-${payer}`
}

/** All packet source documents expected on Jessica Drake TY 2025. */
export const PACKET_VERIFY_DOC_KEYS = [
  ...W2_PAYER_TABS.map(t => t.key),
  ...DIV_PAYER_TABS.map(t => divVerifiedDocKey(t.key)),
  ...INT_PAYER_TABS.map(t => intVerifiedDocKey(t.key)),
  '1099-r',
  '1099-nec',
] as const

export type PacketVerifyDocKey = (typeof PACKET_VERIFY_DOC_KEYS)[number]

export const VERIFY_DOC_LABELS: Record<string, string> = {
  techCircle: 'W-2 · Tech Circle',
  bingEquipment: 'W-2 · Bing Equipment',
  '1099-div-tokenFinancial': '1099-DIV · Token Financial',
  '1099-div-northmarkIndex': '1099-DIV · Northmark Index Funds',
  '1099-div-beaconDividend': '1099-DIV · Beacon Dividend Trust',
  '1099-int-unwaverIngFinancial': '1099-INT · Unwavering Financial',
  '1099-int-harborlineCredit': '1099-INT · Harborline Credit Union',
  '1099-int-cascadeFederal': '1099-INT · Cascade Federal Savings',
  '1099-r': '1099-R · Meridian Retirement Trust',
  '1099-nec': '1099-NEC · Summit Advisory Partners',
}

/** Phase 1 import flags → verify-doc key (for handoff / open items). */
export const PHASE1_FLAG_TO_VERIFY_DOC: Record<string, string> = {
  'ssn-techCircle': 'techCircle',
  'wages-techCircle': 'techCircle',
  box12: 'techCircle',
  'ein-techCircle': 'techCircle',
  divCollectibles: '1099-div-tokenFinancial',
  divNonDiv: '1099-div-tokenFinancial',
  fedTaxWithheld: '1099-div-tokenFinancial',
  taxableInterest: '1099-int-unwaverIngFinancial',
  'grossDistrib-meridian': '1099-r',
  'ordinaryDivs-northmark': '1099-div-northmarkIndex',
}

/** Legacy ids (sourceDocuments / early C2) → canonical verify keys. */
export const LEGACY_VERIFY_KEY_ALIASES: Record<string, string> = {
  'w2-techCircle': 'techCircle',
  '1099-div-token': '1099-div-tokenFinancial',
  '1099-div-northmark': '1099-div-northmarkIndex',
  '1099-div-beacon': '1099-div-beaconDividend',
  '1099-int-unwavering': '1099-int-unwaverIngFinancial',
  '1099-int-harborline': '1099-int-harborlineCredit',
  '1099-int-cascade': '1099-int-cascadeFederal',
  '1099-r-meridian': '1099-r',
  '1099-nec-summit': '1099-nec',
}

export function normalizeVerifiedDocKey(key: string): string {
  return LEGACY_VERIFY_KEY_ALIASES[key] ?? key
}

/** True when any key in the set matches docKey after legacy normalization. */
export function isVerifiedInSet(set: Set<string>, docKey: string): boolean {
  const canonical = normalizeVerifiedDocKey(docKey)
  for (const k of set) {
    if (normalizeVerifiedDocKey(k) === canonical) return true
  }
  return false
}

/** Lookup activity meta when keys may be stored in legacy form. */
export function getVerifiedDocEntry<T>(
  map: Map<string, T> | undefined,
  docKey: string,
): T | undefined {
  if (!map) return undefined
  const canonical = normalizeVerifiedDocKey(docKey)
  for (const [k, v] of map) {
    if (normalizeVerifiedDocKey(k) === canonical) return v
  }
  return undefined
}

export function verifiedDocLabel(docKey: string): string {
  const key = normalizeVerifiedDocKey(docKey)
  return VERIFY_DOC_LABELS[key] ?? docKey
}

/** Navigate from a verify-doc key (or legacy source-doc id) to the source panel. */
export function navigationForVerifiedDocKey(docKey: string): {
  tab: TopTab
  subTab?: W2Employer
  divPayer?: DivPayer
  intPayer?: IntPayer
} | null {
  const key = normalizeVerifiedDocKey(docKey)

  if (key === 'techCircle' || key === 'bingEquipment') {
    return { tab: 'w2s', subTab: key }
  }
  if (key.startsWith('1099-div-')) {
    return { tab: '1099-divs', divPayer: key.slice('1099-div-'.length) as DivPayer }
  }
  if (key.startsWith('1099-int-')) {
    return { tab: '1099-ints', intPayer: key.slice('1099-int-'.length) as IntPayer }
  }
  if (key === '1099-r') return { tab: '1099-rs' }
  if (key === '1099-nec') return { tab: '1099-necs' }
  if (key === 'prior-1040') return { tab: 'prior-1040' }
  if (key === 'questionnaire') return { tab: 'questionnaire' }
  return null
}

/** True when preparer verified or reviewer confirmed — matches DocVerifyHeaderActions badge. */
export function isDocShownVerified(
  verifiedDocs: Set<string>,
  docKey: string,
  reviewerConfirmedDocs?: Set<string>,
): boolean {
  if (isVerifiedInSet(verifiedDocs, docKey)) return true
  if (reviewerConfirmedDocs && isVerifiedInSet(reviewerConfirmedDocs, docKey)) return true
  return false
}

/** Normalize every entry in a verified-docs map (session migration). */
export function normalizeVerifiedDocEntries(
  entries: [string, import('../hooks/useSyncedReviewState').ActivityEntry][],
): [string, import('../hooks/useSyncedReviewState').ActivityEntry][] {
  const merged = new Map<string, import('../hooks/useSyncedReviewState').ActivityEntry>()
  for (const [rawKey, entry] of entries) {
    const key = normalizeVerifiedDocKey(rawKey)
    if (!merged.has(key)) merged.set(key, entry)
  }
  return Array.from(merged.entries())
}
