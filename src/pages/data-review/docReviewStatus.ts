import type { W2Employer } from './DetailFields'
import { W2_PAYER_TABS } from './DetailFields'
import type { DivPayer } from './DetailFieldsDiv'
import { DIV_PAYER_TABS, divVerifiedDocKey } from './DetailFieldsDiv'
import type { IntPayer } from './DetailFields1099'
import { INT_PAYER_TABS, intVerifiedDocKey } from './DetailFields1099'
import { R_PAYER_TABS } from './DetailFields1099R'
import { NEC_PAYER_TABS } from './DetailFieldsNec'
import {
  getInitialDivPayerFlagCount,
  getInitialIntPayerFlagCount,
  getInitialRPayerFlagCount,
  getInitialW2PayerFlagCount,
} from './phase1FieldSync'
import type { TopTab } from './ReviewTab'
import { QUESTIONNAIRE_DOC_KEY } from './questionnaireData'
import { isDocShownVerified, isVerifiedInSet } from '../../data/verifiedDocKeys'

/**
 * A document shows a green check when marked verified, OR when it originally
 * had import flags and those are all cleared (legacy “cleared” signal).
 */
export function isDocReviewed(
  verifiedDocs: Set<string>,
  docKey: string,
  remainingFlagCount: number,
  initialFlagCount: number,
  reviewerConfirmedDocs?: Set<string>,
): boolean {
  if (isDocShownVerified(verifiedDocs, docKey, reviewerConfirmedDocs)) return true
  return initialFlagCount > 0 && remainingFlagCount === 0
}

export function buildTabVerifiedKeys(): Record<string, string[]> {
  return {
    w2s: W2_PAYER_TABS.map(t => t.key),
    '1099-divs': DIV_PAYER_TABS.map(t => divVerifiedDocKey(t.key)),
    '1099-ints': INT_PAYER_TABS.map(t => intVerifiedDocKey(t.key)),
    '1099-rs': ['1099-r'],
    '1099-necs': ['1099-nec'],
    'prior-1040': ['prior-1040'],
    questionnaire: [QUESTIONNAIRE_DOC_KEY],
  }
}

/** True when every L2 doc under a type tab is preparer-verified or reviewer-confirmed. */
export function buildTypeReviewed(args: {
  verifiedDocs: Set<string>
  w2Counts: Record<W2Employer, number>
  divCounts: Record<DivPayer, number>
  intCounts: Record<IntPayer, number>
  rRemaining: number
  reviewerConfirmedDocs?: Set<string>
}): Record<string, boolean> {
  const { verifiedDocs, w2Counts, divCounts, intCounts, rRemaining, reviewerConfirmedDocs } = args

  const w2s = W2_PAYER_TABS.every(t =>
    isDocShownVerified(verifiedDocs, t.key, reviewerConfirmedDocs),
  )

  const divs = DIV_PAYER_TABS.every(t =>
    isDocShownVerified(verifiedDocs, divVerifiedDocKey(t.key), reviewerConfirmedDocs),
  )

  const ints = INT_PAYER_TABS.every(t =>
    isDocShownVerified(verifiedDocs, intVerifiedDocKey(t.key), reviewerConfirmedDocs),
  )

  const rs = isDocShownVerified(verifiedDocs, '1099-r', reviewerConfirmedDocs)

  const necs = isDocShownVerified(verifiedDocs, '1099-nec', reviewerConfirmedDocs)

  return {
    w2s,
    '1099-divs': divs,
    '1099-ints': ints,
    '1099-rs': rs,
    '1099-necs': necs,
    'prior-1040': isDocShownVerified(verifiedDocs, 'prior-1040', reviewerConfirmedDocs),
    questionnaire: isDocShownVerified(verifiedDocs, QUESTIONNAIRE_DOC_KEY, reviewerConfirmedDocs),
  }
}

/** Navigation target for one packet source document (incl. Questionnaire). */
export type PacketSourceDoc = {
  key: string
  label: string
  tab: TopTab
  w2SubTab?: W2Employer
  divPayer?: DivPayer
  intPayer?: IntPayer
}

/** Canonical packet inventory used for “review remaining documents” after flags clear. */
export function listPacketSourceDocs(): PacketSourceDoc[] {
  return [
    ...W2_PAYER_TABS.map(t => ({
      key: t.key,
      label: `W-2 · ${t.label}`,
      tab: 'w2s' as const,
      w2SubTab: t.key,
    })),
    ...DIV_PAYER_TABS.map(t => ({
      key: divVerifiedDocKey(t.key),
      label: `1099-DIV · ${t.label}`,
      tab: '1099-divs' as const,
      divPayer: t.key,
    })),
    ...INT_PAYER_TABS.map(t => ({
      key: intVerifiedDocKey(t.key),
      label: `1099-INT · ${t.label}`,
      tab: '1099-ints' as const,
      intPayer: t.key,
    })),
    ...R_PAYER_TABS.map(t => ({
      key: '1099-r',
      label: `1099-R · ${t.label}`,
      tab: '1099-rs' as const,
    })),
    ...NEC_PAYER_TABS.map(t => ({
      key: '1099-nec',
      label: `1099-NEC · ${t.label}`,
      tab: '1099-necs' as const,
    })),
    {
      key: 'prior-1040',
      label: 'Prior Year 1040',
      tab: 'prior-1040',
    },
    {
      key: QUESTIONNAIRE_DOC_KEY,
      label: 'Questionnaire',
      tab: 'questionnaire',
    },
  ]
}

export function getUnreviewedSourceDocs(args: {
  verifiedDocs: Set<string>
  w2Counts: Record<W2Employer, number>
  divCounts: Record<DivPayer, number>
  intCounts: Record<IntPayer, number>
  rRemaining: number
}): PacketSourceDoc[] {
  const { verifiedDocs } = args
  return listPacketSourceDocs().filter(doc => !isVerifiedInSet(verifiedDocs, doc.key))
}

/** Cycle to the next unreviewed packet doc after the one matching current tab/payer. */
export function getNextUnreviewedSourceDoc(
  unreviewed: PacketSourceDoc[],
  current: { tab: TopTab; w2SubTab?: W2Employer; divPayer?: DivPayer; intPayer?: IntPayer },
): PacketSourceDoc | null {
  if (unreviewed.length === 0) return null

  const matchesCurrent = (doc: PacketSourceDoc) => {
    if (doc.tab !== current.tab) return false
    if (doc.w2SubTab) return doc.w2SubTab === current.w2SubTab
    if (doc.divPayer) return doc.divPayer === current.divPayer
    if (doc.intPayer) return doc.intPayer === current.intPayer
    return true
  }

  const idx = unreviewed.findIndex(matchesCurrent)
  if (idx === -1) return unreviewed[0]
  return unreviewed[(idx + 1) % unreviewed.length]
}
