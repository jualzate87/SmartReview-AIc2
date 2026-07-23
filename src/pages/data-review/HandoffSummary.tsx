import { useState } from 'react'
import { Button } from '@ids-ts/button'
import '@ids-ts/button/dist/main.css'
import { ChevronDown, ChevronRight, Close } from '@design-systems/icons'
import type { HandoffJump, HandoffSnapshot } from '../../data/handoffSnapshot'
import { jumpActionLabel } from '../../data/handoffSnapshot'
import styles from '../../styles/data-review/HandoffSummary.module.css'

type Props = {
  snapshot: HandoffSnapshot
  /** overlay = modal; embedded = AI panel body */
  variant?: 'overlay' | 'embedded'
  onJump?: (jump: HandoffJump) => void
  onClose?: () => void
  /** Keep reviewing / dismiss without deciding */
  onContinue?: () => void
  onFinishAndFile?: () => void
  onPassToReviewer?: () => void
  onConfirmSend?: () => void
  onOpenAsReviewer?: () => void
  /** When true, show Pass 2 quick-link chips */
  showQuickLinks?: boolean
  /** Optional title override (Pass 2: “What Sara completed”) */
  titleOverride?: string
  subtitleOverride?: string
  /** Embedded Pass 2 briefing — no decide footer */
  hideFooter?: boolean
}

function bucketClass(bucket: 'critical' | 'done') {
  return bucket === 'critical' ? styles.bucketCritical : styles.bucketDone
}

