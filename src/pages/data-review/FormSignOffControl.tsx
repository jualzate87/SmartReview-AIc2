import {
  formatActivityMeta,
  REVIEWER_NAME,
  type ActivityEntry,
} from '../../hooks/useSyncedReviewState'
import Tooltip from './Tooltip'
import { Badge, SuccessBadgeIcon } from '@ids-ts/badge'
import '@ids-ts/badge/dist/main.css'
import { Button } from '@ids-ts/button'
import '@ids-ts/button/dist/main.css'
import detailStyles from '../../styles/data-review/DetailFields.module.css'

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

  const signerName = signoffMeta?.by ?? REVIEWER_NAME
  const tooltip = signedOff && signoffMeta
    ? `Signed off · ${formatActivityMeta(signoffMeta)}`
    : signOffLabel

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggle(signoffKey)
  }

  if (signedOff) {
    return (
      <Tooltip text={tooltip} placement="bottom">
        <button
          type="button"
          className={`${detailStyles.verifiedBadgeBtn} ${className ?? ''}`}
          onClick={handleToggle}
          aria-label={`${signOffLabel} — click to undo sign-off`}
        >
          <Badge
            shape="round"
            status="success"
            label={`Signed off by ${signerName}`}
            aria-label={`Signed off by ${signerName}`}
          >
            <SuccessBadgeIcon />
          </Badge>
        </button>
      </Tooltip>
    )
  }

  return (
    <Button
      size="small"
      priority="secondary"
      className={className}
      onClick={handleToggle}
      aria-label={signOffLabel}
    >
      {signOffLabel}
    </Button>
  )
}

/** Shorthand label for sign-off stamp when meta missing */
export function reviewerSignoffStamp(meta?: ActivityEntry): string {
  if (!meta) return REVIEWER_NAME
  return meta.by
}
