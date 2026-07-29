import { useEffect, useMemo, useState } from 'react'
import { PREPARER_NAME } from '../../hooks/useSyncedReviewState'
import { Button } from '@ids-ts/button'
import '@ids-ts/button/dist/main.css'
import { Badge } from '@ids-ts/badge'
import '@ids-ts/badge/dist/main.css'
import { B3 } from '@ids-ts/typography'
import '@ids-ts/typography/dist/main.css'
import { Tabs, Tab } from '@ids-ts/tabs'
import '@ids-ts/tabs/dist/main.css'
import { AiSparkles, ChevronRight, CircleCheck, CircleCheckFill } from '@design-systems/icons'
import type { HandoffJump, HandoffSnapshot } from '../../data/handoffSnapshot'
import type { LiveAmounts } from '../../data/liveReturn'
import type { ReviewChecklistState } from '../../data/reviewChecklist'
import {
  buildSmartReviewBrief,
  canApproveSignOff,
  type ActivityLogCategory,
  type BriefPhase,
  type BriefTextPart,
  type ConversationalBrief,
  type StrategicChecklistItem,
} from '../../data/smartReviewBrief'
import ReviewSidePanel, { sidePanelStyles } from './ReviewSidePanel'
import styles from '../../styles/data-review/HandoffSummary.module.css'

type Props = {
  snapshot: HandoffSnapshot
  variant?: 'drawer' | 'overlay' | 'embedded'
  onJump?: (jump: HandoffJump) => void
  onClose?: () => void
  onContinue?: () => void
  onFinishAndFile?: () => void
  onPassToReviewer?: () => void
  onConfirmSend?: () => void
  onOpenAsReviewer?: () => void
  titleOverride?: string
  subtitleOverride?: string
  hideFooter?: boolean
  closing?: boolean
  checklist?: ReviewChecklistState
  showChecklist?: boolean
  onToggleChecklistItem?: (itemId: string, checked: boolean) => void
  signOffReady?: boolean
  signOffBlockerText?: string | null
  outstandingOpenCount?: number
  manualChecklistItems?: Record<string, boolean>
  reviewPass?: 1 | 2
  isPreparer?: boolean
  amounts?: LiveAmounts
}

function JumpLink({
  label,
  jump,
  onJump,
}: {
  label: string
  jump: HandoffJump
  onJump?: (jump: HandoffJump) => void
}) {
  if (!onJump) return null
  return (
    <button type="button" className={styles.jumpLink} onClick={() => onJump(jump)}>
      {label}
      <ChevronRight size="small" className={styles.jumpLinkIcon} aria-hidden />
    </button>
  )
}

function PhaseVerifiedBadge({ status }: { status: 'action-needed' | 'verified' }) {
  if (status !== 'verified') return null
  return (
    <Badge status="success" priority="secondary" capitalization="sentence" className={styles.phasePill}>
      Verified
    </Badge>
  )
}

function ChecklistStatusIcon({
  item,
  onToggle,
}: {
  item: StrategicChecklistItem
  onToggle?: (itemId: string, checked: boolean) => void
}) {
  const isComplete = item.checked
  const canToggle = !!onToggle && !item.locked

  /* Auto-verified / locked complete — filled green check, not interactive */
  if (item.locked && isComplete) {
    return (
      <span className={styles.checklistIconSlot} aria-hidden>
        <CircleCheckFill size="small" className={styles.checklistSuccessIcon} />
      </span>
    )
  }

  /* Locked incomplete (open items) — muted checkmark, not interactive */
  if (item.locked && !isComplete) {
    return (
      <span className={styles.checklistIconSlot} aria-label={`${item.title} pending`}>
        <CircleCheck size="small" className={styles.checklistCheckEmptyLocked} aria-hidden />
      </span>
    )
  }

  /* Manual items — same checkmark-button language as output-form attest columns */
  return (
    <span className={styles.checklistIconSlot}>
      <button
        type="button"
        className={[
          styles.checklistCheckBtn,
          isComplete ? styles.checklistCheckBtnActive : styles.checklistCheckBtnEmpty,
        ].join(' ')}
        aria-label={isComplete ? `Mark ${item.title} incomplete` : `Mark ${item.title} complete`}
        disabled={!canToggle}
        onClick={() => onToggle?.(item.id, !isComplete)}
      >
        {isComplete ? (
          <CircleCheckFill size="small" className={styles.checklistSuccessIcon} aria-hidden />
        ) : (
          <CircleCheck size="small" aria-hidden />
        )}
      </button>
    </span>
  )
}

