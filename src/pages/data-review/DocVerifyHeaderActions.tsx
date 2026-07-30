import {
  getReviewActor,
  REVIEWER_NAME,
  type ActivityEntry,
} from '../../hooks/useSyncedReviewState'
import Tooltip from './Tooltip'
import { Badge, SuccessBadgeIcon, WarningBadgeIcon } from '@ids-ts/badge'
import '@ids-ts/badge/dist/main.css'
import { Button } from '@ids-ts/button'
import '@ids-ts/button/dist/main.css'
import { getVerifiedDocEntry, isVerifiedInSet } from '../../data/verifiedDocKeys'
import styles from '../../styles/data-review/DetailFields.module.css'

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
  const preparerName = preparerMeta?.by ?? 'preparer'
  const preparerTooltip = preparerMeta
    ? `Verified by ${preparerMeta.by} · ${preparerMeta.at}`
    : 'Click to unmark verified'
  const reviewerTooltip = reviewerMeta
    ? `Confirmed by ${reviewerMeta.by} · ${reviewerMeta.at}`
    : 'Click to remove confirmation'

  const handlePreparerMark = () => {
    onVerifyDoc?.(docKey)
    onPreparerMarkVerified?.()
  }

  const needsReviewerConfirm =
    isReviewerActor && isPreparerVerified && !isReviewerConfirmed

  return (
    <div className={styles.verifyStatusGroup}>
      {needsReviewerConfirm && (
        <Tooltip text="Needs confirmation" placement="top">
          <span className={styles.needsConfirmIconWrap}>
            <Badge
              shape="round"
              status="warning"
              aria-label="Needs confirmation"
            >
              <WarningBadgeIcon />
            </Badge>
          </span>
        </Tooltip>
      )}

      {isPreparerVerified && (
        <Tooltip text={preparerTooltip} placement="top">
          {isReviewerActor ? (
            <Badge
              shape="round"
              status="success"
              label={`Verified by ${preparerName}`}
              aria-label={`Verified by ${preparerName}`}
            >
              <SuccessBadgeIcon />
            </Badge>
          ) : (
            <button
              type="button"
              className={styles.preparerVerifiedBtn}
              onClick={() => onVerifyDoc?.(docKey)}
              aria-label={preparerTooltip}
            >
              <Badge
                shape="round"
                status="success"
                label={`Verified by ${preparerName}`}
              >
                <SuccessBadgeIcon />
              </Badge>
            </button>
          )}
        </Tooltip>
      )}

      {!isPreparerVerified && !isReviewerActor && (
        <Button size="small" priority="secondary" onClick={handlePreparerMark}>
          Mark as verified
        </Button>
      )}

      {needsReviewerConfirm && (
        <Button size="small" priority="primary" onClick={() => onVerifyDoc?.(docKey)}>
          Confirm document
        </Button>
      )}

      {isReviewerConfirmed && (
        <Tooltip text={reviewerTooltip} placement="top">
          {isReviewerActor ? (
            <button
              type="button"
              className={styles.confirmedBadgeBtn}
              onClick={() => onVerifyDoc?.(docKey)}
              aria-label={reviewerTooltip}
            >
              <Badge
                shape="round"
                status="success"
                label="Confirmed"
                capitalization="sentence"
                priority="secondary"
              >
                <SuccessBadgeIcon />
              </Badge>
            </button>
          ) : (
            <Badge
              shape="round"
              status="success"
              label="Confirmed"
              capitalization="sentence"
              priority="secondary"
              aria-label={reviewerTooltip}
            >
              <SuccessBadgeIcon />
            </Badge>
          )}
        </Tooltip>
      )}
    </div>
  )
}
