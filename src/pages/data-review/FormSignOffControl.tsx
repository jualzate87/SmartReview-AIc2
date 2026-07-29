import { CircleCheck, CircleCheckFill } from '@design-systems/icons'
import {
  formatActivityMeta,
  REVIEWER_NAME,
  type ActivityEntry,
} from '../../hooks/useSyncedReviewState'
import Tooltip from './Tooltip'
import styles from '../../styles/data-review/LeftPanel1040.module.css'

type Props = {
  /** Full button label — e.g. "Sign off Form 1040" */
  signOffLabel: string
  signoffKey: string
  signedOff: boolean
  signoffMeta?: ActivityEntry
  isReviewerRole: boolean
  onToggle?: (signoffKey: string) => void
  className?: string
}

export default function FormSignOffControl({
  signOffLabel,
  signoffKey,
  signedOff,
  signoffMeta,
  isReviewerRole,
  onToggle,
  className,
}: Props) {
  if (!isReviewerRole || !onToggle) return null

  const tooltip = signedOff && signoffMeta
    ? `Signed off · ${formatActivityMeta(signoffMeta)}`
    : signOffLabel

  if (signedOff) {
    return (
      <Tooltip text={tooltip} placement="bottom">
        <button
          type="button"
          className={`${styles.formSignoffBtn} ${styles.formSignoffBtnDone} ${className ?? ''}`}
          onClick={() => onToggle(signoffKey)}
          aria-label={`${signOffLabel} — click to undo sign-off`}
        >
          <CircleCheckFill size="small" aria-hidden />
          Signed off
        </button>
      </Tooltip>
    )
  }

  return (
    <button
      type="button"
      className={`${styles.formSignoffBtn} ${className ?? ''}`}
      onClick={() => onToggle(signoffKey)}
      aria-label={signOffLabel}
    >
      <CircleCheck size="small" aria-hidden />
      {signOffLabel}
    </button>
  )
}

/** Shorthand label for sign-off stamp when meta missing */
export function reviewerSignoffStamp(meta?: ActivityEntry): string {
  if (!meta) return REVIEWER_NAME
  return meta.by
}
