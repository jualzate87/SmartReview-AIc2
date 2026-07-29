/** Output forms / schedules shown beside the 1040 Summary in the left panel. */

export type OutputFormId =
  | 'summary'
  | '1040'
  | 'sch1'
  | 'schC'
  | 'schA'
  | 'schD'
  | 'f8960'
  | 'f2210'

/** Stable keys for per-form reviewer sign-off (reviewerSignedOffFormsList). */
export const OUTPUT_FORM_SIGNOFF_KEYS: Record<OutputFormId, string> = {
  summary: 'return-summary',
  '1040': 'form-1040',
  sch1: 'schedule-1',
  schC: 'schedule-c',
  schA: 'schedule-a',
  schD: 'schedule-d',
  f8960: 'form-8960',
  f2210: 'form-2210',
}

/** Output forms the reviewer must sign off before final approval. */
export const REQUIRED_REVIEWER_FORM_SIGNOFFS = [
  'return-summary',
  'form-1040',
  'schedule-1',
  'schedule-c',
  'schedule-a',
  'schedule-d',
  'form-8960',
] as const

export type ReviewerFormSignoffKey = (typeof REQUIRED_REVIEWER_FORM_SIGNOFFS)[number]

export function outputFormSignoffKey(formId: OutputFormId): string {
  return OUTPUT_FORM_SIGNOFF_KEYS[formId]
}

export function outputFormSignoffLabel(formId: OutputFormId): string {
  const opt = OUTPUT_FORM_OPTIONS.find(o => o.id === formId)
  return opt?.shortLabel ?? formId
}

export function allRequiredFormsSignedOff(signedOff: Set<string>): boolean {
  return REQUIRED_REVIEWER_FORM_SIGNOFFS.every(k => signedOff.has(k))
}

export const OUTPUT_FORM_OPTIONS: { id: OutputFormId; label: string; shortLabel: string }[] = [
  { id: 'summary', label: 'Return Summary', shortLabel: 'Summary' },
  { id: '1040', label: 'Form 1040', shortLabel: '1040' },
  { id: 'sch1', label: 'Schedule 1 — Additional Income', shortLabel: 'Sch 1' },
  { id: 'schC', label: 'Schedule C — Business', shortLabel: 'Sch C' },
  { id: 'schA', label: 'Schedule A — Itemized Deductions', shortLabel: 'Sch A' },
  { id: 'schD', label: 'Schedule D — Capital Gains', shortLabel: 'Sch D' },
  { id: 'f8960', label: 'Form 8960 — NIIT', shortLabel: '8960' },
  { id: 'f2210', label: 'Form 2210 — Underpayment', shortLabel: '2210' },
]

/** Map Phase 2 openForm actions → left-panel form id. */
export const OPEN_FORM_TO_OUTPUT: Record<string, OutputFormId> = {
  'Form 8960': 'f8960',
  'Open Form 8960': 'f8960',
  'Form 2210': 'f2210',
  'Open Form 2210': 'f2210',
  'Schedule C': 'schC',
  'Open Schedule C': 'schC',
  'Schedule A': 'schA',
  'Open Schedule A': 'schA',
  'Form 1098': 'schA',
  'Open Form 1098': 'schA',
  'Schedule 1': 'sch1',
  'Schedule D': 'schD',
  'Form 1040': '1040',
}

export function resolveOutputFormFromAction(label?: string, note?: string): OutputFormId | null {
  if (label && OPEN_FORM_TO_OUTPUT[label]) return OPEN_FORM_TO_OUTPUT[label]
  const hay = `${label ?? ''} ${note ?? ''}`.toLowerCase()
  if (hay.includes('8960')) return 'f8960'
  if (hay.includes('2210')) return 'f2210'
  if (hay.includes('schedule c') || hay.includes('sch c')) return 'schC'
  if (hay.includes('schedule a') || hay.includes('1098')) return 'schA'
  if (hay.includes('schedule d')) return 'schD'
  if (hay.includes('schedule 1')) return 'sch1'
  if (hay.includes('1040')) return '1040'
  return null
}

/** Attest config for a schedule / form output line (OutputFormViews fieldId). */
export type OutputLineAttest = {
  /** Key in summaryCheckedFields / reviewerConfirmedFields */
  fieldKey: string
  /** false = show empty slots only (calculated / display-only lines) */
  toggleable: boolean
}

