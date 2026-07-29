import { CircleCheck, CircleCheckFill } from '@design-systems/icons'
import {
  formatActivityMeta,
  REVIEWER_NAME,
  type ActivityEntry,
} from '../../hooks/useSyncedReviewState'
import Tooltip from './Tooltip'
import styles from '../../styles/data-review/LeftPanel1040.module.css'

type Props = {
  formLabel: string
  signoffKey: string
  signedOff: boolean
  signoffMeta?: ActivityEntry
  isReviewerRole: boolean
  onToggle?: (signoffKey: string) => void
  className?: string
}

export default function FormSignOffControl({
  formLabel,
  signoffKey,
  signedOff,
  signoffMeta,
  isReviewerRole,
  onToggle,
  className,
}: Props) {
  if (!isReviewerRole || !onToggle) return null

  const tooltip = signedOff && signoffMeta
    ? `Review complete · ${formatActivityMeta(signoffMeta)}`
    : `Mark ${formLabel} review complete`

  if (signedOff) {
    return (
      <Tooltip text={tooltip} placement="bottom">
        <button
          type="button"
          className={`${styles.formSignoffBtn} ${styles.formSignoffBtnDone} ${className ?? ''}`}
          onClick={() => onToggle(signoffKey)}
          aria-label={`${formLabel} review complete — click to undo`}
        >
          <CircleCheckFill size="small" aria-hidden />
          Review complete
        </button>
      </Tooltip>
    )
  }

  return (
    <button
      type="button"
      className={`${styles.formSignoffBtn} ${className ?? ''}`}
      onClick={() => onToggle(signoffKey)}
      aria-label={`Confirm ${formLabel}`}
    >
      <CircleCheck size="small" aria-hidden />
      Confirm {formLabel}
    </button>
  )
}

/** Shorthand label for sign-off stamp when meta missing */
export function reviewerSignoffStamp(meta?: ActivityEntry): string {
  if (!meta) return REVIEWER_NAME
  return meta.by
}
