import { CircleCheck } from '@design-systems/icons'
import type { ActivityEntry } from '../../hooks/useSyncedReviewState'
import Tooltip from './Tooltip'
import styles from '../../styles/data-review/LeftPanel1040.module.css'

export function preparerCheckTooltip(entry?: ActivityEntry | null): string {
  return entry ? `Verified by ${entry.by} · ${entry.at}` : 'Verify against source'
}

export function reviewerCheckTooltip(entry?: ActivityEntry | null): string {
  return entry ? `Confirmed by ${entry.by} · ${entry.at}` : 'Confirm for sign-off'
}

/** Prep / Rev attest slots — shared by Return Summary, Form 1040, and schedule output forms */
export default function AttestColumns({
  field,
  preparerEntry,
  reviewerEntry,
  isReviewerRole,
  onTogglePreparer,
  onToggleReviewer,
  interactive = true,
}: {
  field: string
  preparerEntry?: ActivityEntry
  reviewerEntry?: ActivityEntry
  isReviewerRole: boolean
  onTogglePreparer?: (fieldName: string) => void
  onToggleReviewer?: (fieldName: string) => void
  /** When false, show slots + existing checks but disable toggles (calculated lines) */
  interactive?: boolean
}) {
  if (!onTogglePreparer && !onToggleReviewer) return null

  const prepDisabled = !interactive || isReviewerRole
  const revDisabled = !interactive || !isReviewerRole

  return (
    <div className={styles.formAttestGroup}>
      <Tooltip text={preparerCheckTooltip(preparerEntry)} placement="top">
        <button
          type="button"
          className={[
            styles.summaryAttestCol,
            preparerEntry ? styles.summaryAttestColPrepActive : styles.summaryAttestColEmpty,
            prepDisabled ? styles.summaryAttestColReadonly : '',
          ].filter(Boolean).join(' ')}
          aria-label={preparerEntry ? `Verified by ${preparerEntry.by}` : 'Preparer verify'}
          disabled={prepDisabled}
          onClick={e => {
            e.stopPropagation()
            if (!prepDisabled) onTogglePreparer?.(field)
          }}
        >
          {preparerEntry ? <CircleCheck size="small" /> : null}
        </button>
      </Tooltip>
      <Tooltip text={reviewerCheckTooltip(reviewerEntry)} placement="top">
        <button
          type="button"
          className={[
            styles.summaryAttestCol,
            reviewerEntry ? styles.summaryAttestColRevActive : styles.summaryAttestColEmpty,
            revDisabled ? styles.summaryAttestColReadonly : '',
          ].filter(Boolean).join(' ')}
          aria-label={reviewerEntry ? `Confirmed by ${reviewerEntry.by}` : 'Reviewer confirm'}
          disabled={revDisabled}
          onClick={e => {
            e.stopPropagation()
            if (!revDisabled) onToggleReviewer?.(field)
          }}
        >
          {reviewerEntry ? <CircleCheck size="small" /> : null}
        </button>
      </Tooltip>
    </div>
  )
}
