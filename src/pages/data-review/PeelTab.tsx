import { CircleCheck } from '@design-systems/icons'
import type { DocConfirmStatus } from './docReviewStatus'
import styles from '../../styles/data-review/PeelTab.module.css'

interface PeelTabProps {
  tabs: {
    key: string
    label: string
    badge?: number
    /** True when this payer originally had flags (or is verified) and count is 0 */
    showClearedCheck?: boolean
    /** Reviewer doc confirm state (Pass 2) */
    confirmStatus?: DocConfirmStatus
  }[]
  activeKey: string
  onChange: (key: string) => void
}

export default function PeelTab({ tabs, activeKey, onChange }: PeelTabProps) {
  return (
    <div className={styles.container}>
      {tabs.map(tab => {
        const isActive = tab.key === activeKey
        const count = tab.badge ?? 0
        const confirmStatus = tab.confirmStatus
        return (
          <button
            key={tab.key}
            type="button"
            className={[
              styles.tab,
              isActive ? styles.tabActive : styles.tabInactive,
              confirmStatus === 'confirmed' && !isActive ? styles.tabConfirmed : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
            {count > 0 && !tab.showClearedCheck && confirmStatus !== 'needs-confirm' && (
              <span className={`${styles.badge} ${isActive ? styles.badgeActive : styles.badgeInactive}`}>
                {count}
              </span>
            )}
            {confirmStatus === 'needs-confirm' && (
              <span
                className={`${styles.needsConfirmDot} ${isActive ? styles.needsConfirmDotActive : ''}`}
                aria-label="Needs reviewer confirmation"
                title="Needs reviewer confirmation"
              />
            )}
            {confirmStatus === 'confirmed' && (
              <span
                className={`${styles.clearedCheck} ${isActive ? styles.clearedCheckActive : ''}`}
                aria-label="Confirmed by reviewer"
              >
                <CircleCheck size="small" />
              </span>
            )}
            {!confirmStatus && tab.showClearedCheck && (
              <span
                className={`${styles.clearedCheck} ${isActive ? styles.clearedCheckActive : ''}`}
                aria-label="Document reviewed"
              >
                <CircleCheck size="small" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
