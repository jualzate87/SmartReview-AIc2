import type { ReactNode } from 'react'
import { Close } from '@design-systems/icons'
import styles from '../../styles/data-review/ReviewSidePanel.module.css'

type Props = {
  title: string
  subtitle?: string
  titleId?: string
  onClose: () => void
  closeLabel?: string
  closing?: boolean
  children: ReactNode
  footer?: ReactNode
  /** Extra class on the shell (e.g. lower z-index for notes under summary) */
  className?: string
}

/**
 * Shared right-rail chassis for Comments and Review summary —
 * same width, header chrome, padding, close control, and header offset.
 */
export default function ReviewSidePanel({
  title,
  subtitle,
  titleId = 'side-panel-title',
  onClose,
  closeLabel = 'Close panel',
  closing = false,
  children,
  footer,
  className,
}: Props) {
  return (
    <aside
      className={`${styles.shell} ${closing ? styles.shellClosing : ''} ${className ?? ''}`}
      role="complementary"
      aria-labelledby={titleId}
    >
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
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
