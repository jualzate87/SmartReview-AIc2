import { useState, type ReactNode } from 'react'
import { Button } from '@ids-ts/button'
import '@ids-ts/button/dist/main.css'
import { Badge, NumericBadge } from '@ids-ts/badge'
import '@ids-ts/badge/dist/main.css'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { B3 } from '@ids-ts/typography'
import '@ids-ts/typography/dist/main.css'
import type { HandoffItem, HandoffJump, HandoffSnapshot } from '../../data/handoffSnapshot'
import { jumpActionLabel } from '../../data/handoffSnapshot'
import ReviewSidePanel, { sidePanelStyles } from './ReviewSidePanel'
import styles from '../../styles/data-review/HandoffSummary.module.css'

type Props = {
  snapshot: HandoffSnapshot
  /** drawer = right-rail panel (default for continuous review); overlay kept for rare blocking confirms */
  variant?: 'drawer' | 'overlay' | 'embedded'
  onJump?: (jump: HandoffJump) => void
  onClose?: () => void
  onContinue?: () => void
  onFinishAndFile?: () => void
  onPassToReviewer?: () => void
  onConfirmSend?: () => void
  onOpenAsReviewer?: () => void
  /** @deprecated Chips removed */
  showQuickLinks?: boolean
  titleOverride?: string
  subtitleOverride?: string
  hideFooter?: boolean
  closing?: boolean
}

function CountBadge({
  count,
  countLabel,
  warning = false,
}: {
  count: number
  countLabel: string
  warning?: boolean
}) {
  if (count <= 0) return null
  if (warning) {
    return (
      <span className={styles.openCountBadgeWrap}>
        <Badge
          status="warning"
          priority="primary"
          capitalization="sentence"
          aria-label={countLabel}
          className={styles.openCountBadge}
        >
          {String(count)}
        </Badge>
      </span>
    )
  }
  return (
    <span className={styles.openCountBadgeWrap} aria-label={countLabel}>
      <NumericBadge quantity={count} />
    </span>
  )
}

function ItemRow({
  item,
  itemKey,
  onJump,
}: {
  item: HandoffItem
  itemKey: string
  onJump?: (jump: HandoffJump) => void
}) {
  return (
    <li
      key={itemKey}
      id={item.id ? `handoff-open-${item.id}` : undefined}
      className={styles.item}
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
  )
}

/** Compact “Show details” disclosure — story brief, not a findings accordion */
function DetailsDisclosure({
  id,
  label,
  count,
  countLabel,
  warning,
  defaultOpen = false,
  children,
}: {
  id: string
  label: string
  count?: number
  countLabel?: string
  warning?: boolean
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div id={id} className={styles.disclosure}>
      <button
        type="button"
        className={styles.disclosureToggle}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span className={styles.disclosureLabel}>
          {open ? 'Hide details' : 'Show details'}
          <span className={styles.disclosureHint}> · {label}</span>
        </span>
        {count != null && countLabel && (
          <span className={styles.sectionBadge}>
            <CountBadge count={count} countLabel={countLabel} warning={warning} />
          </span>
        )}
      </button>
      {open && <div className={styles.disclosureBody}>{children}</div>}
    </div>
  )
}

