import {
  formatDualCheckTooltip,
  getReviewActor,
  REVIEWER_NAME,
  type ActivityEntry,
} from '../../hooks/useSyncedReviewState'
import Tooltip from './Tooltip'
import { getVerifiedDocEntry, isVerifiedInSet } from '../../data/verifiedDocKeys'
import styles from '../../styles/data-review/DetailFields.module.css'

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M19.0711 7.0506C18.8836 6.86313 18.6293 6.75781 18.3641 6.75781C18.099 6.75781 17.8447 6.86313 17.6571 7.0506L9.87916 14.8286L6.34316 11.2936C6.15456 11.1115 5.90195 11.0107 5.63976 11.0129C5.37756 11.0152 5.12675 11.1204 4.94134 11.3058C4.75593 11.4912 4.65076 11.742 4.64848 12.0042C4.6462 12.2664 4.747 12.519 4.92916 12.7076L9.17216 16.9506C9.35968 17.1381 9.61399 17.2434 9.87916 17.2434C10.1443 17.2434 10.3986 17.1381 10.5861 16.9506L19.0711 8.4646C19.2586 8.27707 19.3639 8.02276 19.3639 7.7576C19.3639 7.49244 19.2586 7.23813 19.0711 7.0506Z" fill="currentColor"/>
    </svg>
  )
}

type Props = {
  docKey: string
  verifiedDocs?: Set<string>
  verifiedDocsMeta?: Map<string, ActivityEntry>
  reviewerConfirmedDocs?: Set<string>
  reviewerConfirmedDocsMeta?: Map<string, ActivityEntry>
  onVerifyDoc?: (docKey: string) => void
  onPreparerMarkVerified?: () => void
}

export default function DocVerifyHeaderActions({
  docKey,
  verifiedDocs,
  verifiedDocsMeta,
  reviewerConfirmedDocs,
  reviewerConfirmedDocsMeta,
  onVerifyDoc,
  onPreparerMarkVerified,
}: Props) {
  const isPreparerVerified = verifiedDocs ? isVerifiedInSet(verifiedDocs, docKey) : false
  const isReviewerConfirmed = reviewerConfirmedDocs ? isVerifiedInSet(reviewerConfirmedDocs, docKey) : false
  const isReviewerActor = getReviewActor() === REVIEWER_NAME
  const preparerMeta = getVerifiedDocEntry(verifiedDocsMeta, docKey)
  const reviewerMeta = getVerifiedDocEntry(reviewerConfirmedDocsMeta, docKey)
  const dualDocTooltip = formatDualCheckTooltip(preparerMeta, reviewerMeta)
  const verifiedTooltip = dualDocTooltip
    || (preparerMeta ? `Verified · ${preparerMeta.by} · ${preparerMeta.at}` : 'Click to unmark verified')
  const showVerifiedBadge = isPreparerVerified || isReviewerConfirmed
  const badgeLabel = isPreparerVerified && isReviewerConfirmed
    ? 'Verified · Confirmed'
    : isReviewerConfirmed
      ? 'Confirmed'
      : 'Verified'

  const handleMarkClick = () => {
    onVerifyDoc?.(docKey)
    if (!isReviewerActor) onPreparerMarkVerified?.()
  }

  return (
    <>
      {showVerifiedBadge ? (
        <Tooltip text={verifiedTooltip} placement="top">
          <button
            type="button"
            className={styles.verifiedBadge}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, gap: 4, display: 'flex', alignItems: 'center' }}
            onClick={() => onVerifyDoc?.(docKey)}
          >
            <CheckIcon size={14} /> {badgeLabel}
          </button>
        </Tooltip>
      ) : (
        <button type="button" className={styles.markVerifiedBtn} onClick={handleMarkClick}>
          {isReviewerActor ? 'Confirm document' : 'Mark as verified'}
        </button>
      )}
      {isReviewerActor && isPreparerVerified && !isReviewerConfirmed && (
        <button type="button" className={styles.markVerifiedBtn} onClick={() => onVerifyDoc?.(docKey)}>
          Confirm for sign-off
        </button>
      )}
    </>
  )
}
