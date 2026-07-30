import { Button } from '@ids-ts/button'
import '@ids-ts/button/dist/main.css'
import { AiSparkles } from '@design-systems/icons'
import intuitAssistIcon from '../../assets/icons/intuit-assist.svg'
import styles from '../../styles/data-review/ReviewerAssistWelcome.module.css'

export const REVIEWER_ASSIST_WELCOME_KEY = 'protoc2-assist-welcome-reviewer'

export function readReviewerWelcomeShown(): boolean {
  try {
    return sessionStorage.getItem(REVIEWER_ASSIST_WELCOME_KEY) === '1'
  } catch {
    return false
  }
}

export function markReviewerWelcomeShown(): void {
  try {
    sessionStorage.setItem(REVIEWER_ASSIST_WELCOME_KEY, '1')
  } catch { /* ignore */ }
}

interface ReviewerAssistWelcomeProps {
  reviewerFirstName: string
  preparerName: string
  visible: boolean
  exiting?: boolean
  onDismiss: () => void
}

/**
 * One-shot Intuit Assist welcome when a reviewer lands on Pass 2 after Review return.
 * Non-blocking toast — auto-dismisses after ~3s or on Continue.
 */
export default function ReviewerAssistWelcome({
  reviewerFirstName,
  preparerName,
  visible,
  exiting = false,
  onDismiss,
}: ReviewerAssistWelcomeProps) {
  if (!visible) return null

  const preparerFirst = preparerName.split(' ')[0]

  return (
    <div
      className={`${styles.toastWrap} ${exiting ? styles.toastWrapExiting : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Welcome, ${reviewerFirstName}`}
    >
      <div className={styles.toast}>
        <div className={styles.iconRow}>
          <img src={intuitAssistIcon} alt="" className={styles.assistIcon} />
          <span className={styles.sparkle} aria-hidden>
            <AiSparkles size="small" />
          </span>
        </div>
        <div className={styles.text}>
          <p className={styles.greeting}>
            Welcome, {reviewerFirstName}.
          </p>
          <p className={styles.body}>
            {preparerFirst} handed off this return — here&apos;s your checklist.
          </p>
        </div>
        <Button priority="secondary" size="small" onClick={onDismiss}>
          Continue
        </Button>
      </div>
    </div>
  )
}