export default function HandoffSummary({
  snapshot,
  variant = 'drawer',
  onJump,
  onClose,
  onContinue,
  onFinishAndFile,
  onPassToReviewer,
  onConfirmSend,
  onOpenAsReviewer,
  titleOverride,
  subtitleOverride,
  hideFooter = false,
  closing = false,
}: Props) {
  const title =
    titleOverride ??
    (snapshot.mode === 'finish-and-file'
      ? 'Ready to file'
      : snapshot.mode === 'awaiting-reviewer'
        ? 'Handoff sent'
        : snapshot.mode === 'signoff-review'
          ? 'Review summary'
          : 'Handoff preview')

  const subtitle =
    subtitleOverride !== undefined
      ? subtitleOverride
      : snapshot.mode === 'finish-and-file'
        ? `Pass ${snapshot.pass} · ${snapshot.actorLabel}`
        : snapshot.mode === 'awaiting-reviewer'
          ? `Pass ${snapshot.pass} complete · Next person can open as reviewer`
          : snapshot.mode === 'signoff-review'
            ? `Pass ${snapshot.pass} · ${snapshot.actorLabel}`
            : `Pass ${snapshot.pass} · Preview for the next reviewer`

  const verdictType = snapshot.verdict.tone === 'clear' ? 'success' : 'warn'

  const footerActions = !hideFooter ? (
    <>
      {snapshot.mode === 'signoff-review' && (
        <>
          {onContinue && (
            <Button priority="tertiary" size="medium" onClick={onContinue}>
              Keep reviewing
            </Button>
          )}
          <div className={sidePanelStyles.footerSpacer} />
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
          <div className={sidePanelStyles.footerSpacer} />
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
          <div className={sidePanelStyles.footerSpacer} />
          {onOpenAsReviewer && (
            <Button priority="primary" size="medium" onClick={onOpenAsReviewer}>
              Open as reviewer
            </Button>
          )}
        </>
      )}
      {snapshot.mode === 'finish-and-file' && (
        <>
          <div className={sidePanelStyles.footerSpacer} />
          {onContinue && (
            <Button priority="primary" size="medium" onClick={onContinue}>
              Mark ready to file
            </Button>
          )}
        </>
      )}
    </>
  ) : null

  const briefContent = (
    <div className={`${sidePanelStyles.scroll} ${styles.brief}`}>
      {snapshot.story.length > 0 && (
        <div className={styles.story}>
          {snapshot.story.map((para, i) => (
            <p key={i} className={styles.storyPara}>{para}</p>
          ))}
        </div>
      )}

      <div className={styles.verdictWrap}>
        <PageMessage
          type={verdictType}
          title={snapshot.verdict.title}
          open
          dismissible={false}
          automationId="handoff-verdict"
        >
          <B3>{snapshot.verdict.detail}</B3>
        </PageMessage>
      </div>

      <div className={styles.sections}>
        {snapshot.sections.map(section => {
          const isCritical = section.bucket === 'critical'
          const hasGroups = !!(section.groups && section.groups.length > 0)
          const hasItems = section.items.length > 0
          const showDetails = hasGroups || (hasItems && section.items.some(i => i.status !== 'info'))

          return (
            <section
              key={section.id}
              id={`handoff-sec-${section.id}`}
              className={styles.storySection}
            >
              <div className={styles.storySectionHead}>
                <h3 className={styles.storySectionTitle}>{section.title}</h3>
                <span className={styles.sectionBadge}>
                  <CountBadge
                    count={section.count}
                    countLabel={section.countLabel}
                    warning={isCritical && section.count > 0}
                  />
                </span>
              </div>
              {section.intro && (
                <p className={styles.sectionIntro}>{section.intro}</p>
              )}

              {!showDetails && hasItems && (
                <ul className={styles.list}>
                  {section.items.map((item, i) => (
                    <ItemRow
                      key={item.id ?? `${section.id}-${i}`}
                      item={item}
                      itemKey={item.id ?? `${section.id}-${i}`}
                      onJump={onJump}
                    />
                  ))}
                </ul>
              )}

              {hasGroups && (
                <div className={styles.groupStack}>
                  {section.groups!.map(group => (
                    <DetailsDisclosure
                      key={group.id}
                      id={`handoff-group-${group.id}`}
                      label={group.title}
                      count={group.count}
                      countLabel={group.countLabel}
                      warning={isCritical}
                      defaultOpen={false}
                    >
                      <ul className={styles.list}>
                        {group.items.map((item, i) => (
                          <ItemRow
                            key={item.id ?? `${group.id}-${i}`}
                            item={item}
                            itemKey={item.id ?? `${group.id}-${i}`}
                            onJump={onJump}
                          />
                        ))}
                      </ul>
                    </DetailsDisclosure>
                  ))}
                </div>
              )}

              {!hasGroups && showDetails && (
                <DetailsDisclosure
                  id={`handoff-details-${section.id}`}
                  label={section.title}
                  count={section.count}
                  countLabel={section.countLabel}
                  warning={isCritical && section.count > 0}
                  defaultOpen={section.defaultOpen}
                >
                  <ul className={styles.list}>
                    {section.items.map((item, i) => (
                      <ItemRow
                        key={item.id ?? `${section.id}-${i}`}
                        item={item}
                        itemKey={item.id ?? `${section.id}-${i}`}
                        onJump={onJump}
                      />
                    ))}
                  </ul>
                </DetailsDisclosure>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )

  if (variant === 'embedded') {
    return (
      <div className={styles.embedded} role="region" aria-labelledby="handoff-title">
        <h2 id="handoff-title" className={styles.embeddedTitle}>{title}</h2>
        {subtitle ? <p className={styles.embeddedSubtitle}>{subtitle}</p> : null}
        {briefContent}
        {!hideFooter && footerActions && (
          <footer className={styles.embeddedFooter}>{footerActions}</footer>
        )}
      </div>
    )
  }

  if (variant === 'drawer') {
    if (!onClose) return null
    return (
      <ReviewSidePanel
        title={title}
        subtitle={subtitle || undefined}
        titleId="handoff-title"
        onClose={onClose}
        closeLabel="Close summary"
        closing={closing}
        footer={!hideFooter ? footerActions : undefined}
      >
        {briefContent}
      </ReviewSidePanel>
    )
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="handoff-title">
      <div className={styles.panel}>
        <header className={styles.overlayHeader}>
          <div>
            <h2 id="handoff-title" className={styles.embeddedTitle}>{title}</h2>
            {subtitle ? <p className={styles.embeddedSubtitle}>{subtitle}</p> : null}
          </div>
          {onClose && (
            <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="Close summary">
              ×
            </button>
          )}
        </header>
        {briefContent}
        {!hideFooter && footerActions && (
          <footer className={styles.embeddedFooter}>{footerActions}</footer>
        )}
      </div>
    </div>
  )
}