function ChecklistItemRow({
  item,
  onJump,
  onToggle,
  showDivider,
}: {
  item: StrategicChecklistItem
  onJump?: (jump: HandoffJump) => void
  onToggle?: (itemId: string, checked: boolean) => void
  showDivider?: boolean
}) {
  const isComplete = item.checked

  return (
    <li
      className={[
        styles.checklistRow,
        isComplete ? styles.checklistRowComplete : '',
        showDivider ? styles.checklistRowDivider : '',
      ].filter(Boolean).join(' ')}
    >
      <div className={styles.checklistRowMain}>
        <div className={styles.checklistCheck}>
          <ChecklistStatusIcon item={item} onToggle={onToggle} />
          <div className={styles.checklistText}>
            <span className={`${styles.checklistTitle} ${isComplete ? styles.checklistTitleDone : ''}`}>
              {item.title}
            </span>
            {item.note && (
              <p className={`${styles.checklistNote} ${isComplete ? styles.checklistNoteDone : ''}`}>
                {item.note}
              </p>
            )}
          </div>
        </div>
        {item.jump && item.jumpLabel && (
          <JumpLink label={item.jumpLabel} jump={item.jump} onJump={onJump} />
        )}
      </div>
    </li>
  )
}

function PhaseCard({
  phase,
  onJump,
  onToggle,
}: {
  phase: BriefPhase
  onJump?: (jump: HandoffJump) => void
  onToggle?: (itemId: string, checked: boolean) => void
}) {
  if (phase.items.length === 0) return null
  return (
    <article className={styles.phaseCard}>
      <header className={styles.phaseCardHead}>
        <div className={styles.phaseCardHeadText}>
          <h3 className={styles.phaseCardTitle}>{phase.title}</h3>
          <p className={styles.phaseCardDescription}>{phase.description}</p>
        </div>
        <PhaseVerifiedBadge status={phase.status} />
      </header>
      <ul className={styles.phaseItemList}>
        {phase.items.map((item, index) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            onJump={onJump}
            onToggle={onToggle}
            showDivider={index > 0}
          />
        ))}
      </ul>
    </article>
  )
}

