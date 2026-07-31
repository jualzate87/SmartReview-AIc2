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
import intuitAssistIcon from '../../assets/icons/intuit-assist.svg'
import type { HandoffJump, HandoffSnapshot } from '../../data/handoffSnapshot'
import type { LiveAmounts } from '../../data/liveReturn'
import type { ReviewChecklistState } from '../../data/reviewChecklist'
import type { MilestoneState } from '../../data/reviewMilestones'
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
  milestoneState?: MilestoneState
  singlePersonMode?: boolean
  reviewPass?: 1 | 2
  isPreparer?: boolean
  amounts?: LiveAmounts
  /** Slide-in animation for conversational brief on reviewer welcome */
  briefEnterAnim?: boolean
  /** Pass 1 preparer entry — imports not started yet; show Review imports CTA */
  importsPending?: boolean
  onReviewImports?: () => void
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
  const canToggle = !!onToggle && (item.canToggle ?? !item.locked)

  /* Auto-verified / linked complete — filled green check, not interactive */
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

  /* Declaration items — same checkmark-button language as output-form attest columns */
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
            <span className={`${styles.checklistTitleRow} ${isComplete ? styles.checklistTitleDone : ''}`}>
              <span className={styles.checklistTitle}>{item.title}</span>
              {item.attribution && isComplete && (
                <span
                  className={styles.checklistAttribution}
                  title={item.attributionTooltip}
                >
                  {item.attribution}
                </span>
              )}
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

