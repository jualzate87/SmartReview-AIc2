import { Comment, Flag } from '@design-systems/icons'
import Tooltip from './Tooltip'
import styles from '../../styles/data-review/LeftPanel1040.module.css'

/** Comment + flag icon buttons — always visible on output form rows (Summary, 1040, schedules). */
export default function OutputRowActions({
  label,
  commentOpen = false,
  flagNoteOpen = false,
  isFlagged = false,
  flagTooltip = 'Flag this row for follow-up',
  showComment = false,
  showFlag = false,
  onCommentClick,
  onFlagClick,
  className,
}: {
  label: string
  commentOpen?: boolean
  flagNoteOpen?: boolean
  isFlagged?: boolean
  flagTooltip?: string
  showComment?: boolean
  showFlag?: boolean
  onCommentClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  onFlagClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  className?: string
}) {
  const rootCls = className ?? styles.outputRowEndActions

  return (
    <div className={rootCls}>
      {showComment ? (
        <Tooltip text="Add a comment" placement="top" disabled={commentOpen}>
          <button
            type="button"
            className={`${styles.summaryActionBtn} ${commentOpen ? styles.summaryActionBtnActive : ''}`}
            aria-label={`Add comment for ${label}`}
            onClick={onCommentClick}
          >
            <Comment size="small" />
          </button>
        </Tooltip>
      ) : (
        <span className={styles.summaryActionBtnSlot} aria-hidden="true" />
      )}
      {showFlag ? (
        <Tooltip text={flagTooltip} placement="top" disabled={flagNoteOpen}>
          <button
            type="button"
            className={`${styles.summaryActionBtn} ${isFlagged ? styles.summaryActionBtnFlag : ''} ${flagNoteOpen ? styles.summaryActionBtnActive : ''}`}
            aria-label={isFlagged ? `Remove flag from ${label}` : `Flag ${label} for follow-up`}
            aria-pressed={isFlagged}
            onClick={e => {
              e.stopPropagation()
              onFlagClick?.(e)
            }}
          >
            <Flag size="small" aria-hidden />
          </button>
        </Tooltip>
      ) : (
        <span className={styles.summaryActionBtnSlot} aria-hidden="true" />
      )}
    </div>
  )
}
