import { useState } from 'react'
import { Button } from '@ids-ts/button'
import '@ids-ts/button/dist/main.css'
import { Badge, NumericBadge } from '@ids-ts/badge'
import '@ids-ts/badge/dist/main.css'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { B3 } from '@ids-ts/typography'
import '@ids-ts/typography/dist/main.css'
import { ChevronDown, ChevronRight, Close } from '@design-systems/icons'
import type { HandoffItem, HandoffJump, HandoffSnapshot } from '../../data/handoffSnapshot'
import { jumpActionLabel } from '../../data/handoffSnapshot'
import styles from '../../styles/data-review/HandoffSummary.module.css'

type Props = {
  snapshot: HandoffSnapshot
  variant?: 'overlay' | 'embedded'
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
    // NumericBadge is neutral-only. Badge `value` skips Badge-value (no orange fill).
    // Children render inside Badge-value, which gets warning orange from IDS + our pill CSS.
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
  titleOverride,
  subtitleOverride,
  hideFooter = false,
}: Props) {
  const [openSectionIds, setOpenSectionIds] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const s of snapshot.sections) {
      if (s.defaultOpen) initial.add(s.id)
    }
    return initial
  })
  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(() => new Set())

  const toggleSection = (id: string) => {
    setOpenSectionIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGroup = (id: string) => {
    setOpenGroupIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const title =
    titleOverride ??
    (snapshot.mode === 'finish-and-file'
      ? 'Ready to file'
      : snapshot.mode === 'awaiting-reviewer'
        ? 'Handoff sent'
        : snapshot.mode === 'signoff-review'
          ? 'Where things stand'
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

  const body = (
    <>
      <header className={styles.header}>
        <div>
          <h2 id="handoff-title" className={styles.title}>{title}</h2>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {variant === 'overlay' && onClose && (
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <Close size="small" />
          </button>
        )}
      </header>

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

      <div className={styles.body}>
        {snapshot.sections.map(section => {
          const isOpen = openSectionIds.has(section.id)
          const isCritical = section.bucket === 'critical'
          return (
            <section
              key={section.id}
              id={`handoff-sec-${section.id}`}
              className={styles.section}
            >
              <button
                type="button"
                className={styles.sectionToggle}
                aria-expanded={isOpen}
                onClick={() => toggleSection(section.id)}
              >
                <span className={styles.sectionChevron}>
                  {isOpen ? <ChevronDown size="small" /> : <ChevronRight size="small" />}
                </span>
                <span className={styles.sectionTitle}>{section.title}</span>
                <span className={styles.sectionBadge}>
                  <CountBadge
                    count={section.count}
                    countLabel={section.countLabel}
                    warning={isCritical && section.count > 0}
                  />
                </span>
              </button>
              {isOpen && (
                <>
                  {section.intro && <p className={styles.sectionIntro}>{section.intro}</p>}
                  {section.groups && section.groups.length > 0 ? (
                    <div className={styles.groupList}>
                      {section.groups.map(group => {
                        const groupOpen = openGroupIds.has(group.id)
                        return (
                          <div
                            key={group.id}
                            id={`handoff-group-${group.id}`}
                            className={styles.group}
                          >
                            <button
                              type="button"
                              className={styles.groupToggle}
                              aria-expanded={groupOpen}
                              onClick={() => toggleGroup(group.id)}
                            >
                              <span className={styles.sectionChevron}>
                                {groupOpen ? <ChevronDown size="small" /> : <ChevronRight size="small" />}
                              </span>
                              <span className={styles.groupTitle}>{group.title}</span>
                              <span className={styles.sectionBadge}>
                                <CountBadge
                                  count={group.count}
                                  countLabel={group.countLabel}
                                  warning
                                />
                              </span>
                            </button>
                            {groupOpen && (
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
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
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
                </>
              )}
            </section>
          )
        })}
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