function ActivityCategoryCard({ category }: { category: ActivityLogCategory }) {
  return (
    <article className={styles.activityCard}>
      <header className={styles.activityCardHead}>
        <h3 className={styles.activityCardTitle}>{category.title}</h3>
        {category.badge && (
          <span className={styles.activityBadge}>
            <CircleCheckFill size="x-small" aria-hidden />
            {category.badge}
          </span>
        )}
      </header>
      {category.entries.length === 0 ? (
        <p className={styles.activityEmpty}>Nothing recorded yet.</p>
      ) : (
        <ul className={styles.activityList}>
          {category.entries.map((entry, index) => (
            <li
              key={entry.id}
              className={[
                styles.activityEntry,
                index > 0 ? styles.activityEntryDivider : '',
              ].filter(Boolean).join(' ')}
            >
              <span className={styles.activityCheckIcon} aria-hidden>
                <CircleCheckFill size="small" />
              </span>
              <div className={styles.activityEntryText}>
                <span className={styles.activityEntryLabel}>{entry.label}</span>
                {entry.detail && (
                  <span className={styles.activityEntryDetail}>{entry.detail}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function BriefTextLine({ parts }: { parts: BriefTextPart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.bold ? (
          <strong key={index} className={styles.briefEmphasis}>
            {part.text}
          </strong>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  )
}

function ConversationalBriefCard({ brief }: { brief: ConversationalBrief }) {
  return (
    <section className={styles.conversationalBrief} aria-labelledby="executive-brief-heading">
      <div className={styles.conversationalBriefHead}>
        <span className={styles.conversationalBriefIcon} aria-hidden>
          <AiSparkles size="small" />
        </span>
        <div className={styles.conversationalBriefHeadText}>
          <h3 id="executive-brief-heading" className={styles.conversationalBriefHeading}>
            {brief.heading}
          </h3>
          <B3 className={styles.conversationalBriefIntro}>{brief.intro}</B3>
        </div>
      </div>

      <div className={styles.conversationalBriefSection}>
        <h4 className={styles.conversationalBriefSectionLabel}>
          <CircleCheckFill size="x-small" className={styles.conversationalBriefSectionIconDone} aria-hidden />
          {brief.completed.label}
        </h4>
        <ul className={styles.conversationalBriefList}>
          {brief.completed.items.map(item => (
            <li key={item.id} className={styles.conversationalBriefListItem}>
              <B3 className={styles.conversationalBriefListText}>
                <BriefTextLine parts={item.parts} />
              </B3>
            </li>
          ))}
        </ul>
      </div>

      {brief.attention && (
        <div className={styles.conversationalBriefSection}>
          <h4 className={styles.conversationalBriefSectionLabel}>
            {brief.attention.label}
          </h4>
          <ul className={styles.conversationalBriefList}>
            {brief.attention.items.map(item => (
              <li key={item.id} className={styles.conversationalBriefListItem}>
                <B3 className={styles.conversationalBriefListText}>
                  <BriefTextLine parts={item.parts} />
                </B3>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className={styles.conversationalBriefSynced}>{brief.syncedAt}</p>
    </section>
  )
}

function ReviewerChecklistTab({
  phases,
  executiveBrief,
  onJump,
  onToggle,
}: {
  phases: BriefPhase[]
  executiveBrief: ConversationalBrief | null
  onJump?: (jump: HandoffJump) => void
  onToggle?: (itemId: string, checked: boolean) => void
}) {
  return (
    <div className={styles.tabPanel}>
      {executiveBrief && <ConversationalBriefCard brief={executiveBrief} />}
      <div className={styles.phaseStack}>
        {phases.map(phase => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            onJump={onJump}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  )
}

function ActivityLogTab({ categories }: { categories: ActivityLogCategory[] }) {
  return (
    <div className={styles.tabPanel}>
      <p className={styles.activityIntro}>
        Read-only audit trail from Pass 1. Green checks show what {PREPARER_NAME.split(' ')[0]} cleared before handoff.
      </p>
      <div className={styles.activityStack}>
        {categories.map(cat => (
          <ActivityCategoryCard key={cat.id} category={cat} />
        ))}
      </div>
    </div>
  )
}

function PreparerSummaryTab({ categories, actorLabel }: { categories: ActivityLogCategory[]; actorLabel: string }) {
  return (
    <div className={styles.tabPanel}>
      <p className={styles.activityIntro}>
        Summary of your work on this pass. This is what the next reviewer will see in the activity log.
      </p>
      <div className={styles.activityStack}>
        {categories.map(cat => (
          <ActivityCategoryCard key={cat.id} category={cat} />
        ))}
      </div>
      {categories.every(c => c.entries.length === 0) && (
        <p className={styles.activityEmpty}>
          No completed actions recorded yet for {actorLabel}.
        </p>
      )}
    </div>
  )
}

function PassBadge({ label }: { label: string }) {
  return (
    <Badge status="info" priority="secondary" capitalization="sentence" className={styles.passBadge}>
      {label}
    </Badge>
  )
}

function BriefHeaderMeta({ pass1Line, passBadge }: { pass1Line: string; passBadge: string | null }) {
  return (
    <div className={styles.briefMeta}>
      <span className={styles.pass1Line}>{pass1Line}</span>
      {passBadge ? <PassBadge label={passBadge} /> : null}
    </div>
  )
}

function BriefStickyHeader({
  title,
  pass1Line,
  passBadge,
}: {
  title: string
  pass1Line: string
  passBadge: string | null
}) {
  return (
    <div className={styles.stickyHeader}>
      <h2 className={styles.briefTitle}>{title}</h2>
      <BriefHeaderMeta pass1Line={pass1Line} passBadge={passBadge} />
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
  hideFooter = false,
  closing = false,
  checklist,
  showChecklist = false,
  onToggleChecklistItem,
  signOffReady: _signOffReadyProp,
  signOffBlockerText: _signOffBlockerText,
  outstandingOpenCount = 0,
  manualChecklistItems = {},
  reviewPass = snapshot.pass,
  isPreparer = false,
  amounts,
}: Props) {
  const brief = useMemo(
    () =>
      buildSmartReviewBrief({
        snapshot,
        checklist: checklist ?? { items: [], completeCount: 0, totalCount: 0, requiredCompleteCount: 0, requiredTotal: 0, allRequiredComplete: true, blockers: [] },
        outstandingOpenCount,
        manualChecklistItems,
        reviewPass,
        showStrategicChecklist: showChecklist,
        isPreparer,
        amounts,
      }),
    [snapshot, checklist, outstandingOpenCount, manualChecklistItems, reviewPass, showChecklist, isPreparer, amounts],
  )

  const signOffReady = canApproveSignOff(brief)

  const [activeTab, setActiveTab] = useState(
    brief.viewMode === 'reviewer-strategic' ? 'checklist' : 'activity',
  )

  useEffect(() => {
    if (brief.viewMode === 'reviewer-strategic') {
      setActiveTab('checklist')
    }
  }, [brief.viewMode])

  const showTabs = brief.viewMode === 'reviewer-strategic'

  const footerActions = !hideFooter ? (
    <div className={styles.footerWrap}>
      {snapshot.mode === 'signoff-review' && brief.viewMode === 'reviewer-strategic' && (
        <div className={styles.footerActionsRow}>
          <div className={sidePanelStyles.footerSpacer} />
          {onFinishAndFile && (
            <Button priority="primary" size="medium" onClick={onFinishAndFile} disabled={!signOffReady}>
              Approve &amp; sign off return
            </Button>
          )}
        </div>
      )}
      {snapshot.mode === 'signoff-review' && brief.viewMode !== 'reviewer-strategic' && (
        <div className={styles.footerActionsRow}>
          {onContinue && (
            <Button priority="tertiary" size="medium" onClick={onContinue}>
              Close
            </Button>
          )}
          <div className={sidePanelStyles.footerSpacer} />
          {brief.viewMode === 'reviewer-briefing' && onOpenAsReviewer && (
            <Button priority="primary" size="medium" onClick={onOpenAsReviewer}>
              Begin Pass 2 review
            </Button>
          )}
        </div>
      )}
      {snapshot.mode === 'pass-to-reviewer' && (
        <div className={styles.footerActionsRow}>
          {onContinue && (
            <Button priority="tertiary" size="medium" onClick={onContinue}>
              Back
            </Button>
          )}
          <div className={sidePanelStyles.footerSpacer} />
          {onConfirmSend && (
            <Button priority="primary" size="medium" onClick={onConfirmSend}>
              Send to reviewer
            </Button>
          )}
        </div>
      )}
      {snapshot.mode === 'awaiting-reviewer' && (
        <div className={styles.footerActionsRow}>
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
        </div>
      )}
      {snapshot.mode === 'finish-and-file' && (
        <div className={styles.footerActionsRow}>
          <div className={sidePanelStyles.footerSpacer} />
          {onContinue && (
            <Button priority="primary" size="medium" onClick={onContinue}>
              Mark ready to file
            </Button>
          )}
        </div>
      )}
    </div>
  ) : null

  const showInlineHeader = variant === 'embedded'

  const briefContent = (
    <div className={`${sidePanelStyles.scroll} ${styles.brief}`}>
      {showInlineHeader ? (
        <BriefStickyHeader
          title={brief.header.title}
          pass1Line={brief.header.pass1Line}
          passBadge={brief.header.passBadge}
        />
      ) : null}

      {showTabs ? (
        <Tabs
          selected={activeTab}
          onChange={setActiveTab}
          isHorizontalRuleVisible
          className={styles.briefTabs}
        >
          <Tab id="checklist" title="Reviewer checklist">
            <ReviewerChecklistTab
              phases={brief.phases}
              executiveBrief={brief.executiveBrief}
              onJump={onJump}
              onToggle={onToggleChecklistItem}
            />
          </Tab>
          <Tab id="activity" title={`What ${PREPARER_NAME.split(' ')[0]} completed`}>
            <ActivityLogTab categories={brief.activityLog} />
          </Tab>
        </Tabs>
      ) : brief.viewMode === 'preparer-summary' ? (
        <PreparerSummaryTab categories={brief.activityLog} actorLabel={snapshot.actorLabel} />
      ) : (
        <ActivityLogTab categories={brief.activityLog} />
      )}
    </div>
  )

  const panelTitle = brief.header.title
  const panelSubtitle = brief.header.pass1Line
  const panelHeaderMeta = brief.header.passBadge ? (
    <PassBadge label={brief.header.passBadge} />
  ) : null

  if (variant === 'embedded') {
    return (
      <div className={styles.embedded} role="region" aria-labelledby="handoff-title">
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
        title={panelTitle}
        subtitle={panelSubtitle}
        headerMeta={panelHeaderMeta}
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
            <h2 id="handoff-title" className={styles.embeddedTitle}>{panelTitle}</h2>
            <BriefHeaderMeta pass1Line={panelSubtitle} passBadge={brief.header.passBadge} />
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
