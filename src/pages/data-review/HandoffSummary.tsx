import { Button } from '@ids-ts/button'
import '@ids-ts/button/dist/main.css'
import { CircleCheck, Flag, Document } from '@design-systems/icons'
import type { HandoffSnapshot } from '../../data/handoffSnapshot'
import styles from '../../styles/data-review/HandoffSummary.module.css'

type Props = {
  snapshot: HandoffSnapshot
  /** Primary / secondary actions differ by mode */
  onPrimary: () => void
  onSecondary?: () => void
  onTertiary?: () => void
  primaryLabel: string
  secondaryLabel?: string
  tertiaryLabel?: string
  onClose?: () => void
}

function statusClass(status: 'done' | 'open' | 'info') {
  if (status === 'done') return styles.itemDone
  if (status === 'open') return styles.itemOpen
  return styles.itemInfo
}

export default function HandoffSummary({
  snapshot,
  onPrimary,
  onSecondary,
  onTertiary,
  primaryLabel,
  secondaryLabel,
  tertiaryLabel,
  onClose,
}: Props) {
  const title =
    snapshot.mode === 'finish-and-file'
      ? 'Ready to file — snapshot'
      : snapshot.mode === 'awaiting-reviewer'
        ? 'Handoff sent — waiting for reviewer'
        : 'Handoff summary preview'

  const subtitle =
    snapshot.mode === 'finish-and-file'
      ? `Pass ${snapshot.pass} · ${snapshot.actorLabel} · What was done and what’s suggested next`
      : snapshot.mode === 'awaiting-reviewer'
        ? `Pass ${snapshot.pass} complete · Next person can open as reviewer`
        : `Pass ${snapshot.pass} · Preview of what the next reviewer will see`

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="handoff-title">
      <div className={styles.panel}>
        <header className={styles.header}>
          <div>
            <h2 id="handoff-title" className={styles.title}>{title}</h2>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          {onClose && (
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
              Close
            </button>
          )}
        </header>

        <div className={styles.body}>
          {snapshot.sections.map(section => (
            <section key={section.id} className={styles.section}>
              <h3 className={styles.sectionTitle}>
                {section.id === 'checks' && <CircleCheck size="small" />}
                {section.id === 'flags' && <Flag size="small" />}
                {section.id === 'import' && <Document size="small" />}
                {section.title}
              </h3>
              <ul className={styles.list}>
                {section.items.map((item, i) => (
                  <li key={`${section.id}-${i}`} className={`${styles.item} ${statusClass(item.status)}`}>
                    <span className={styles.itemLabel}>{item.label}</span>
                    {item.detail && <span className={styles.itemDetail}>{item.detail}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Suggested next</h3>
            <ul className={styles.nextList}>
              {snapshot.nextSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </section>
        </div>

        <footer className={styles.footer}>
          {tertiaryLabel && onTertiary && (
            <Button priority="tertiary" size="medium" onClick={onTertiary}>
              {tertiaryLabel}
            </Button>
          )}
          <div className={styles.footerSpacer} />
          {secondaryLabel && onSecondary && (
            <Button priority="secondary" size="medium" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
          <Button priority="primary" size="medium" onClick={onPrimary}>
            {primaryLabel}
          </Button>
        </footer>
      </div>
    </div>
  )
}