/**
 * Maps output-form line fieldId → shared attest state key.
 * null = no Prep/Rev columns on this line (blank placeholders).
 */
const OUTPUT_LINE_ATTEST: Record<string, OutputLineAttest | null> = {
  // Schedule 1
  'sch1-1': null,
  'sch1-2': null,
  'sch1-3': { fieldKey: 'otherIncome', toggleable: true },
  'sch1-4': null,
  'sch1-5': null,
  'sch1-6': null,
  'sch1-7': null,
  'sch1-8': { fieldKey: 'otherIncome', toggleable: true },
  'sch1-10': { fieldKey: 'otherIncome', toggleable: true },
  'sch1-15': { fieldKey: 'seTax', toggleable: true },

  // Schedule C
  'schC-1': { fieldKey: 'otherIncome', toggleable: true },
  'schC-2': null,
  'schC-3': { fieldKey: 'schC-3', toggleable: false },
  'schC-4': null,
  'schC-5': { fieldKey: 'schC-5', toggleable: false },
  'schC-8': null,
  'schC-18': { fieldKey: 'schC-18', toggleable: true },
  'schC-22': { fieldKey: 'schC-22', toggleable: true },
  'schC-24a': { fieldKey: 'schC-24a', toggleable: true },
  'schC-28': { fieldKey: 'schC-28', toggleable: true },
  'schC-31': { fieldKey: 'otherIncome', toggleable: true },
  'schC-SE': { fieldKey: 'seTax', toggleable: true },

  // Schedule A
  'schA-5a': { fieldKey: 'schA-5a', toggleable: true },
  'schA-5b': { fieldKey: 'schA-5b', toggleable: true },
  'schA-5e': { fieldKey: 'schA-5e', toggleable: false },
  'schA-8a': { fieldKey: 'schA-8a', toggleable: true },
  'schA-11': { fieldKey: 'schA-11', toggleable: true },
  'schA-17': { fieldKey: 'stdDeduction', toggleable: true },
  'schA-std': { fieldKey: 'stdDeduction', toggleable: false },
  'schA-method': { fieldKey: 'stdDeduction', toggleable: true },

  // Schedule D
  'schD-1a': null,
  'schD-7': { fieldKey: 'schD-7', toggleable: false },
  'schD-8a': null,
  'schD-15': { fieldKey: 'schD-15', toggleable: false },
  'schD-16': { fieldKey: 'capitalGain', toggleable: true },

  // Form 8960
  'f8960-1': { fieldKey: 'taxableInterest', toggleable: true },
  'f8960-2': { fieldKey: 'ordinaryDivs', toggleable: true },
  'f8960-5a': { fieldKey: 'capitalGain', toggleable: true },
  'f8960-8': { fieldKey: 'f8960-8', toggleable: false },
  'f8960-13': { fieldKey: 'totalIncome', toggleable: false },
  'f8960-14': { fieldKey: 'f8960-14', toggleable: false },
  'f8960-15': { fieldKey: 'f8960-15', toggleable: false },
  'f8960-16': { fieldKey: 'f8960-16', toggleable: false },
  'f8960-17': { fieldKey: 'niitTax', toggleable: true },

  // Form 2210
  'f2210-1': { fieldKey: 'totalTax', toggleable: true },
  'f2210-6': { fieldKey: 'f2210-6', toggleable: false },
  'f2210-9': { fieldKey: 'totalWithholding', toggleable: true },
  'f2210-10': { fieldKey: 'f2210-10', toggleable: true },
  'f2210-11': { fieldKey: 'totalWithholding', toggleable: false },
  'f2210-17': { fieldKey: 'amountOwed', toggleable: true },
}

/** Lines with no mapping entry — attestable only when kind is source. */
export function getOutputLineAttest(
  fieldId: string,
  kind: 'source' | 'calc' = 'calc',
): OutputLineAttest | null {
  if (fieldId in OUTPUT_LINE_ATTEST) {
    return OUTPUT_LINE_ATTEST[fieldId] ?? null
  }
  if (kind === 'source') {
    return { fieldKey: fieldId, toggleable: true }
  }
  return null
}

/** fieldIds that have no attest mapping (for reporting). */
export const UNMAPPED_OUTPUT_LINES = Object.entries(OUTPUT_LINE_ATTEST)
  .filter(([, v]) => v === null)
  .map(([k]) => k)
