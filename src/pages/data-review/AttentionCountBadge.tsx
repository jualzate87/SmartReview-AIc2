import { Badge } from '@ids-ts/badge'
import '@ids-ts/badge/dist/main.css'
import styles from '../../styles/data-review/AttentionCountBadge.module.css'

export function formatAttentionCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}

type AttentionCountBadgeProps = {
  count: number
  className?: string
  /** When set, the badge is decorative; parent control should expose count in aria-label. */
  'aria-hidden'?: boolean
  'aria-label'?: string
}

/** Round warning badge for unresolved import flags, confirm work, and toolbar counts. */
export default function AttentionCountBadge({
  count,
  className,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel,
}: AttentionCountBadgeProps) {
  if (count <= 0) return null

  return (
    <span
      className={[styles.wrap, className].filter(Boolean).join(' ')}
      aria-hidden={ariaHidden}
      aria-label={ariaLabel}
    >
      <Badge shape="round" status="warning" capitalization="sentence">
        {formatAttentionCount(count)}
      </Badge>
    </span>
  )
}