export default function HandoffSummary({
  snapshot,
  variant = 'overlay',
  onJump,
  onClose,
  onContinue,
  onFinishAndFile,
  onPassToReviewer,
  onConfirmSend,
  onOpenAsReviewer,
  showQuickLinks = false,
  titleOverride,
  subtitleOverride,
  hideFooter = false,
}: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const s of snapshot.sections) {
      if (s.defaultOpen) initial.add(s.id)
    }
    return initial
  })

  const toggle = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const title =
    titleOverride ??
    (snapshot.mode === 'finish-and-file'
      ? 'Ready to file — snapshot'
      : snapshot.mode === 'awaiting-reviewer'
        ? 'Handoff sent — waiting for reviewer'
        : snapshot.mode === 'signoff-review'
          ? 'Review snapshot'
          : 'Handoff summary preview')

  const subtitle =
    subtitleOverride ??
    (snapshot.mode === 'finish-and-file'
      ? `Pass ${snapshot.pass} · ${snapshot.actorLabel}`
      : snapshot.mode === 'awaiting-reviewer'
        ? `Pass ${snapshot.pass} complete · Next person can open as reviewer`
        : snapshot.mode === 'signoff-review'
          ? `Pass ${snapshot.pass} · ${snapshot.actorLabel} · Critical items first, then what was done`
          : `Pass ${snapshot.pass} · Preview of what the next reviewer will see`)

  const body = (
    <>
      <header className={styles.header}>
        <div>
          <h2 id="handoff-title" className={styles.title}>{title}</h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        {variant === 'overlay' && onClose && (
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <Close size="small" />
          </button>
        )}
      </header>

      <div
        className={`${styles.verdict} ${
          snapshot.verdict.tone === 'clear' ? styles.verdictClear : styles.verdictAttention
        }`}
      >
        <p className={styles.verdictTitle}>{snapshot.verdict.title}</p>
        <p className={styles.verdictDetail}>{snapshot.verdict.detail}</p>
      </div>

      {showQuickLinks && snapshot.quickLinks.length > 0 && (
        <div className={styles.quickLinks} role="group" aria-label="Jump to sections">
          {snapshot.quickLinks.map(link => {
            const canAct = Boolean(link.jump || link.sectionId)
            return (
              <button
                key={link.id}
                type="button"
                className={styles.quickLink}
                disabled={!canAct}
                title={!canAct ? link.label : undefined}
                onClick={() => {
                  if (link.jump) onJump?.(link.jump)
                  else if (link.sectionId) {
                    setOpenIds(prev => new Set(prev).add(link.sectionId!))
                    document.getElementById(`handoff-sec-${link.sectionId}`)?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                    })
                  }
                }}
              >
                {link.label}
                <span className={styles.quickCount}>{link.count}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className={styles.body}>
        {snapshot.sections.map(section => {
          const isOpen = openIds.has(section.id)
          return (
            <section
              key={section.id}
              id={`handoff-sec-${section.id}`}
              className={`${styles.section} ${bucketClass(section.bucket)}`}
            >
              <button
                type="button"
                className={styles.sectionToggle}
                aria-expanded={isOpen}
                onClick={() => toggle(section.id)}
              >
                <span className={styles.sectionChevron}>
                  {isOpen ? <ChevronDown size="small" /> : <ChevronRight size="small" />}
                </span>
                <span className={styles.sectionTitle}>{section.title}</span>
                <span className={styles.sectionSummary}>{section.summary}</span>
              </button>
              {isOpen && (
                <ul className={styles.list}>
                  {section.items.map((item, i) => (
                    <li
                      key={`${section.id}-${i}`}
                      className={`${styles.item} ${item.status === 'open' ? styles.itemOpen : ''}`}
                    >
                      <div className={styles.itemText}>
                        <span className={styles.itemLabel}>{item.label}</span>
                        {item.detail && <span className={styles.itemDetail}>{item.detail}</span>}
                      </div>
                      {item.jump && onJump && (
                        <button
                          type="button"
                          className={styles.jumpBtn}
                          onClick={() => onJump(item.jump!)}
                        >
                          {item.jumpLabel ?? jumpActionLabel(item.jump)}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}

        <section className={`${styles.section} ${styles.sectionNext}`}>
          <h3 className={styles.sectionTitleStatic}>Suggested next</h3>
          <ul className={styles.nextList}>
            {snapshot.nextSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </section>
      </div>

      {!hideFooter && (
      <footer className={styles.footer}>
        {snapshot.mode === 'signoff-review' && (
          <>
            {onContinue && (
              <Button priority="tertiary" size="medium" onClick={onContinue}>
                Keep reviewing
              </Button>
            )}
            <div className={styles.footerSpacer} />
            {onPassToReviewer && (
              <Button priority="secondary" size="medium" onClick={onPassToReviewer}>
                Pass to next reviewer
              </Button>
            )}
            {onFinishAndFile && (
              <Button priority="primary" size="medium" onClick={onFinishAndFile}>
                Finish &amp; file
              </Button>
            )}
          </>
        )}
        {snapshot.mode === 'pass-to-reviewer' && (
          <>
            {onContinue && (
              <Button priority="tertiary" size="medium" onClick={onContinue}>
                Back
              </Button>
            )}
            <div className={styles.footerSpacer} />
            {onOpenAsReviewer && (
              <Button priority="secondary" size="medium" onClick={onOpenAsReviewer}>
                Open as reviewer
              </Button>
            )}
            {onConfirmSend && (
              <Button priority="primary" size="medium" onClick={onConfirmSend}>
                Send to reviewer
              </Button>
            )}
          </>
        )}
        {snapshot.mode === 'awaiting-reviewer' && (
          <>
            {onContinue && (
              <Button priority="tertiary" size="medium" onClick={onContinue}>
                Close
              </Button>
            )}
            <div className={styles.footerSpacer} />
            {onOpenAsReviewer && (
              <Button priority="primary" size="medium" onClick={onOpenAsReviewer}>
                Open as reviewer
              </Button>
            )}
          </>
        )}
        {snapshot.mode === 'finish-and-file' && (
          <>
            <div className={styles.footerSpacer} />
            {onContinue && (
              <Button priority="primary" size="medium" onClick={onContinue}>
                Mark ready to file
              </Button>
            )}
          </>
        )}
      </footer>
      )}
    </>
  )

  if (variant === 'embedded') {
    return (
      <div className={styles.embedded} role="region" aria-labelledby="handoff-title">
        {body}
      </div>
    )
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="handoff-title">
      <div className={styles.panel}>{body}</div>
    </div>
  )
}
