import { useEffect, useMemo, useState } from 'react'
import { PREPARER_NAME } from '../../hooks/useSyncedReviewState'
import { Button } from '@ids-ts/button'
import '@ids-ts/button/dist/main.css'
import { Badge } from '@ids-ts/badge'
import '@ids-ts/badge/dist/main.css'
import { Checkbox } from '@ids-ts/checkbox'
import '@ids-ts/checkbox/dist/main.css'
import { Tabs, Tab } from '@ids-ts/tabs'
import '@ids-ts/tabs/dist/main.css'
import { CircleCheckFill, Lightning } from '@design-systems/icons'
import type { HandoffJump, HandoffSnapshot } from '../../data/handoffSnapshot'
import type { LiveAmounts } from '../../data/liveReturn'
import type { ReviewChecklistState } from '../../data/reviewChecklist'
import {
  buildSmartReviewBrief,
  canApproveSignOff,
  type ActivityLogCategory,
  type BriefPhase,
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
    </button>
  )
}

function PhaseStatusPill({ status }: { status: 'action-needed' | 'verified' }) {
  if (status === 'verified') {
    return (
      <Badge status="success" priority="secondary" capitalization="sentence" className={styles.phasePill}>
        Verified
      </Badge>
    )
  }
  return (
    <Badge status="warning" priority="secondary" capitalization="sentence" className={styles.phasePill}>
      Action needed
    </Badge>
  )
}

function ChecklistItemRow({
  item,
  onJump,
  onToggle,
}: {
  item: StrategicChecklistItem
  onJump?: (jump: HandoffJump) => void
  onToggle?: (itemId: string, checked: boolean) => void
}) {
  const isComplete = item.checked
  const canToggle = !!onToggle && !item.locked

  return (
    <li className={`${styles.checklistRow} ${isComplete ? styles.checklistRowComplete : ''}`}>
      <div className={styles.checklistRowMain}>
        <div className={styles.checklistCheck}>
          {item.locked ? (
            <span className={styles.checklistSuccessIcon} aria-hidden>
              {isComplete ? (
                <CircleCheckFill size="small" />
              ) : (
                <span className={styles.checklistLockedBox} aria-hidden />
              )}
            </span>
          ) : (
            <Checkbox
              checked={isComplete}
              disabled={false}
              onChange={canToggle ? e => onToggle!(item.id, e.target.checked) : undefined}
              size="small"
            />
          )}
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
        <PhaseStatusPill status={phase.status} />
      </header>
      <ul className={styles.phaseItemList}>
        {phase.items.map(item => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            onJump={onJump}
            onToggle={onToggle}
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
          {category.entries.map(entry => (
            <li key={entry.id} className={styles.activityEntry}>
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

function StrategicChecklistTab({
  phases,
  executiveBrief,
  onJump,
  onToggle,
}: {
  phases: BriefPhase[]
  executiveBrief: { paragraphs: string[]; syncedAt: string } | null
  onJump?: (jump: HandoffJump) => void
  onToggle?: (itemId: string, checked: boolean) => void
}) {
  return (
    <div className={styles.tabPanel}>
      {executiveBrief && (
        <section className={styles.executiveCard} aria-labelledby="executive-brief-title">
          <div className={styles.executiveCardHead}>
            <div className={styles.executiveCardTitleRow}>
              <span className={styles.executiveCardIcon} aria-hidden>
                <Lightning size="small" />
              </span>
              <h3 id="executive-brief-title" className={styles.executiveCardTitle}>
                Pass 1 executive brief
              </h3>
            </div>
            <span className={styles.syncedTime}>{executiveBrief.syncedAt}</span>
          </div>
          {executiveBrief.paragraphs.map((para, i) => (
            <p key={i} className={styles.executivePara}>{para}</p>
          ))}
        </section>
      )}
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
      <div className={styles.briefMeta}>
        <span className={styles.pass1Line}>{pass1Line}</span>
        {passBadge && (
          <Badge status="info" priority="secondary" capitalization="sentence" className={styles.passBadge}>
            {passBadge}
          </Badge>
        )}
      </div>
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
  signOffBlockerText,
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
  const blockerText = signOffBlockerText ?? brief.signOff.blockerText

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
        <>
          <div className={styles.signOffStatusRow}>
            <span
              className={`${styles.signOffStatus} ${signOffReady ? styles.signOffStatusReady : styles.signOffStatusPending}`}
              aria-live="polite"
            >
              {brief.signOff.statusText}
            </span>
            {!signOffReady && blockerText && (
              <p className={styles.signOffBlocker}>{blockerText}</p>
            )}
          </div>
          <div className={styles.footerActionsRow}>
            {onContinue && (
              <Button priority="tertiary" size="medium" onClick={onContinue}>
                Keep reviewing
              </Button>
            )}
            <div className={sidePanelStyles.footerSpacer} />
            {onFinishAndFile && (
              <Button priority="primary" size="medium" onClick={onFinishAndFile} disabled={!signOffReady}>
                Approve &amp; sign off return
              </Button>
            )}
          </div>
        </>
      )}
      {snapshot.mode === 'signoff-review' && brief.viewMode !== 'reviewer-strategic' && (
        <div className={styles.footerActionsRow}>
          {onContinue && (
            <Button priority="tertiary" size="medium" onClick={onContinue}>
              {brief.viewMode === 'reviewer-briefing' ? 'Start Pass 2 review' : 'Close'}
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

  const briefContent = (
    <div className={`${sidePanelStyles.scroll} ${styles.brief}`}>
      <BriefStickyHeader
        title={brief.header.title}
        pass1Line={brief.header.pass1Line}
        passBadge={brief.header.passBadge}
      />

      {showTabs ? (
        <Tabs
          selected={activeTab}
          onChange={setActiveTab}
          isHorizontalRuleVisible
          className={styles.briefTabs}
        >
          <Tab id="checklist" title="Strategic checklist">
            <StrategicChecklistTab
              phases={brief.phases}
              executiveBrief={brief.executiveBrief}
              onJump={onJump}
              onToggle={onToggleChecklistItem}
            />
          </Tab>
          <Tab id="activity" title={`${PREPARER_NAME.split(' ')[0]}'s activity log`}>
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
            <p className={styles.embeddedSubtitle}>{panelSubtitle}</p>
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
