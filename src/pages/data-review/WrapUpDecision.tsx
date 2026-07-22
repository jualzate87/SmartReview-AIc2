import { Button } from '@ids-ts/button'
import '@ids-ts/button/dist/main.css'
import styles from '../../styles/data-review/HandoffSummary.module.css'

type Props = {
  pass: 1 | 2
  actorLabel: string
  onFinishAndFile: () => void
  onPassToReviewer: () => void
  onContinue: () => void
}

/**
 * End-of-pass fork: Finish & file vs Pass to next reviewer/approver.
 */
export default function WrapUpDecision({
  pass,
  actorLabel,
  onFinishAndFile,
  onPassToReviewer,
  onContinue,
}: Props) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="wrapup-title">
      <div className={styles.decisionPanel}>
        <h2 id="wrapup-title" className={styles.title}>Wrap up this pass</h2>
        <p className={styles.subtitle}>
          Pass {pass} · {actorLabel}. Choose how this return moves next — you can preview the handoff before sending.
        </p>
        <div className={styles.decisionChoices}>
          <button type="button" className={styles.choiceCard} onClick={onFinishAndFile}>
            <span className={styles.choiceTitle}>Finish &amp; file</span>
            <span className={styles.choiceBody}>
              See a snapshot of what was done and what’s suggested next, then mark ready to file.
            </span>
          </button>
          <button type="button" className={styles.choiceCard} onClick={onPassToReviewer}>
            <span className={styles.choiceTitle}>Pass to next reviewer / approver</span>
            <span className={styles.choiceBody}>
              Preview the handoff summary (audit trail, open items, who verified), then send it on.
            </span>
          </button>
        </div>
        <footer className={styles.footer}>
          <div className={styles.footerSpacer} />
          <Button priority="tertiary" size="medium" onClick={onContinue}>
            Keep reviewing
          </Button>
        </footer>
      </div>
    </div>
  )
}
