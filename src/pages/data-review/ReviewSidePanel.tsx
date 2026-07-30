import type { ReactNode } from 'react'
import { Close } from '@design-systems/icons'
import styles from '../../styles/data-review/ReviewSidePanel.module.css'

type Props = {
  title: string
  subtitle?: string
  /** Renders inline with subtitle (e.g. Pass 2 badge) */
  headerMeta?: ReactNode
  titleId?: string
  onClose: () => void
  closeLabel?: string
  closing?: boolean
  children: ReactNode
  footer?: ReactNode
  /** Extra class on the shell */
  className?: string
  /** Slide-in from right with Assist-style easing */
  enterAnim?: boolean
}

/**
 * In-rail chassis for Comments and Review summary.
 * Fills the unified DataReview right panel — never a fixed overlay.
 */
export default function ReviewSidePanel({
  title,
  subtitle,
  headerMeta,
  titleId = 'side-panel-title',
  onClose,
  closeLabel = 'Close panel',
  closing = false,
  children,
  footer,
  className,
  enterAnim = false,
}: Props) {
  return (
    <aside
      className={`${styles.shell} ${enterAnim ? styles.shellEnterFromRight : ''} ${closing ? styles.shellClosing : ''} ${className ?? ''}`}
      role="complementary"
      aria-labelledby={titleId}
    >
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          {(subtitle || headerMeta) ? (
            <div className={styles.subtitleRow}>
              {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
              {headerMeta}
            </div>
          ) : null}
        </div>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={closeLabel}>
          <Close size="small" />
        </button>
      </header>
      <div className={styles.body}>
        {children}
      </div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </aside>
  )
}

export { styles as sidePanelStyles }