function ConversationalBriefCard({ brief, enterAnim = false }: { brief: ConversationalBrief; enterAnim?: boolean }) {
  const [animPhase, setAnimPhase] = useState<'loading' | 'reveal' | 'done'>(enterAnim ? 'loading' : 'done')

  useEffect(() => {
    if (!enterAnim) {
      setAnimPhase('done')
      return
    }
    setAnimPhase('loading')
    const revealTimer = window.setTimeout(() => setAnimPhase('reveal'), 650)
    const doneTimer = window.setTimeout(() => setAnimPhase('done'), 2400)
    return () => {
      window.clearTimeout(revealTimer)
      window.clearTimeout(doneTimer)
    }
  }, [enterAnim])

  if (animPhase === 'loading') {
    return (
      <div className={styles.briefLoading} aria-busy="true" aria-live="polite">
        <div className={styles.briefLoadingIconRow}>
          <img src={intuitAssistIcon} alt="" className={styles.briefLoadingAssistIcon} />
          <span className={styles.briefLoadingSparkle} aria-hidden>
            <AiSparkles size="small" />
          </span>
        </div>
        <div className={styles.briefLoadingShimmer} aria-hidden />
        <p className={styles.briefLoadingText}>Preparing your review brief…</p>
      </div>
    )
  }

  const revealClass = animPhase === 'reveal' ? styles.conversationalBriefEnter : ''

  return (
    <section className={`${styles.conversationalBrief} ${revealClass}`} aria-labelledby="executive-brief-heading">
      <h3 id="executive-brief-heading" className={styles.conversationalBriefHeading}>
        {brief.heading}
      </h3>
      <h4 className={styles.conversationalBriefSubheading}>{brief.intro}</h4>

      {brief.completed.items.length > 0 && (
        <div className={styles.conversationalBriefSection}>
          {brief.completed.label ? (
            <h4 className={styles.conversationalBriefSectionLabel}>
              <CircleCheckFill size="x-small" className={styles.conversationalBriefSectionIconDone} aria-hidden />
              {brief.completed.label}
            </h4>
          ) : null}
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
      )}

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

function ReviewLogTab({
  executiveBrief,
  categories,
  briefEnterAnim = false,
}: {
  executiveBrief: ConversationalBrief | null
  categories: ActivityLogCategory[]
  briefEnterAnim?: boolean
}) {
  return (
    <div className={styles.tabPanel}>
      {executiveBrief && <ConversationalBriefCard brief={executiveBrief} enterAnim={briefEnterAnim} />}
      <p className={styles.activityIntro}>
        Shared activity trail — updates sync in real time for preparer and reviewer.
      </p>
      <div className={styles.activityStack}>
        {categories.map(cat => (
          <ActivityCategoryCard key={cat.id} category={cat} />
        ))}
      </div>
    </div>
  )
}

function ChecklistTab({
  phases,
  onJump,
  onToggle,
}: {
  phases: BriefPhase[]
  onJump?: (jump: HandoffJump) => void
  onToggle?: (itemId: string, checked: boolean) => void
}) {
  return (
    <div className={styles.tabPanel}>
      <p className={styles.activityIntro}>
        Shared milestone checklist — either role can complete eligible items. Attribution shows who checked each item.
      </p>
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
  milestoneState,
  singlePersonMode = false,
  reviewPass = snapshot.pass,
  isPreparer = false,
  amounts,
  briefEnterAnim = false,
  importsPending = false,
  onReviewImports,
}: Props) {
  const brief = useMemo(
    () =>
      buildSmartReviewBrief({
        snapshot,
        checklist: checklist ?? { items: [], completeCount: 0, totalCount: 0, requiredCompleteCount: 0, requiredTotal: 0, allRequiredComplete: true, blockers: [] },
        milestoneState,
        outstandingOpenCount,
        manualChecklistItems,
        reviewPass,
        showStrategicChecklist: showChecklist,
        isPreparer,
        amounts,
        singlePersonMode,
      }),
    [snapshot, checklist, milestoneState, outstandingOpenCount, manualChecklistItems, reviewPass, showChecklist, isPreparer, amounts, singlePersonMode],
  )

  const signOffReady = canApproveSignOff(brief)

  const [activeTab, setActiveTab] = useState(
    brief.viewMode === 'unified' ? 'review-log' : 'activity',
  )

  useEffect(() => {
    if (brief.viewMode === 'unified') {
      setActiveTab('review-log')
    }
  }, [brief.viewMode])

  const showTabs = brief.viewMode === 'unified'

  const footerActions = !hideFooter ? (
    <div className={styles.footerWrap}>
      {importsPending && onReviewImports && (
        <div className={styles.footerActionsRow}>
          {onContinue && (
            <Button priority="tertiary" size="medium" onClick={onContinue}>
              Close
            </Button>
          )}
          <div className={sidePanelStyles.footerSpacer} />
          <Button priority="primary" size="medium" onClick={onReviewImports}>
            Review imports
          </Button>
        </div>
      )}
      {!importsPending && snapshot.mode === 'signoff-review' && brief.viewMode === 'unified' && !isPreparer && (
        <div className={styles.footerActionsRow}>
          <div className={sidePanelStyles.footerSpacer} />
          {onFinishAndFile && (
            <Button priority="primary" size="medium" onClick={onFinishAndFile} disabled={!signOffReady}>
              Approve &amp; sign off return
            </Button>
          )}
        </div>
      )}
      {!importsPending && snapshot.mode === 'signoff-review' && brief.viewMode === 'unified' && isPreparer && (
        <div className={styles.footerActionsRow}>
          {onContinue && (
            <Button priority="tertiary" size="medium" onClick={onContinue}>
              Close
            </Button>
          )}
          <div className={sidePanelStyles.footerSpacer} />
          {onFinishAndFile && (
            <Button priority="secondary" size="medium" onClick={onFinishAndFile}>
              Move to finish and file
            </Button>
          )}
          {onPassToReviewer && (
            <Button priority="primary" size="medium" onClick={onPassToReviewer}>
              Sign-off and assign to reviewer
            </Button>
          )}
        </div>
      )}
      {snapshot.mode === 'signoff-review' && brief.viewMode === 'reviewer-briefing' && (
        <div className={styles.footerActionsRow}>
          {onContinue && (
            <Button priority="tertiary" size="medium" onClick={onContinue}>
              Close
            </Button>
          )}
          <div className={sidePanelStyles.footerSpacer} />
          {onOpenAsReviewer && (
            <Button priority="primary" size="medium" onClick={onOpenAsReviewer}>
              Begin Pass 2 review
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
          <Tab id="review-log" title="Review log">
            <ReviewLogTab
              executiveBrief={brief.executiveBrief}
              categories={brief.activityLog}
              briefEnterAnim={briefEnterAnim}
            />
          </Tab>
          <Tab id="checklist" title="Checklist">
            <ChecklistTab
              phases={brief.phases}
              onJump={onJump}
              onToggle={onToggleChecklistItem}
            />
          </Tab>
        </Tabs>
      ) : (
        <ReviewLogTab
          executiveBrief={brief.executiveBrief}
          categories={brief.activityLog}
          briefEnterAnim={briefEnterAnim}
        />
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
        enterAnim={briefEnterAnim}
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
