import { useState, useCallback, useRef, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  PREPARER_DATA_REVIEW_PATH,
  REVIEWER_DATA_REVIEW_PATH,
  VALID_DATA_REVIEW_ENTRIES,
  setStoredDemoRole,
} from '../lib/prototypeRoutes'
import { useSyncedReviewState } from '../hooks/useSyncedReviewState'
import { DotsSix, Panel, ChevronLeft, ChevronRight, Comment, Close, ClockCounterclockwise } from '@design-systems/icons'
import '@ids-ts/badge/dist/main.css'
import { Button } from '@ids-ts/button'
import '@ids-ts/button/dist/main.css'
import { IconControl } from '@ids-ts/icon-control'
import '@ids-ts/icon-control/dist/main.css'
import NotesPane from './data-review/NotesPane'
import type { Note } from './data-review/NotesPane'
import HandoffSummary from './data-review/HandoffSummary'
import {
  buildHandoffSnapshot,
  getOutstandingOpenCount,
  type HandoffJump,
  type HandoffMode,
  type HandoffSnapshot,
  type HandoffVoice,
} from '../data/handoffSnapshot'
import {
  deriveReviewChecklist,
  EXPECTED_SOURCE_DOCS,
} from '../data/reviewChecklist'
import {
  deriveMilestoneState,
  canSignOffFromMilestones,
  signOffBlockerFromMilestones,
} from '../data/reviewMilestones'
import {
  buildSmartReviewBrief,
  canApproveSignOff,
  countStrategicOpenItems,
} from '../data/smartReviewBrief'
import {
  PREPARER_NAME,
  REVIEWER_NAME,
  setReviewActor,
  getReviewActor,
} from '../hooks/useSyncedReviewState'
import intuitAssistIcon from '../assets/icons/intuit-assist.svg'
import LeftPanel1040 from './data-review/LeftPanel1040'
import ReviewTab from './data-review/ReviewTab'
import DocumentPreview from './data-review/DocumentPreview'
import Int1099FormPreview from './data-review/Int1099FormPreview'
import { getSourceDocPreview } from './data-review/sourceDocImages'
import DetailFields, { W2_PAYER_TABS } from './data-review/DetailFields'
import type { W2Employer } from './data-review/DetailFields'
import DetailFields1099, { INT_PAYER_TABS, intVerifiedDocKey } from './data-review/DetailFields1099'
import type { IntPayer } from './data-review/DetailFields1099'
import DetailFieldsDiv, { DIV_PAYER_TABS, divVerifiedDocKey } from './data-review/DetailFieldsDiv'
import type { DivPayer } from './data-review/DetailFieldsDiv'
import {
  buildTabConfirmCounts,
  buildTabConfirmStatus,
  buildTabVerifiedKeys,
  buildTypeReviewed,
  countDocsIncompleteForReviewer,
  getDocConfirmStatus,
  getNextUnreviewedSourceDoc,
  getUnreviewedSourceDocs,
} from './data-review/docReviewStatus'
import { isDocShownVerified, navigationForVerifiedDocKey } from '../data/verifiedDocKeys'
import DetailFields1099R, { R_PAYER_TABS } from './data-review/DetailFields1099R'
import DetailFieldsNec, { NEC_PAYER_TABS } from './data-review/DetailFieldsNec'
import AttentionCountBadge from './data-review/AttentionCountBadge'
import PeelTab from './data-review/PeelTab'
import PriorYear1040Fields from './data-review/PriorYear1040Fields'
import QuestionnaireResponsesPanel from './data-review/QuestionnaireResponsesPanel'
import type { QuestionnaireResponseId } from './data-review/questionnaireData'
import type { OutputFormId } from './data-review/outputForms'
import { resolveOutputFormFromAction } from './data-review/outputForms'
import AgentReportPane from './data-review/AgentReportPane'
import CoachTip, { markCoachTipShown, readCoachTipShown, type CoachTipId } from './data-review/CoachTip'
import AgentLoadingPane from './data-review/AgentLoadingPane'
import Phase1Banner from './data-review/Phase1Banner'
import Phase1IssueBanner from './data-review/Phase1IssueBanner'
import Phase2Banner from './data-review/Phase2Banner'
import {
  PHASE1_FLAG_KEYS,
  countPhase1Remaining,
  countPhase1FlagsForDivPayer,
  countPhase1FlagsForIntPayer,
  countPhase1FlagsForW2Payer,
  field1040ToDetail,
  get1040HighlightField,
  getNextVerifyItem,
  getTabFlagCounts,
  getTabInitialFlagCounts,
  getInitialW2PayerFlagCount,
  getInitialDivPayerFlagCount,
  getInitialIntPayerFlagCount,
  getInitialRPayerFlagCount,
  isPhase1FlagResolved,
  navigationForDetailField,
  PHASE1_VERIFY_QUEUE,
} from './data-review/phase1FieldSync'
import {
  getPhase2Progress,
  resolveOutputFieldFromDiagnostic,
  resolveOutputFieldFromIssueField,
  type Phase2IssueKey,
} from './data-review/phase2FlagSync'
import { PHASE1_FLAG_MESSAGES } from './data-review/phase1FlagMessages'
import { buildYoyInputFlags, mergeInputFlags } from './data-review/yoyInputFlags'
import { computeLiveReturn } from '../data/liveReturn'
import { navigationForSourceDoc } from '../data/sourceDocuments'
import img1040PriorPage1 from '../assets/jessica-1040-2024-variant-1.png'
import img1040PriorPage2 from '../assets/jessica-1040-2024-variant-2.png'
import styles from '../styles/data-review/DataReviewPage.module.css'
import dragStyles from '../styles/data-review/DragHandle.module.css'
import DemoRoleBar from '../components/DemoRoleBar/DemoRoleBar'

function VerticalGripIcon() {
  return (
    <svg width="4" height="20" viewBox="0 0 4 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="2" cy="4"  r="1.5" fill="#93A3AB"/>
      <circle cx="2" cy="10" r="1.5" fill="#93A3AB"/>
      <circle cx="2" cy="16" r="1.5" fill="#93A3AB"/>
    </svg>
  )
}

/** Source-doc panel slide timing — matches --duration-appear/disappear-emphasize-fast */
const SOURCE_PANEL_ENTER_MS = 500
const SOURCE_PANEL_EXIT_MS = 500
/** Summary show/hide — matches --duration-transform-emphasize-fast */
const SUMMARY_TOGGLE_MS = 500
/** Collapsed "Show Summary" edge tab width */
const SHOW_SUMMARY_HANDLE_WIDTH = 44
/** Fixed width for HandoffSummary right-rail panel */
const SUMMARY_PANEL_WIDTH = 755
/** Hard floor for Summary so Return Breakdown labels aren’t truncated.
 *  Below this width the first column gets ellipsized (“eaten”). */
const LEFT_PANEL_MIN_WIDTH = 795.7
/** Absolute min Sources width when both panels are open */
const RIGHT_PANEL_MIN_WIDTH = 360
/** Matches DragHandle.module.css .handleVertical width */
const PANEL_DRAG_HANDLE_WIDTH = 16

/** Exactly one right-rail content mode at a time — never stack overlays. */
type RightPanelMode = 'closed' | 'sources' | 'ai' | 'comments' | 'summary'

export default function DataReviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const entry = searchParams.get('entry')
  const roleParam = searchParams.get('role')
  const startReviewParam = searchParams.get('startReview') === 'true'

  // Valid entries: input-return (preparer) or review-return (reviewer).
  const entryValid = entry != null && VALID_DATA_REVIEW_ENTRIES.has(entry)
  useEffect(() => {
    const legacyAgent = searchParams.get('agent') === 'true'
    if (legacyAgent && !entryValid) {
      navigate(PREPARER_DATA_REVIEW_PATH, { replace: true })
      return
    }
    if (entryValid) return
    if (roleParam === 'reviewer' || searchParams.get('startReview') === 'true') {
      navigate(REVIEWER_DATA_REVIEW_PATH, { replace: true })
      return
    }
    navigate('/smart-return', { replace: true })
  }, [entry, entryValid, roleParam, searchParams, navigate])

  // Source-doc review state — flags, reviewed fields, active tab, editable field
  // values — persisted in localStorage via useSyncedReviewState (cross-tab handoff).
  const {
    activeTopTab, setActiveTopTab,
    activeSubTab, setActiveSubTab,
    selectedField, setSelectedField,
    wages, setWages,
    amounts, updateAmounts,
    fieldValues, updateFieldValue,
    reviewedFields,
    editedFields,
    markEdited,
    fieldOverrides,
    setFieldOverride,
    activeDivPayer, setActiveDivPayer,
    activeIntPayer, setActiveIntPayer,
    markReviewed: handleMarkReviewed,
    markReviewedBulk: handleMarkReviewedBulk,
    verifiedDocs,
    verifiedDocsMeta,
    toggleVerifiedDoc,
    summaryCheckedFields,
    summaryCheckedMeta,
    reviewerConfirmedFields,
    reviewerConfirmedMeta,
    reviewerConfirmedDocs,
    reviewerConfirmedDocsMeta,
    reviewerConfirmStaleFields,
    toggleSummaryChecked,
    toggleSummaryPreparerCheck,
    toggleSummaryReviewerConfirm,
    summaryFlaggedFields,
    summaryFlaggedMeta,
    toggleSummaryFlagged,
    summaryFlagNotes,
    summaryFlagActivity,
    setSummaryFlagNote,
    editedFieldsMeta,
    manualChecklistItems,
    setManualChecklistItem,
    completedMilestones,
    setMilestoneDeclaration,
    reviewerSignedOffForms,
    reviewerSignedOffFormsMeta,
    toggleReviewerFormSignOff,
    resetReviewState,
  } = useSyncedReviewState()
  const liveTotals = computeLiveReturn(amounts)
  const total1a = liveTotals.wages
  const totalWithholding = liveTotals.totalWithholding
  const yoyInputFlags = buildYoyInputFlags(liveTotals, amounts)
  const updateField = (key: keyof typeof fieldValues, value: number | { techCircle: number }) =>
    updateFieldValue(key, value)
  // Agent panel width in px when open (default 588px, user-resizable)
  const [agentPanelWidth, setAgentPanelWidth] = useState(588)
  // Right panel width in px (default ~65% viewport once imports start)
  const [rightPanelWidth, setRightPanelWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.65) : 920,
  )
  // Body width for Sources-panel share of the row (drives auto side-by-side).
  const [bodyWidth, setBodyWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1400,
  )
  // Suppress panel width CSS transitions while the user is dragging a resize handle
  const [panelResizing, setPanelResizing] = useState(false)
  // Top/bottom section height ratio in right panel (0-100, where value = preview percentage)
  const [previewHeight, setPreviewHeight] = useState(40)
  // Unified right rail — one shell, one active mode (sources | ai | comments | summary)
  const isPreparerEntry = entry === 'input-return' && roleParam !== 'reviewer'
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('closed')
  // Whether the right panel is animating out (slide-out before mode → closed)
  const [rightPanelExiting, setRightPanelExiting] = useState(false)
  // Agent sub-state when mode === 'ai': idle → loading → report → closing
  const [agentView, setAgentView] = useState<'idle' | 'loading' | 'report' | 'closing'>('idle')
  // Right panel animating-in after open
  const [rightPanelAnimating, setRightPanelAnimating] = useState(false)
  // Fade-out for comments / summary close
  const [panelClosing, setPanelClosing] = useState(false)
  // Whether YoY analysis is expanded (screen 4) — drives -15% badge on 1040
  const [yoyExpanded, setYoyExpanded] = useState(false)
  // Whether user navigated to source docs from the agent panel — shows back link
  const [fromAgent, setFromAgent] = useState(false)
  // Which agent subview to restore when going back to agent insights
  // 'overview' = report overview, 'yoyDetail' = YoY detail pane open
  const [agentSubView, setAgentSubView] = useState<'overview' | 'yoyDetail'>('overview')
  // Notes / comments — persisted for C2 handoff (localStorage for cross-tab reviewer)
  const NOTES_KEY = 'protoc2-notes'
  const loadNotes = (): Note[] => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#/, '')
      const q = hash.indexOf('?')
      if (q !== -1) {
        const params = new URLSearchParams(hash.slice(q + 1))
        if (params.get('entry') === 'input-return' && params.get('role') !== 'reviewer') {
          return []
        }
      }
    }
    try {
      const fromLocal = localStorage.getItem(NOTES_KEY)
      if (fromLocal) return JSON.parse(fromLocal) as Note[]
      const fromSession = sessionStorage.getItem(NOTES_KEY)
      if (fromSession) {
        localStorage.setItem(NOTES_KEY, fromSession)
        sessionStorage.removeItem(NOTES_KEY)
        return JSON.parse(fromSession) as Note[]
      }
    } catch { /* ignore */ }
    return []
  }
  const [notes, setNotes] = useState<Note[]>(loadNotes)
  // C2: multi-pass handoff — summary content when rightPanelMode === 'summary'
  const [reviewPass, setReviewPass] = useState<1 | 2>(() =>
    entry === 'review-return' && startReviewParam ? 2 : 1,
  )
  const [reviewRole, setReviewRole] = useState<'preparer' | 'reviewer'>(() =>
    roleParam === 'reviewer' || entry === 'review-return' ? 'reviewer' : 'preparer',
  )
  const [summaryMode, setSummaryMode] = useState<HandoffMode>('signoff-review')
  const [summaryOpts, setSummaryOpts] = useState<{
    pass?: 1 | 2
    actor?: string
    voice?: HandoffVoice
  }>({})
  /** Preparer wrap-up choice from Smart review brief (prototype handoff paths) */
  const [preparerHandoffChoice, setPreparerHandoffChoice] = useState<
    'none' | 'awaiting-reviewer' | 'finish-and-file'
  >('none')
  /** Reviewer has clicked "Review return" in return header and entered review workflow */
  const [reviewerReviewStarted, setReviewerReviewStarted] = useState(
    () => entry === 'review-return' && startReviewParam,
  )
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null)
  const actorLabel = reviewRole === 'reviewer' ? REVIEWER_NAME : PREPARER_NAME
  const pass1ActorLabel = PREPARER_NAME

  useEffect(() => {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
    } catch { /* ignore */ }
  }, [notes])

  useEffect(() => {
    setReviewActor(actorLabel)
  }, [actorLabel])

  useEffect(() => {
    setStoredDemoRole(reviewRole)
  }, [reviewRole])

  // --- ProtoC: two-phase sequential review ------------------------------------
  // 'welcome'     → Intuit Assist orientation screen
  // 'import'      → Phase 1: Import Accuracy (source-doc experience)
  // 'diagnostics' → Phase 2: AI Diagnostics (agent panel primary)
  type ReviewPhase = 'welcome' | 'import' | 'diagnostics'
  const [phase, setPhase] = useState<ReviewPhase>(() =>
    entry === 'review-return' ? 'diagnostics' : 'import',
  )
  const [show1040, setShow1040] = useState(true)
  const [outputFormId, setOutputFormId] = useState<OutputFormId>('summary')
  const [importsStarted, setImportsStarted] = useState(false)
  /** First-run coach tip: hide summary */
  const [coachTip, setCoachTip] = useState<CoachTipId | null>(null)
  /** One-shot nudge when Phase 1 is fully complete (flags + docs) */
  const [continueDiagnosticsCoach, setContinueDiagnosticsCoach] = useState(false)
  /** One-shot nudge after Phase 2 diagnostics are all reviewed */
  const [outputFormsCoach, setOutputFormsCoach] = useState(false)
  const [outputSourcesCoach, setOutputSourcesCoach] = useState(false)
  /** Assist-style staged reveal when reviewer lands from Review return (new tab) */
  const [summaryBriefEnterAnim, setSummaryBriefEnterAnim] = useState(false)
  /** Explicit left-panel px width during Summary collapse/expand (null = natural flex). */
  const [leftAnimWidth, setLeftAnimWidth] = useState<number | null>(null)
  /** Keep doc|Details side-by-side during Summary toggle so flexDirection doesn't flip mid-motion. */
  const [freezePreviewSideBySide, setFreezePreviewSideBySide] = useState(false)
  const [questionnaireHighlightId, setQuestionnaireHighlightId] = useState<QuestionnaireResponseId | null>(null)

  // The import/OCR flags owned by Phase 1. Each key matches the reviewed-field key
  // emitted by the DetailFields "Edit+Save" / "Mark as correct" controls.
  const phase1Total = PHASE1_FLAG_KEYS.length
  const phase1Resolved = PHASE1_FLAG_KEYS.filter(k => isPhase1FlagResolved(k, reviewedFields)).length
  // Counter of unresolved import flags — never below 0
  const phase1Remaining = countPhase1Remaining(reviewedFields)
  const phase1Complete = phase1Remaining === 0
  // Per-document unresolved counts for dynamic tab badges
  const tabFlagCounts = getTabFlagCounts(reviewedFields)
  const tabInitialFlagCounts = getTabInitialFlagCounts()
  // PeelTab per-payer badges — unresolved Phase 1 import flags only (mirrors tabFlagCounts)
  const divPayerFieldCounts: Record<DivPayer, number> = Object.fromEntries(
    DIV_PAYER_TABS.map(({ key: p }) => [p, countPhase1FlagsForDivPayer(p, reviewedFields)])
  ) as Record<DivPayer, number>
  const intPayerFieldCounts: Record<IntPayer, number> = Object.fromEntries(
    INT_PAYER_TABS.map(({ key: p }) => [p, countPhase1FlagsForIntPayer(p, reviewedFields)])
  ) as Record<IntPayer, number>
  const w2PayerFieldCounts: Record<W2Employer, number> = Object.fromEntries(
    W2_PAYER_TABS.map(({ key: p }) => [p, countPhase1FlagsForW2Payer(p, reviewedFields)])
  ) as Record<W2Employer, number>
  const tabVerifiedKeys = buildTabVerifiedKeys()
  const typeReviewed = buildTypeReviewed({
    verifiedDocs,
    reviewerConfirmedDocs,
    w2Counts: w2PayerFieldCounts,
    divCounts: divPayerFieldCounts,
    intCounts: intPayerFieldCounts,
    rRemaining: tabFlagCounts['1099-rs'] ?? 0,
  })
  const tabConfirmStatus = buildTabConfirmStatus({
    verifiedDocs,
    reviewerConfirmedDocs,
    tabVerifiedKeys,
    isReviewer: reviewRole === 'reviewer',
  })
  const tabConfirmCounts = buildTabConfirmCounts({
    verifiedDocs,
    reviewerConfirmedDocs,
    tabVerifiedKeys,
    isReviewer: reviewRole === 'reviewer',
  })

  const peelDocConfirmStatus = (docKey: string) => {
    if (reviewRole !== 'reviewer') return undefined
    const status = getDocConfirmStatus(verifiedDocs, docKey, reviewerConfirmedDocs)
    if (status === 'unverified') return undefined
    return status
  }

  const unreviewedSourceDocs = getUnreviewedSourceDocs({
    verifiedDocs,
    w2Counts: w2PayerFieldCounts,
    divCounts: divPayerFieldCounts,
    intCounts: intPayerFieldCounts,
    rRemaining: tabFlagCounts['1099-rs'] ?? 0,
  })
  const unreviewedDocCount = unreviewedSourceDocs.length
  const flagsCleared = phase1Complete
  const phase1FullyComplete = flagsCleared && unreviewedDocCount === 0
  // Phase 2 diagnostics progress — same dismiss rules AgentReportPane uses, so
  // resolving Phase 1 flags / editing amounts that fix an insight keeps the banner in sync.
  const phase2Progress = getPhase2Progress({
    reviewedFields,
    live: liveTotals,
    amounts,
  })
  const phase2Reviewed = phase2Progress.reviewed
  const phase2Total = phase2Progress.total
  const phase2Complete = phase2Progress.complete
  // ---------------------------------------------------------------------------

  const bodyRef = useRef<HTMLDivElement>(null)
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  /** Split container for document preview ↔ Details (not the whole right panel). */
  const splitPaneRef = useRef<HTMLDivElement>(null)
  /** Right-panel width to restore when Show Summary expands again. */
  const preCollapseRightWidthRef = useRef<number | null>(null)
  const summaryToggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Tracks prior right-rail open state for empty-canvas auto-restore. */
  const prevRightPanelOpenRef = useRef(false)

  useEffect(() => () => {
    if (summaryToggleTimerRef.current) clearTimeout(summaryToggleTimerRef.current)
  }, [])

  // Derived — single source of truth for which rail content is active
  const rightPanelOpen = rightPanelMode !== 'closed' || rightPanelExiting || panelClosing
  const rightPanelVisible = rightPanelMode === 'sources'
  const bothPanelsOpen = show1040 && rightPanelOpen && rightPanelMode === 'sources'
  const notesOpen = rightPanelMode === 'comments'
  const summaryPanelOpen = rightPanelMode === 'summary'
  const agentPanelActive = rightPanelMode === 'ai'

  const animatePanelEnter = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setRightPanelAnimating(true)
      setTimeout(() => setRightPanelAnimating(false), SOURCE_PANEL_ENTER_MS)
    }))
  }, [])

  /** Open the unified right rail in exactly one mode (replaces any current mode). */
  const openRightPanel = useCallback((mode: Exclude<RightPanelMode, 'closed'>) => {
    setPanelClosing(false)
    setRightPanelExiting(false)
    const wasClosed = rightPanelMode === 'closed'
    setRightPanelMode(mode)
    if (wasClosed) animatePanelEnter()
  }, [rightPanelMode, animatePanelEnter])

  /** Close the unified right rail (mode-specific exit animation). */
  const closeRightPanel = useCallback(() => {
    if (rightPanelMode === 'closed' && !rightPanelExiting && !panelClosing) return

    if (rightPanelMode === 'comments' || rightPanelMode === 'summary') {
      setPanelClosing(true)
      setTimeout(() => {
        setRightPanelMode('closed')
        setPanelClosing(false)
        setSummaryMode('signoff-review')
        setSummaryOpts({})
      }, 200)
      return
    }

    if (rightPanelMode === 'ai') {
      setAgentView('closing')
      setYoyExpanded(false)
      setSelectedField(null)
      setActiveIssueField(null)
      setTimeout(() => {
        setRightPanelMode('closed')
        setAgentView('idle')
      }, 350)
      return
    }

    if (rightPanelMode === 'sources') {
      setRightPanelExiting(true)
      setTimeout(() => {
        setRightPanelMode('closed')
        setRightPanelExiting(false)
      }, SOURCE_PANEL_EXIT_MS)
    }
  }, [rightPanelMode, setSelectedField])

  const ensureSourcePanelVisible = useCallback(() => {
    if (rightPanelMode !== 'sources') openRightPanel('sources')
  }, [rightPanelMode, openRightPanel])

  /** Collapse outputs when focusing source docs; pink pointer on Show outputs. */
  const hideOutputsForSourceFocusRef = useRef<() => void>(() => {})

  const handleCloseSourcePanel = useCallback(() => {
    if (rightPanelMode === 'sources') closeRightPanel()
  }, [rightPanelMode, closeRightPanel])

  const startReviewingImports = useCallback(() => {
    setImportsStarted(true)
    setShow1040(true)
    const body = bodyRef.current
    const bodyW = body
      ? (body.clientWidth || body.getBoundingClientRect().width)
      : window.innerWidth
    setBodyWidth(bodyW)
    const preferred = Math.round(bodyW * 0.65)
    const maxRight = Math.max(0, bodyW - LEFT_PANEL_MIN_WIDTH - PANEL_DRAG_HANDLE_WIDTH)
    const floor = Math.min(RIGHT_PANEL_MIN_WIDTH, maxRight)
    setRightPanelWidth(Math.max(floor, Math.min(preferred, maxRight)))
    openRightPanel('sources')
    hideOutputsForSourceFocusRef.current()
  }, [openRightPanel])

  /** Preparer import-first: size source panel on mount when landing with sources open */
  useEffect(() => {
    if (reviewRole !== 'preparer' || phase !== 'import' || !importsStarted) return
    const body = bodyRef.current
    if (!body) return
    const bodyW = body.clientWidth || body.getBoundingClientRect().width
    setBodyWidth(bodyW)
    const preferred = Math.round(bodyW * 0.65)
    const maxRight = Math.max(0, bodyW - LEFT_PANEL_MIN_WIDTH - PANEL_DRAG_HANDLE_WIDTH)
    const floor = Math.min(RIGHT_PANEL_MIN_WIDTH, maxRight)
    setRightPanelWidth(w => Math.max(floor, Math.min(preferred, maxRight, w)))
  }, [phase, importsStarted, reviewRole])

  const dismissCoachTip = useCallback((id: CoachTipId) => {
    markCoachTipShown(id)
    setCoachTip(null)
  }, [])

  const dismissContinueDiagnosticsCoach = useCallback(() => {
    markCoachTipShown('continueDiagnostics')
    setContinueDiagnosticsCoach(false)
  }, [])

  const dismissOutputFormsCoach = useCallback(() => {
    markCoachTipShown('outputForms')
    setOutputFormsCoach(false)
  }, [])

  const dismissOutputSourcesCoach = useCallback(() => {
    markCoachTipShown('outputSourcesFirst')
    setOutputSourcesCoach(false)
  }, [])

  // First tip as soon as review starts: pink pointer on Summary (i) — no panel open
  useEffect(() => {
    if (phase !== 'import' || !show1040) return
    if (readCoachTipShown('outputSourcesFirst')) return
    setOutputFormId('summary')
    setOutputSourcesCoach(true)
  }, [phase, show1040])

  // Second tip: Hide outputs — after first tip is dismissed, when Return Summary + Sources are both open
  useEffect(() => {
    if (phase !== 'import' || !bothPanelsOpen) return
    if (readCoachTipShown('hideSummary')) return
    if (outputSourcesCoach || !readCoachTipShown('outputSourcesFirst')) return
    setCoachTip('hideSummary')
  }, [phase, bothPanelsOpen, outputSourcesCoach])
  // Continue-to-diagnostics nudge when Phase 1 is fully complete
  useEffect(() => {
    if (phase !== 'import' || !phase1FullyComplete) return
    if (readCoachTipShown('continueDiagnostics')) return
    setContinueDiagnosticsCoach(true)
  }, [phase, phase1FullyComplete])

  // Output-forms nudge when Phase 2 diagnostics are complete
  useEffect(() => {
    if (phase !== 'diagnostics' || !phase2Complete) return
    if (readCoachTipShown('outputForms')) return
    setOutputFormsCoach(true)
  }, [phase, phase2Complete])

  // If Hide Summary collapses while its tip is open, advance the sequence
  useEffect(() => {
    if (!show1040 && coachTip === 'hideSummary') {
      dismissCoachTip('hideSummary')
    }
    if (show1040 && coachTip === 'showOutputs') {
      dismissCoachTip('showOutputs')
    }
  }, [show1040, coachTip, dismissCoachTip])

  // Field that the agent flagged as an issue — drives orange highlight mode
  // Set when navigating to source docs from any issue detail pane
  const [activeIssueField, setActiveIssueField] = useState<string | null>(null)
  /** Phase 2 diagnostic with an open detail pane — output highlight follows this when set. */
  const [activeDiagnosticKey, setActiveDiagnosticKey] = useState<Phase2IssueKey | null>(null)
  const activeDiagnosticKeyRef = useRef<Phase2IssueKey | null>(null)
  activeDiagnosticKeyRef.current = activeDiagnosticKey

  // Drop stale orange output highlight once every Phase 2 diagnostic is reviewed
  useEffect(() => {
    if (!phase2Complete) return
    setActiveDiagnosticKey(null)
    setActiveIssueField(null)
  }, [phase2Complete])

  const handlePhase2MarkReviewed = useCallback((fieldName: string) => {
    handleMarkReviewed(fieldName)
    if (activeDiagnosticKeyRef.current === fieldName) {
      setActiveDiagnosticKey(null)
      setActiveIssueField(null)
    }
  }, [handleMarkReviewed])

  // Maps doc-overlay field keys → 1040 field keys (when they differ)
  const DOC_FIELD_TO_1040: Record<string, string> = {
    earlyWithdrawal: 'taxableInterest', // Box 2 flows to same 1040 line 2b
  }

  const agentOutputHighlightActive =
    agentView === 'report' || agentView === 'closing' || fromAgent

  // issueField: Summary / 1040 row for the active diagnostic (orange) — takes precedence over blue selection
  const issueField = (() => {
    if (!agentOutputHighlightActive) return null
    if (agentSubView === 'yoyDetail') return 'wages'
    if (activeIssueField) {
      const raw = DOC_FIELD_TO_1040[activeIssueField] ?? activeIssueField
      return resolveOutputFieldFromIssueField(raw)
    }
    if (activeDiagnosticKey && !reviewedFields.has(activeDiagnosticKey)) {
      return resolveOutputFieldFromDiagnostic(activeDiagnosticKey, amounts)
    }
    return null
  })()

  const selectedOutputField = resolveOutputFieldFromIssueField(selectedField)
  const highlightMode: 'orange' | 'blue' = phase === 'import'
    ? 'blue'
    : (selectedOutputField && issueField && selectedOutputField === issueField) ? 'orange' : 'blue'

  const applyVerifyNavigation = useCallback((field: string) => {
    const nav = navigationForDetailField(field)
    if (nav) {
      setActiveTopTab(nav.tab)
      if (nav.divPayer) setActiveDivPayer(nav.divPayer)
      if (nav.intPayer) setActiveIntPayer(nav.intPayer)
    }
    setSelectedField(field)
    if (reviewRole === 'reviewer') {
      ensureSourcePanelVisible()
    } else if (!importsStarted) {
      startReviewingImports()
    } else {
      ensureSourcePanelVisible()
    }
  }, [
    setActiveTopTab, setActiveDivPayer, setActiveIntPayer, setSelectedField,
    reviewRole, importsStarted, startReviewingImports, ensureSourcePanelVisible,
  ])

  const handleVerifyNext = useCallback(() => {
    if (reviewRole !== 'reviewer' && !importsStarted) startReviewingImports()
    const next = getNextVerifyItem(reviewedFields, selectedField)
    if (!next) return
    applyVerifyNavigation(next.field)
  }, [reviewRole, importsStarted, startReviewingImports, reviewedFields, selectedField, applyVerifyNavigation])

  const handleReviewNextDocument = useCallback(() => {
    if (reviewRole !== 'reviewer') {
      if (!importsStarted) startReviewingImports()
      else ensureSourcePanelVisible()
    } else {
      ensureSourcePanelVisible()
    }
    const next = getNextUnreviewedSourceDoc(unreviewedSourceDocs, {
      tab: activeTopTab,
      w2SubTab: activeSubTab,
      divPayer: activeDivPayer,
      intPayer: activeIntPayer,
    })
    if (!next) return
    setActiveTopTab(next.tab)
    if (next.w2SubTab) setActiveSubTab(next.w2SubTab)
    if (next.divPayer) setActiveDivPayer(next.divPayer)
    if (next.intPayer) setActiveIntPayer(next.intPayer)
    setSelectedField(null)
    setActiveIssueField(null)
    setActiveDiagnosticKey(null)
    if (next.tab === 'questionnaire') setQuestionnaireHighlightId(null)
  }, [
    reviewRole, importsStarted, startReviewingImports, ensureSourcePanelVisible,
    unreviewedSourceDocs, activeTopTab, activeSubTab, activeDivPayer, activeIntPayer,
    setActiveTopTab, setActiveSubTab, setActiveDivPayer, setActiveIntPayer, setSelectedField,
  ])

  const handleFieldSelect = useCallback((field: string | null) => {
    setSelectedField(field)
    if (phase === 'import' && field && reviewRole === 'preparer') {
      if (!importsStarted) startReviewingImports()
      else ensureSourcePanelVisible()
    }
    if (reviewRole === 'reviewer' && field) {
      ensureSourcePanelVisible()
    }
  }, [phase, reviewRole, setSelectedField, importsStarted, startReviewingImports, ensureSourcePanelVisible])

  const handleNavigateToSourceDoc = useCallback((docId: string) => {
    const nav = navigationForVerifiedDocKey(docId) ?? navigationForSourceDoc(docId)
    if (!nav) return
    
    setActiveTopTab(nav.tab)
    if (nav.subTab) setActiveSubTab(nav.subTab)
    if (nav.divPayer) setActiveDivPayer(nav.divPayer)
    if (nav.intPayer) setActiveIntPayer(nav.intPayer)

    if (reviewRole === 'reviewer') {
      ensureSourcePanelVisible()
    } else if (!importsStarted) {
      startReviewingImports()
    } else if (agentPanelActive) {
      setFromAgent(true)
      setAgentSubView('overview')
      handleAgentClose(true)
      hideOutputsForSourceFocusRef.current()
    } else {
      ensureSourcePanelVisible()
      hideOutputsForSourceFocusRef.current()
    }
  }, [
    reviewRole,
    agentView,
    importsStarted,
    startReviewingImports,
    ensureSourcePanelVisible,
    setActiveTopTab,
    setActiveSubTab,
    setActiveDivPayer,
    setActiveIntPayer,
  ])

  /** From FieldPopover source row — jump to doc + highlight the matching detail field. */
  const handleNavigateSource = useCallback((source: {
    docId: string
    detailFieldId: string
    label: string
  }) => {
    handleNavigateToSourceDoc(source.docId)
    setSelectedField(source.detailFieldId)
  }, [handleNavigateToSourceDoc, setSelectedField])

  /** ProtoC: 1040 row click selects/highlights only — does not open Sources until user follows a source link or banner CTA. */
  const handle1040FieldClick = useCallback((field1040: string | null) => {
    if (!field1040) {
      setSelectedField(null)
      return
    }
    const mapped = field1040ToDetail(field1040)
    setSelectedField(mapped?.field ?? field1040)
  }, [setSelectedField])

  const highlightField1040 = resolveOutputFieldFromIssueField(selectedField)

  // Scroll the mapped output row into view when a source field is selected and outputs are visible
  useEffect(() => {
    if (!show1040 || !highlightField1040) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const row = document.querySelector(
          `[data-field-row="${highlightField1040}"]`,
        ) as HTMLElement | null
        row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      })
    })
  }, [show1040, highlightField1040, selectedField])

  const sourceDocPreview = getSourceDocPreview({
    activeTopTab,
    activeSubTab,
    activeIntPayer,
    activeDivPayer,
    prior1040Images: [img1040PriorPage1, img1040PriorPage2],
  })

  // Reset field selection on mount
  useEffect(() => {
    setSelectedField(null)
  }, [])

  // ProtoC: the agent panel is driven by the phase model (opens on entering Phase 2),
  // not by the ?agent=true entry param. See handleBeginDiagnostics below.

  const handleAgentOpen = (subView?: 'overview' | 'yoyDetail') => {
    setSelectedField(null)
    if (subView) setAgentSubView(subView)
    openRightPanel('ai')
    const alreadyLoaded = sessionStorage.getItem('agentLoaded')
    if (alreadyLoaded) {
      setAgentView('report')
    } else {
      setAgentView('loading')
      setTimeout(() => {
        setAgentView('report')
        sessionStorage.setItem('agentLoaded', '1')
      }, 3200)
    }
  }

  // ProtoC: Phase 1 → Phase 2 transition. Switches layout to agent-primary and
  // opens the AI diagnostics panel (plays the loading animation once).
  const handleBeginDiagnostics = () => {
    dismissContinueDiagnosticsCoach()
    setPhase('diagnostics')
    setShow1040(true)          // 1040 visible by default in Phase 2 (context for diagnostics)
    setSelectedField(null)
    handleAgentOpen()
  }

  // ProtoC: return to Phase 1 (source docs) from the completion banner
  const handleReturnToImport = () => {
    if (agentPanelActive) handleAgentClose()
    setPhase('import')
    setShow1040(true)
    setSelectedField(null)
  }

  const handleAgentClose = (preserveSelection = false) => {
    setAgentView('closing')
    setYoyExpanded(false)
    if (!preserveSelection) {
      setSelectedField(null)
      setActiveIssueField(null)
    }
    setTimeout(() => {
      setAgentView('idle')
      if (preserveSelection) {
        setRightPanelMode('sources')
        animatePanelEnter()
      } else {
        setRightPanelMode('closed')
      }
    }, 350)
  }

  const handleOpenNotes = () => {
    // Mutual exclusion: Comments ↔ Summary
    
    openRightPanel('comments')
  }
  const handleCloseNotes = () => {
    if (rightPanelMode === 'comments') closeRightPanel()
  }
  const formatNoteAt = () =>
    new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })

  const handleAddNote = (text: string, context?: string) => {
    setNotes(prev => [...prev, {
      id: `note-${Date.now()}`,
      text,
      author: getReviewActor(),
      at: formatNoteAt(),
      context,
      status: 'open',
      role: reviewRole,
      replies: [],
    }])
    
    openRightPanel('comments')
  }

  const handleEditNote = (id: string, text: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, text, at: formatNoteAt() } : n))
  }

  const handleResolveNote = (id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, status: 'resolved' as const } : n))
  }

  const handleReplyNote = (id: string, text: string) => {
    setNotes(prev => prev.map(n => {
      if (n.id !== id) return n
      const reply = {
        id: `reply-${Date.now()}`,
        text,
        author: getReviewActor(),
        at: formatNoteAt(),
        role: reviewRole,
      }
      return { ...n, replies: [...(n.replies ?? []), reply] }
    }))
  }

  const pass2DocConfirmOpenCount = reviewRole === 'reviewer'
    ? countDocsIncompleteForReviewer({
        verifiedDocs,
        reviewerConfirmedDocs,
        docKeys: EXPECTED_SOURCE_DOCS,
      })
    : 0

  const buildSnapshot = (
    mode: HandoffMode,
    pass: 1 | 2 = reviewPass,
    actor = actorLabel,
    voice: 'self' | 'reviewer-briefing' = 'self',
  ): HandoffSnapshot =>
    buildHandoffSnapshot(mode, pass, actor, {
      reviewedFields,
      verifiedDocs,
      verifiedDocsMeta,
      reviewerConfirmedDocs,
      reviewerConfirmedDocsMeta,
      editedFields: editedFieldsMeta,
      summaryChecked: summaryCheckedMeta,
      reviewerConfirmed: reviewerConfirmedMeta,
      summaryFlagged: summaryFlaggedMeta,
      summaryFlagNotes,
      notes,
      amounts,
    }, { voice })

  const openSummaryPanel = (
    mode: HandoffMode = 'signoff-review',
    opts: { pass?: 1 | 2; actor?: string; voice?: HandoffVoice } = {},
  ) => {
    setSummaryMode(mode)
    setSummaryOpts(opts)
    setAgentView('idle')
    setYoyExpanded(false)
    const body = bodyRef.current
    if (body) {
      setBodyWidth(body.clientWidth || body.getBoundingClientRect().width)
    }
    setRightPanelWidth(SUMMARY_PANEL_WIDTH)
    openRightPanel('summary')
  }

  const handleCloseSummaryPanel = () => {
    if (rightPanelMode === 'summary') closeRightPanel()
  }

  /** Sign-off CTA (Phase 2 banner, preparer) → Smart review brief panel */
  const handleWrapUpPass = () => {
    if (reviewRole === 'reviewer') {
      openSummaryPanel('signoff-review', { pass: 2, actor: REVIEWER_NAME, voice: 'self' })
      return
    }
    openSummaryPanel('signoff-review')
  }

  const handlePreviewFinishAndFile = () => {
    setPreparerHandoffChoice('finish-and-file')
    openSummaryPanel('finish-and-file', summaryOpts)
  }

  const handleConfirmHandoffSend = () => {
    setPreparerHandoffChoice('awaiting-reviewer')
    openSummaryPanel('awaiting-reviewer', summaryOpts)
  }

  /** Jump from summary — peer panels replace Summary when they would overlap */
  const handleHandoffJump = useCallback((jump: HandoffJump) => {
    if (jump.type === 'notesPane' || jump.type === 'note') {
      if (jump.type === 'note') setFocusNoteId(jump.noteId)
      
      openRightPanel('comments')
      return
    }
    if (jump.type === 'field') {
      // Phase 1 flag keys → source detail field; otherwise try summary / 1040 row
      const fromFlag = PHASE1_VERIFY_QUEUE.find(q => q.flagKey === jump.field)
      if (fromFlag) {
        applyVerifyNavigation(fromFlag.field)
        return
      }
      const mapped = field1040ToDetail(jump.field)
      if (mapped) {
        applyVerifyNavigation(mapped.field)
        return
      }
      const detailNav = navigationForDetailField(jump.field)
      if (detailNav) {
        applyVerifyNavigation(jump.field)
        return
      }
      setSelectedField(jump.field)
      setShow1040(true)
      setOutputFormId('summary')
      requestAnimationFrame(() => {
        document.querySelector(`[data-field-row="${jump.field}"]`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      })
      return
    }
    if (jump.type === 'doc') {
      
      handleNavigateToSourceDoc(jump.docId)
      return
    }
    if (jump.type === 'diagnostic') {
      setPhase('diagnostics')
      openRightPanel('ai')
      setAgentView('report')
      return
    }
    if (jump.type === 'outputForm') {
      setShow1040(true)
      setOutputFormId(jump.formId as OutputFormId)
      return
    }
  }, [
    handleNavigateToSourceDoc,
    setSelectedField,
    setOutputFormId,
    applyVerifyNavigation,
    openRightPanel,
  ])

  /** Canonical chrome entry — Review log (pass-aware content, unified two-tab drawer) */
  const handleOpenSummaryReport = () => {
    if (reviewRole === 'reviewer') {
      if (reviewPass === 1) {
        openSummaryPanel('signoff-review', {
          pass: 1,
          actor: pass1ActorLabel,
          voice: 'reviewer-briefing',
        })
      } else {
        openSummaryPanel('signoff-review', {
          pass: 2,
          actor: REVIEWER_NAME,
          voice: 'self',
        })
      }
      return
    }
    openSummaryPanel('signoff-review')
  }

  /** Transition from Pass 1 briefing into Pass 2 strategic checklist (Tab 1 default). */
  const handleBeginPass2Review = () => {
    setReviewerReviewStarted(true)
    setReviewPass(2)
    setReviewRole('reviewer')
    setReviewActor(REVIEWER_NAME)
    setPhase('diagnostics')
    setShow1040(true)
    setOutputFormId('summary')
    openSummaryPanel('signoff-review', {
      pass: 2,
      actor: REVIEWER_NAME,
      voice: 'self',
    })
  }

  /** Switch demo chrome to reviewer — returns to SmartReturn landing */
  const handleSwitchToReviewerRole = () => {
    navigate('/smart-return?role=reviewer')
  }

  /** Header CTA — reviewer lands directly on Pass 2 strategic checklist */
  const handleReviewReturn = () => {
    setReviewerReviewStarted(true)
    setReviewRole('reviewer')
    setReviewActor(REVIEWER_NAME)
    setReviewPass(2)
    setPhase('diagnostics')
    setShow1040(true)
    setOutputFormId('summary')
    openSummaryPanel('signoff-review', {
      pass: 2,
      actor: REVIEWER_NAME,
      voice: 'self',
    })
    setSummaryBriefEnterAnim(true)
    setNotes(prev => {
      if (prev.length > 0) return prev
      return [{
        id: 'note-seed-pass1',
        text: 'Please confirm NIIT Form 8960 still applies after AGI tweak. SC',
        author: PREPARER_NAME,
        at: formatNoteAt(),
        context: 'Form 8960',
        status: 'open',
        role: 'preparer',
        replies: [],
      }]
    })
  }

  // Preparer entry (Import confirmation / Input return tab): Return Summary full width, panels closed.
  // Re-run on route navigation (location.key), not on every render — setSelectedField is unstable.
  useEffect(() => {
    if (!isPreparerEntry) return
    resetReviewState()
    setNotes([])
    try { localStorage.removeItem(NOTES_KEY) } catch { /* ignore */ }
    setReviewRole('preparer')
    setReviewPass(1)
    setReviewActor(PREPARER_NAME)
    setReviewerReviewStarted(false)
    setPhase('import')
    setShow1040(true)
    setOutputFormId('summary')
    setImportsStarted(false)
    setSelectedField(null)
    setSummaryMode('signoff-review')
    setSummaryOpts({})
    setRightPanelExiting(false)
    setPanelClosing(false)
    setRightPanelMode('closed')
    setOutputSourcesCoach(false)
    setCoachTip(null)
    // Fresh preparer session — replay the Summary (i) coach sequence like ProtoC welcome
    try { sessionStorage.removeItem('protoc-coach-tip:outputSourcesFirst') } catch { /* ignore */ }
  }, [entry, roleParam, isPreparerEntry, location.key, resetReviewState])

  // Auto-start review when navigated from SmartReturn header CTA
  const startReviewHandled = useRef(false)
  useEffect(() => {
    if (!startReviewParam || startReviewHandled.current || !entry) return
    startReviewHandled.current = true
    handleReviewReturn()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on entry from SmartReturn
  }, [startReviewParam, entry])

  // End staged brief reveal after animation completes
  useEffect(() => {
    if (!summaryBriefEnterAnim) return
    const timer = window.setTimeout(() => setSummaryBriefEnterAnim(false), 2800)
    return () => window.clearTimeout(timer)
  }, [summaryBriefEnterAnim])

  /** Demo chrome: jump between Pass 1 / Pass 2 without full grind */
  const handleSwitchRole = (role: 'preparer' | 'reviewer') => {
    setStoredDemoRole(role)
    if (role === 'reviewer') {
      handleSwitchToReviewerRole()
      return
    }
    setReviewRole('preparer')
    setReviewPass(1)
    setReviewActor(PREPARER_NAME)
    setReviewerReviewStarted(false)
    setPhase('import')
    setImportsStarted(false)
    setShow1040(true)
    setOutputFormId('summary')
    setFocusNoteId(null)
    setSummaryMode('signoff-review')
    setSummaryOpts({})
    closeRightPanel()
    navigate('/data-review?entry=input-return&role=preparer', { replace: true })
  }

  const handoffSnapshot: HandoffSnapshot | null =
    rightPanelMode === 'summary'
      ? buildSnapshot(
          summaryMode,
          summaryOpts.pass ?? reviewPass,
          summaryOpts.actor ?? actorLabel,
          summaryOpts.voice ?? 'self',
        )
      : null


  /**
   * Shared drag bootstrap: pointer events + document-level move/up while dragging.
   * Falls back cleanly if the gesture was not a primary button press.
   */
  const beginPanelDrag = useCallback((
    e: React.PointerEvent,
    cursor: string,
    onMove: (clientX: number, clientY: number) => void,
  ) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture?.(e.pointerId)
    setPanelResizing(true)
    document.body.style.cursor = cursor
    document.body.style.userSelect = 'none'

    const onPointerMove = (moveEvent: PointerEvent) => {
      onMove(moveEvent.clientX, moveEvent.clientY)
    }
    const onPointerUp = (upEvent: PointerEvent) => {
      try { target.releasePointerCapture?.(upEvent.pointerId) } catch { /* already released */ }
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setPanelResizing(false)
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
  }, [])

  // Horizontal drag between left panel and agent panel (resizes agent panel px width).
  // Keep Summary ≥ LEFT_PANEL_MIN_WIDTH (795.7px) so breakdown labels aren’t truncated.
  const handleAgentDrag = useCallback((e: React.PointerEvent) => {
    const body = bodyRef.current
    if (!body) return
    const startX = e.clientX
    const startPanelWidth = agentPanelWidth
    beginPanelDrag(e, 'col-resize', (clientX) => {
      const delta = startX - clientX // dragging left = wider agent panel
      const bodyW = body.getBoundingClientRect().width
      const preferredMax = bodyW - LEFT_PANEL_MIN_WIDTH - PANEL_DRAG_HANDLE_WIDTH
      const upper = Math.min(bodyW * 0.7, Math.max(0, preferredMax))
      const floor = Math.min(360, upper)
      const next = startPanelWidth + delta
      setAgentPanelWidth(Math.max(floor, Math.min(upper, next)))
    })
  }, [agentPanelWidth, beginPanelDrag])

  // Horizontal drag between left panel and right panel (resizes rightPanelWidth).
  // Keep Summary ≥ LEFT_PANEL_MIN_WIDTH (795.7px) so breakdown labels aren’t truncated.
  const handleRightPanelDrag = useCallback((e: React.PointerEvent) => {
    const body = bodyRef.current
    if (!body) return
    const startX = e.clientX
    const startPanelWidth = rightPanelWidth
    beginPanelDrag(e, 'col-resize', (clientX) => {
      const delta = startX - clientX // dragging left = wider right panel
      const bodyW = body.getBoundingClientRect().width
      const preferredMax = bodyW - LEFT_PANEL_MIN_WIDTH - PANEL_DRAG_HANDLE_WIDTH
      const upper = Math.min(bodyW * 0.75, Math.max(0, preferredMax))
      const floor = Math.min(RIGHT_PANEL_MIN_WIDTH, upper)
      const next = startPanelWidth + delta
      setRightPanelWidth(Math.max(floor, Math.min(upper, next)))
    })
  }, [rightPanelWidth, beginPanelDrag])

  // Keep bodyWidth in sync (Sources share of row uses rightPanelWidth / bodyWidth).
  // Prefer clientWidth (scrollport) so overflowed content min-sizes don't inflate the ratio.
  // Re-bind when phase changes so ProtoC attaches after leaving welcome (body mounts).
  useEffect(() => {
    const body = bodyRef.current
    if (!body || typeof ResizeObserver === 'undefined') return
    const update = () => setBodyWidth(body.clientWidth || body.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(body)
    return () => ro.disconnect()
  }, [phase])

  // Clamp Sources width when the viewport shrinks so Summary stays ≥ LEFT_PANEL_MIN_WIDTH.
  useEffect(() => {
    if (bodyWidth <= 0 || rightPanelMode === 'closed' || rightPanelMode === 'ai' || rightPanelMode === 'summary') return
    const maxRight = Math.max(0, bodyWidth - LEFT_PANEL_MIN_WIDTH - PANEL_DRAG_HANDLE_WIDTH)
    setRightPanelWidth((w) => Math.min(w, maxRight))
  }, [bodyWidth, rightPanelMode])

  // Side-by-side (doc LEFT / Details RIGHT) when:
  //   1. Hide Summary (!show1040), OR
  //   2. Sources (right) panel is >60% of review body width
  // Stacked (preview TOP / Details BOTTOM) when Summary is visible AND
  // Sources panel is ≤60% of body.
  // freezePreviewSideBySide holds orientation steady during Hide/Show Summary.
  const sourcesPanelWide =
    rightPanelMode === 'sources' &&
    !rightPanelExiting &&
    bodyWidth > 0 &&
    rightPanelWidth / bodyWidth > 0.6
  const previewSideBySide = freezePreviewSideBySide || !show1040 || sourcesPanelWide

  const outstandingOpenCount = getOutstandingOpenCount(buildSnapshot('signoff-review'))

  const inImportPhase = phase === 'import'

  const reviewChecklist = deriveReviewChecklist({
    reviewedFields,
    verifiedDocs,
    reviewerConfirmedDocs,
    summaryCheckedFields,
    reviewerConfirmedFields,
    reviewerConfirmStaleFields,
    reviewerSignedOffForms,
    amounts,
    manualChecklistItems,
    outstandingOpenCount,
  })

  const singlePersonMode = reviewPass === 1

  const milestoneState = deriveMilestoneState({
    verifiedDocs,
    reviewerConfirmedDocs,
    summaryCheckedFields,
    reviewerConfirmedFields,
    reviewerConfirmStaleFields,
    reviewerSignedOffForms,
    verifiedDocsMeta,
    reviewerConfirmedDocsMeta,
    reviewerSignedOffFormsMeta,
    amounts,
    reviewedFields,
    completedMilestones,
    outstandingOpenCount,
    currentActorName: getReviewActor(),
    reviewPass,
    singlePersonMode,
  })

  /** Source Documents toolbar badge — matches tab flag totals (or unreviewed docs after flags clear). */
  const sourceDocsBadgeCount = (() => {
    if (reviewRole === 'preparer' && inImportPhase) {
      if (phase1Remaining > 0) return phase1Remaining
      return unreviewedDocCount
    }
    if (reviewRole === 'reviewer' && reviewPass === 2) {
      return pass2DocConfirmOpenCount
    }
    return 0
  })()

  /** Checklist pending badge — reviewer only (Review log toolbar). */
  const isReviewerBriefing = (summaryOpts.voice ?? 'self') === 'reviewer-briefing'
  const showChecklist = !isReviewerBriefing

  const summaryBadgeCount = (() => {
    if (reviewRole !== 'reviewer') return 0
    if (!showChecklist) return 0
    const brief = buildSmartReviewBrief({
      snapshot: buildSnapshot('signoff-review'),
      checklist: reviewChecklist,
      milestoneState,
      outstandingOpenCount,
      manualChecklistItems,
      reviewPass,
      showStrategicChecklist: true,
      isPreparer: reviewRole === 'preparer',
      amounts,
      singlePersonMode,
    })
    return countStrategicOpenItems(brief.phases)
  })()

  const signOffGatingActive = !inImportPhase && reviewRole === 'reviewer'
  const briefForGating = buildSmartReviewBrief({
    snapshot: buildSnapshot('signoff-review'),
    checklist: reviewChecklist,
    milestoneState,
    outstandingOpenCount,
    manualChecklistItems,
    reviewPass,
    showStrategicChecklist: showChecklist,
    isPreparer: reviewRole === 'preparer',
    amounts,
    singlePersonMode,
  })
  const signOffReady = !signOffGatingActive || (
    showChecklist
      ? canApproveSignOff(briefForGating)
      : canSignOffFromMilestones(milestoneState, outstandingOpenCount)
  )
  const signOffBlockerMessage = signOffGatingActive
    ? signOffBlockerFromMilestones(milestoneState, outstandingOpenCount)
    : null

  // Resize drag between the document preview and detail fields. Axis is frozen
  // for the gesture (matches flexDirection at pointer-down). previewHeight
  // only controls the split ratio — never orientation.
  const handlePreviewDrag = useCallback((e: React.PointerEvent) => {
    const split = splitPaneRef.current ?? rightRef.current
    if (!split) return

    // Freeze axis to the layout at pointer-down (matches flexDirection).
    const stacked = !previewSideBySide
    const startPos = stacked ? e.clientY : e.clientX
    const startSize = previewHeight
    beginPanelDrag(e, stacked ? 'row-resize' : 'col-resize', (clientX, clientY) => {
      const pos = stacked ? clientY : clientX
      const delta = pos - startPos
      const rect = split.getBoundingClientRect()
      const splitSize = stacked ? rect.height : rect.width
      if (splitSize <= 0) return
      setPreviewHeight(Math.max(20, Math.min(75, startSize + (delta / splitSize) * 100)))
    })
  }, [previewHeight, previewSideBySide, beginPanelDrag])

  // While Summary is animating or collapsed, right/agent panel flex-fills
  const panelUsesAgentWidth = rightPanelMode === 'ai'
  const activePanelWidth = panelUsesAgentWidth ? agentPanelWidth : rightPanelWidth
  const shellHidden = !rightPanelOpen && !rightPanelExiting
  const rightPanelFills = (!show1040 || leftAnimWidth !== null) && rightPanelOpen

  const handleHideSummary = useCallback(() => {
    const body = bodyRef.current
    const left = leftPanelRef.current
    if (!body) {
      setShow1040(false)
      return
    }
    const bodyW = body.clientWidth || body.getBoundingClientRect().width
    const leftW = left?.getBoundingClientRect().width
      ?? Math.max(0, bodyW - rightPanelWidth - PANEL_DRAG_HANDLE_WIDTH)
    preCollapseRightWidthRef.current = rightPanelWidth
    // If doc|Details is already side-by-side, keep that axis for the whole motion.
    if (previewSideBySide) setFreezePreviewSideBySide(true)

    // Frame 1: lock left at its current pixel width (right switches to flex-fill
    // via leftAnimWidth !== null) — visually identical, no reflow jump.
    setLeftAnimWidth(leftW)
    if (summaryToggleTimerRef.current) clearTimeout(summaryToggleTimerRef.current)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setShow1040(false)
        setLeftAnimWidth(0)
      })
    })

    summaryToggleTimerRef.current = setTimeout(() => {
      setLeftAnimWidth(null)
      setFreezePreviewSideBySide(false)
      summaryToggleTimerRef.current = null
    }, SUMMARY_TOGGLE_MS)
  }, [previewSideBySide, rightPanelWidth])

  /**
   * First-time only: collapse outputs and point at Show outputs when focusing
   * source docs (banner CTA / popover). Later opens keep Summary visible.
   */
  const hideOutputsForSourceFocus = useCallback(() => {
    if (readCoachTipShown('showOutputs')) return
    if (show1040) {
      if (coachTip === 'hideSummary') dismissCoachTip('hideSummary')
      else if (!readCoachTipShown('hideSummary')) markCoachTipShown('hideSummary')
      handleHideSummary()
    }
    markCoachTipShown('showOutputs')
    setCoachTip('showOutputs')
  }, [show1040, coachTip, dismissCoachTip, handleHideSummary])
  hideOutputsForSourceFocusRef.current = hideOutputsForSourceFocus

  const handleShowSummary = useCallback(() => {
    const body = bodyRef.current
    const bodyW = body
      ? (body.clientWidth || body.getBoundingClientRect().width)
      : window.innerWidth
    const restoreWidth = preCollapseRightWidthRef.current
      ?? Math.max(480, Math.round(bodyW * 0.65))
    const targetLeft = Math.max(0, bodyW - restoreWidth - PANEL_DRAG_HANDLE_WIDTH)
    // Keep side-by-side frozen when restoring into a wide Sources layout.
    if (restoreWidth / bodyW > 0.6) setFreezePreviewSideBySide(true)

    setLeftAnimWidth(0)
    setShow1040(true)
    if (summaryToggleTimerRef.current) clearTimeout(summaryToggleTimerRef.current)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setLeftAnimWidth(targetLeft)
        setRightPanelWidth(restoreWidth)
      })
    })

    summaryToggleTimerRef.current = setTimeout(() => {
      setLeftAnimWidth(null)
      setFreezePreviewSideBySide(false)
      preCollapseRightWidthRef.current = null
      summaryToggleTimerRef.current = null
    }, SUMMARY_TOGGLE_MS)
  }, [])

  /**
   * Lighter empty-canvas fix: when the user closes the last right-rail panel while
   * outputs are hidden, restore Return Summary. Only fires on panel close (open→closed),
   * not when hiding outputs with the panel already closed — preserves full-width Sources
   * and coach-tip hide/show flows.
   */
  useEffect(() => {
    const wasOpen = prevRightPanelOpenRef.current
    const isOpen = rightPanelOpen
    prevRightPanelOpenRef.current = isOpen

    if (!wasOpen || isOpen || show1040) return

    const timer = setTimeout(() => {
      if (
        show1040 ||
        rightPanelMode !== 'closed' ||
        rightPanelExiting ||
        panelClosing ||
        leftAnimWidth !== null
      ) {
        return
      }
      handleShowSummary()
    }, 50)

    return () => clearTimeout(timer)
  }, [
    rightPanelOpen,
    show1040,
    rightPanelMode,
    rightPanelExiting,
    panelClosing,
    leftAnimWidth,
    handleShowSummary,
  ])

  // ProtoC: preparer skips welcome — lands in import phase, Return Summary full width, panels closed
  if (!entryValid) return null

  const summaryPanelLabel = 'Review log'
  const isReviewerConfirmMode = reviewRole === 'reviewer'
  /** ProtoC Phase 1 banner — visible for entire preparer import phase (CTA before sources open). */
  const showPreparerImportPhase = inImportPhase && reviewRole === 'preparer'
  /** Left outputs share row with Smart review brief — allow flex shrink (avoid 795px + 755px overflow). */
  const outputsShareWithBrief = summaryPanelOpen && show1040
  return (
    <div className={styles.page}>
      <DemoRoleBar role={reviewRole} onRoleChange={handleSwitchRole} />
      {/* Header — title + peer icon controls (Sign-off lives on Step 2 banner) */}
      <div className={styles.headerBlock}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerTitle}>Data Review - Form 1040</span>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.headerIconGroup}>
              <span className={styles.headerIconWrap}>
                <IconControl
                  label="Comments"
                  size="medium"
                  selected={notesOpen}
                  aria-label="Comments"
                  onClick={notesOpen ? handleCloseNotes : handleOpenNotes}
                >
                  <Comment size="medium" />
                </IconControl>
                {notes.length > 0 && (
                  <AttentionCountBadge count={notes.length} className={styles.toolbarBadge} aria-hidden />
                )}
              </span>
              <span className={styles.headerIconWrap}>
                <IconControl
                  label={summaryPanelLabel}
                  size="medium"
                  selected={summaryPanelOpen}
                  aria-label={
                    summaryBadgeCount > 0
                      ? `${summaryPanelLabel}, ${summaryBadgeCount} checklist item${summaryBadgeCount === 1 ? '' : 's'} remaining`
                      : summaryPanelLabel
                  }
                  onClick={
                    summaryPanelOpen ? handleCloseSummaryPanel : handleOpenSummaryReport
                  }
                >
                  <ClockCounterclockwise size="medium" />
                </IconControl>
                {summaryBadgeCount > 0 && (
                  <AttentionCountBadge count={summaryBadgeCount} className={styles.toolbarBadge} aria-hidden />
                )}
              </span>
            </div>
            {(reviewRole !== 'reviewer' || reviewerReviewStarted) && (
            <button
              className={`${styles.intuitIntelBtn} ${rightPanelVisible && !agentPanelActive ? styles.intuitIntelBtnActive : ''}`}
              aria-label={
                sourceDocsBadgeCount > 0
                  ? `Source Documents, ${sourceDocsBadgeCount} item${sourceDocsBadgeCount === 1 ? '' : 's'} need attention`
                  : 'Toggle panel'
              }
              style={{ position: 'relative' }}
              onClick={() => {
                if (agentPanelActive) {
                  handleAgentClose()
                } else if (rightPanelMode === 'comments' || rightPanelMode === 'summary') {
                  openRightPanel('sources')
                } else if (rightPanelMode === 'sources') {
                  closeRightPanel()
                } else if (reviewRole === 'reviewer' || importsStarted) {
                  openRightPanel('sources')
                } else {
                  startReviewingImports()
                }
              }}
            >
              <Panel size="medium" />
              <span className={styles.intuitIntelLabel}>Source Documents</span>
              {sourceDocsBadgeCount > 0 && (
                <AttentionCountBadge count={sourceDocsBadgeCount} className={styles.toolbarBadge} aria-hidden />
              )}
            </button>
            )}
            {/* ProtoC: AI Review is Phase 2 only — hidden during Phase 1 (import accuracy) */}
            {!inImportPhase && (
              <button
                className={`${styles.intuitIntelBtn} ${agentPanelActive ? styles.intuitIntelBtnActive : ''}`}
                aria-label={
                  !agentPanelActive && phase2Progress.remaining > 0
                    ? `AI diagnostics, ${phase2Progress.reviewed} of ${phase2Progress.total} diagnostics reviewed, ${phase2Progress.remaining} diagnostics remaining`
                    : 'AI diagnostics'
                }
                style={{ position: 'relative' }}
                onClick={() => handleAgentOpen()}
              >
                <img src={intuitAssistIcon} alt="" className={styles.intuitIntelIcon} />
                <span className={styles.intuitIntelLabel}>AI diagnostics</span>
                {!agentPanelActive && phase2Progress.remaining > 0 && (
                  <AttentionCountBadge count={phase2Progress.remaining} className={styles.toolbarBadge} aria-hidden />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ProtoC Phase 1 — Import Accuracy banner (preparer only) */}
      {showPreparerImportPhase && (
        <Phase1Banner
          resolved={phase1Resolved}
          total={phase1Total}
          flagsCleared={flagsCleared}
          unreviewedDocCount={unreviewedDocCount}
          complete={phase1FullyComplete}
          onContinue={handleBeginDiagnostics}
          importsStarted={importsStarted}
          onStartImports={startReviewingImports}
          continueCoachOpen={continueDiagnosticsCoach}
          onDismissContinueCoach={dismissContinueDiagnosticsCoach}
        />
      )}

      {/* ProtoC Phase 2 — AI Diagnostics banner. Shares Phase1Banner's visual language
          (Intuit Assist icon, title/subtitle, progress) so both phases feel like one
          continuous guided experience rather than two disconnected screens. */}
      {!inImportPhase && (
        <Phase2Banner
          reviewed={phase2Reviewed}
          total={phase2Total}
          complete={phase2Complete}
          diagnosticsOpen={agentPanelActive}
          onOpenDiagnostics={() => handleAgentOpen()}
          checklistProgress={
            signOffGatingActive
              ? { complete: milestoneState.requiredCompleteCount, total: milestoneState.requiredTotal }
              : undefined
          }
          signOffSlot={
            reviewRole === 'preparer' ? (
              <Button
                priority="primary"
                size="medium"
                onClick={handleWrapUpPass}
                automationId="phase2-sign-off"
                disabled={signOffGatingActive && !signOffReady}
              >
                Sign-off
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Body — left panel + drag handle + right panel + agent panel */}
      <div className={styles.body} ref={bodyRef}>
        {/* ProtoC Phase 1: 1040 is minimized by default — collapsed to a compact button
            pinned near the top of the column. Expanding grows the panel horizontally, so
            the chevron points right (expand) / left (collapse) rather than up/down. Left
            panel stays mounted and animates width/opacity (same pattern as .rightPanel)
            so the transition is smooth. */}
        {/* Collapsed "Show outputs" edge tab — available in import and AI phases */}
        <div
          className={`${styles.form1040HandleWrap} ${coachTip === 'showOutputs' && !show1040 ? styles.form1040HandleWrapCoach : ''}`}
          style={{
            width: show1040 ? 0 : SHOW_SUMMARY_HANDLE_WIDTH,
            opacity: show1040 ? 0 : 1,
            pointerEvents: show1040 ? 'none' : 'auto',
            transition: panelResizing ? 'none' : undefined,
          }}
        >
          <CoachTip
            open={coachTip === 'showOutputs' && !show1040}
            title="Show outputs"
            message="Bring Summary back anytime with Show outputs."
            onClose={() => dismissCoachTip('showOutputs')}
            position="left"
            alignment="middle"
          >
            <button
              type="button"
              className={styles.form1040Handle}
              onClick={() => {
                if (coachTip === 'showOutputs') dismissCoachTip('showOutputs')
                handleShowSummary()
              }}
              aria-label="Show outputs"
            >
              <ChevronRight size="small" className={styles.form1040HandleIcon} />
              <span className={styles.form1040HandleLabel}>Show outputs</span>
            </button>
          </CoachTip>
        </div>
        <div
          ref={leftPanelRef}
          className={styles.leftPanel}
          style={{
            /* During toggle, drive an explicit px width so min-width→0 and collapse
               interpolate together; otherwise flex:1 grows into remaining space. */
            flex: leftAnimWidth !== null
              ? `0 0 ${leftAnimWidth}px`
              : !show1040 ? '0 0 0px'
              : outputsShareWithBrief ? '1 1 0%'
              : 1,
            width: leftAnimWidth !== null
              ? leftAnimWidth
              : !show1040 ? 0 : undefined,
            opacity: !show1040 ? 0 : 1,
            /* Keep Summary ≥ 795.7px so Return Breakdown labels aren’t truncated.
               Collapse animation / Hide outputs / brief-open still use minWidth 0. */
            minWidth: leftAnimWidth !== null || !show1040 || outputsShareWithBrief
              ? 0
              : LEFT_PANEL_MIN_WIDTH,
            transition: panelResizing ? 'none' : undefined,
          }}
        >
          <LeftPanel1040
            selectedField={selectedField}
            highlightField={highlightField1040}
            onFieldClick={inImportPhase ? handle1040FieldClick : setSelectedField}
            total1a={total1a}
            wages={wages}
            yoyExpanded={yoyExpanded || agentSubView === 'yoyDetail' || activeTopTab === 'prior-1040' || phase === 'diagnostics'}
            reviewedFields={reviewedFields}
            checkedFields={summaryCheckedFields}
            checkedMeta={summaryCheckedMeta}
            reviewerConfirmedFields={reviewerConfirmedFields}
            reviewerConfirmedMeta={reviewerConfirmedMeta}
            reviewerConfirmStaleFields={reviewerConfirmStaleFields}
            onToggleChecked={toggleSummaryChecked}
            onTogglePreparerCheck={toggleSummaryPreparerCheck}
            onToggleReviewerConfirm={toggleSummaryReviewerConfirm}
            reviewRole={reviewRole}
            reviewerSignedOffForms={reviewerSignedOffForms}
            reviewerSignedOffFormsMeta={reviewerSignedOffFormsMeta}
            onToggleFormSignOff={toggleReviewerFormSignOff}
            flaggedFields={summaryFlaggedFields}
            flaggedMeta={summaryFlaggedMeta}
            onToggleFlagged={toggleSummaryFlagged}
            flagNotes={summaryFlagNotes}
            flagActivity={summaryFlagActivity}
            onSetFlagNote={setSummaryFlagNote}
            issueField={issueField}
            activeDiagnosticKey={activeDiagnosticKey}
            liveTotals={liveTotals}
            liveAmounts={amounts}
            editedFields={editedFields}
            outputFormId={outputFormId}
            onOutputFormChange={setOutputFormId}
            showHideOutputs={bothPanelsOpen}
            onHideOutputs={() => {
              if (coachTip === 'hideSummary') dismissCoachTip('hideSummary')
              handleHideSummary()
            }}
            hideOutputsCoachOpen={coachTip === 'hideSummary' && bothPanelsOpen}
            onDismissHideOutputsCoach={() => dismissCoachTip('hideSummary')}
            outputFormsCoachOpen={outputFormsCoach}
            onDismissOutputFormsCoach={dismissOutputFormsCoach}
            outputSourcesCoachOpen={outputSourcesCoach}
            onDismissOutputSourcesCoach={dismissOutputSourcesCoach}
            onAddFieldNote={(text, context) => handleAddNote(text, context)}
            onNavigateToSourceDoc={handleNavigateToSourceDoc}
            onNavigateSource={handleNavigateSource}
            onViewSource={(fieldName, sourceLabel) => {
              // Map field → document tab
              const tabMap: Record<string, typeof activeTopTab> = {
                wages:           'w2s',
                w2Withholding:   'w2s',
                withholding:     '1099-divs',
                taxableInterest: '1099-ints',
                qualifiedDivs:   '1099-divs',
                ordinaryDivs:    '1099-divs',
                withholding1099: '1099-rs',
                iraDistrib:      '1099-rs',
                otherIncome:     '1099-necs',
                capitalGain:     'w2s',
                stdDeduction:    'w2s',
                agi:             'prior-1040',
                totalTax:        'prior-1040',
                amountOwed:      'prior-1040',
                totalPayments:   'prior-1040',
              }
              const tab = tabMap[fieldName] ?? 'w2s'
              setActiveTopTab(tab)

              // Navigate to the correct W-2 sub-tab based on source label
              if (tab === 'w2s' && sourceLabel) {
                const lc = sourceLabel.toLowerCase()
                if (lc.includes('tech circle')) setActiveSubTab('techCircle')
              }

              if (!importsStarted && reviewRole === 'preparer') {
                startReviewingImports()
              } else if (agentPanelActive) {
                // Agent is open — close it preserving the field selection
                setFromAgent(true)
                setAgentSubView('overview')
                handleAgentClose(true)
              } else {
                ensureSourcePanelVisible()
              }
            }}
          />
        </div>

        {/* Left/right drag handle — stays mounted and collapses width with Summary
            so the gutter doesn't pop out of the row mid-animation. */}
        {rightPanelOpen && !rightPanelExiting && show1040 && (
              <div
                className={`${dragStyles.handleVertical} ${styles.summarySplitter}`}
                onPointerDown={show1040 ? (panelUsesAgentWidth ? handleAgentDrag : handleRightPanelDrag) : undefined}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize right panel"
                aria-hidden={!show1040}
                style={{
                  width: !show1040 ? 0 : PANEL_DRAG_HANDLE_WIDTH,
                  opacity: !show1040 ? 0 : 1,
                  pointerEvents: !show1040 ? 'none' : 'auto',
                  transition: panelResizing ? 'none' : undefined,
                }}
              >
                <VerticalGripIcon />
              </div>
            )}

            {/* Unified right rail — one shell; inner content switches by rightPanelMode */}
            <div
              className={`${styles.rightPanel} ${rightPanelAnimating ? styles.rightPanelEntering : ''} ${rightPanelExiting ? styles.rightPanelExiting : ''} ${rightPanelFills ? styles.rightPanelFills : ''}`}
              ref={rightRef}
              style={{
                width: shellHidden ? 0 : (rightPanelFills ? undefined : activePanelWidth),
                flex: (rightPanelFills && rightPanelOpen) ? '1 1 0%' : '0 0 auto',
                minWidth: 0,
                overflow: 'hidden',
                opacity: shellHidden ? 0 : 1,
                transition: panelResizing ? 'none' : undefined,
              }}
            >
              {rightPanelMode === 'sources' && (
              <>
              {/* Source panel header — title left; Close on right */}
              <div className={styles.sourcePanelHeader}>
                {/* "Back to agent insights" only makes sense in Phase 2, after navigating from the agent */}
                {!inImportPhase && fromAgent ? (
                  <button
                    className={styles.agentBackBtn}
                    onClick={() => { setFromAgent(false); setActiveIssueField(null); handleAgentOpen(agentSubView) }}
                  >
                    <ChevronLeft size="small" /> Back to agent insights
                  </button>
                ) : (
                  <div className={styles.sourcePanelTitleGroup}>
                    <span className={styles.sourcePanelTitle}>
                      {isReviewerConfirmMode ? 'Source documents' : 'Imported documents'}
                    </span>
                    {isReviewerConfirmMode && (
                      <span className={styles.sourcePanelLayerBadge}>
                        Reviewer confirm mode · Preparer attestation shown
                      </span>
                    )}
                  </div>
                )}
                <div className={styles.sourcePanelActions}>
                  <IconControl
                    size="small"
                    aria-label="Close"
                    onClick={handleCloseSourcePanel}
                  >
                    <Close size="small" />
                  </IconControl>
                </div>
              </div>
              {showPreparerImportPhase && phase1Remaining > 0 && (
                <Phase1IssueBanner
                  mode="flags"
                  unresolvedCount={phase1Remaining}
                  onVerify={handleVerifyNext}
                />
              )}
              {showPreparerImportPhase && flagsCleared && unreviewedDocCount > 0 && !phase1FullyComplete && (
                <Phase1IssueBanner
                  mode="documents"
                  unreviewedDocCount={unreviewedDocCount}
                  onReviewNextDocument={handleReviewNextDocument}
                />
              )}
              <ReviewTab
                activeTopTab={activeTopTab}
                flagCounts={showPreparerImportPhase ? tabFlagCounts : undefined}
                initialFlagCounts={showPreparerImportPhase ? tabInitialFlagCounts : undefined}
                verifiedDocs={verifiedDocs}
                tabVerifiedKeys={tabVerifiedKeys}
                typeReviewed={showPreparerImportPhase ? typeReviewed : undefined}
                tabConfirmStatus={reviewRole === 'reviewer' ? tabConfirmStatus : undefined}
                tabConfirmCounts={reviewRole === 'reviewer' ? tabConfirmCounts : undefined}
                onTopTabChange={(tab) => {
                  setActiveTopTab(tab)
                  setFromAgent(false)
                  setSelectedField(null)
                  setActiveIssueField(null)
                }}
              />

              {/* Peel tabs — payer switcher for multi-payer doc types */}
              {activeTopTab === '1099-divs' && (
                <PeelTab
                  tabs={DIV_PAYER_TABS.map(t => ({
                    ...t,
                    badge: divPayerFieldCounts[t.key],
                    showClearedCheck: isDocShownVerified(verifiedDocs, divVerifiedDocKey(t.key), reviewerConfirmedDocs),
                    confirmStatus: peelDocConfirmStatus(divVerifiedDocKey(t.key)),
                  }))}
                  activeKey={activeDivPayer}
                  onChange={key => setActiveDivPayer(key as DivPayer)}
                />
              )}
              {activeTopTab === '1099-ints' && (
                <PeelTab
                  tabs={INT_PAYER_TABS.map(t => ({
                    ...t,
                    badge: intPayerFieldCounts[t.key],
                    showClearedCheck: isDocShownVerified(verifiedDocs, intVerifiedDocKey(t.key), reviewerConfirmedDocs),
                    confirmStatus: peelDocConfirmStatus(intVerifiedDocKey(t.key)),
                  }))}
                  activeKey={activeIntPayer}
                  onChange={key => setActiveIntPayer(key as IntPayer)}
                />
              )}
              {activeTopTab === 'w2s' && (
                <PeelTab
                  tabs={W2_PAYER_TABS.map(t => ({
                    ...t,
                    badge: w2PayerFieldCounts[t.key],
                    showClearedCheck: isDocShownVerified(verifiedDocs, t.key, reviewerConfirmedDocs),
                    confirmStatus: peelDocConfirmStatus(t.key),
                  }))}
                  activeKey={activeSubTab}
                  onChange={key => setActiveSubTab(key as W2Employer)}
                />
              )}
              {activeTopTab === '1099-rs' && (
                <PeelTab
                  tabs={R_PAYER_TABS.map(t => ({
                    ...t,
                    badge: tabFlagCounts['1099-rs'],
                    showClearedCheck: isDocShownVerified(verifiedDocs, '1099-r', reviewerConfirmedDocs),
                    confirmStatus: peelDocConfirmStatus('1099-r'),
                  }))}
                  activeKey="meridian"
                  onChange={() => {}}
                />
              )}
              {activeTopTab === '1099-necs' && (
                <PeelTab
                  tabs={NEC_PAYER_TABS.map(t => ({
                    ...t,
                    badge: 0,
                    showClearedCheck: isDocShownVerified(verifiedDocs, '1099-nec', reviewerConfirmedDocs),
                    confirmStatus: peelDocConfirmStatus('1099-nec'),
                  }))}
                  activeKey="summit"
                  onChange={() => {}}
                />
              )}

              {/* Document preview + detail fields. flex-basis % (not width/height alone)
                  so the six-dot handle can shrink the preview even when the document
                  image has a large intrinsic min-size. */}
              <div
                ref={splitPaneRef}
                style={{
                  display: 'flex',
                  flex: 1,
                  minHeight: 0,
                  minWidth: 0,
                  overflow: 'hidden',
                  flexDirection: previewSideBySide ? 'row' : 'column',
                }}
              >
              {activeTopTab !== 'questionnaire' && (
              <>
              <div style={previewSideBySide
                ? {
                    flex: `0 0 ${previewHeight}%`,
                    overflow: 'hidden',
                    borderRight: '1px solid #D5DEE3',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    minWidth: 0,
                  }
                : {
                    flex: `0 0 ${previewHeight}%`,
                    overflow: 'hidden',
                    borderBottom: '1px solid #D5DEE3',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    minWidth: 0,
                  }
              }>
                <DocumentPreview
                  imageSrc={sourceDocPreview.imageSrc}
                  alt={sourceDocPreview.alt}
                  customContent={
                    sourceDocPreview.useInt1099UnwaveringHtml
                      ? <Int1099FormPreview />
                      : undefined
                  }
                />
              </div>

              {/* Drag handle — vertical (col-resize) side by side, horizontal (row-resize) stacked */}
              <div
                className={previewSideBySide ? dragStyles.handleVertical : dragStyles.handleHorizontal}
                onPointerDown={handlePreviewDrag}
                role="separator"
                aria-orientation={previewSideBySide ? 'vertical' : 'horizontal'}
                aria-label="Resize document preview and Details"
              >
                <DotsSix size="small" className={`${dragStyles.handleIcon} ${previewSideBySide ? '' : dragStyles.rotated90}`} />
              </div>
              </>
              )}

              {/* Detail fields — switches based on active tab */}
              <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {activeTopTab === 'w2s' && (
                <DetailFields
                  formTitle="Details: Wages, Salaries, Tips (W-2)"
                  importReadOnly={isReviewerConfirmMode}
                  selectedField={selectedField}
                  highlightMode={highlightMode}
                  onFieldSelect={handleFieldSelect}
                  activeSubTab={activeSubTab}
                  onSubTabChange={(tab) => setActiveSubTab(tab as W2Employer)}
                  wages={{ bingEquipment: 0, techCircle: wages.techCircle }}
                  onWageChange={(employer, value) => {
                    setWages({ ...wages, [employer]: value })
                    markEdited(`wages-${employer}`)
                  }}
                  fieldValues={{ ...fieldValues, withholding: fieldValues.withholding[activeSubTab] }}
                  onFieldValueChange={(key, value) => {
                    if (key === 'withholding' && typeof value === 'number') {
                      updateField('withholding', { techCircle: value })
                      markEdited('withholding')
                    } else {
                      updateField(key as keyof typeof fieldValues, value as number)
                      markEdited(String(key))
                    }
                  }}
                  box12Rows={amounts.box12Rows}
                  onBox12RowChange={(sub, patch) => {
                    updateAmounts({
                      box12Rows: {
                        ...amounts.box12Rows,
                        [sub]: { ...amounts.box12Rows[sub], ...patch },
                      },
                    })
                    markEdited(`box12${sub}-${activeSubTab}`)
                  }}
                  onIdentityChange={(kind, value) => {
                    if (kind === 'ssn') updateAmounts({ employeeSsn: value })
                    else updateAmounts({ employerEin: value })
                    markEdited(kind === 'ssn' ? 'ssn-techCircle' : 'ein-techCircle')
                  }}
                  identityValues={{ ssn: amounts.employeeSsn, ein: amounts.employerEin }}
                  box13={{
                    retirementPlan: amounts.box13RetirementPlan,
                    statutoryEmployee: amounts.box13StatutoryEmployee,
                    thirdPartySickPay: amounts.box13ThirdPartySickPay,
                  }}
                  onBox13Change={patch => {
                    updateAmounts({
                      ...(patch.retirementPlan !== undefined
                        ? { box13RetirementPlan: patch.retirementPlan }
                        : {}),
                      ...(patch.statutoryEmployee !== undefined
                        ? { box13StatutoryEmployee: patch.statutoryEmployee }
                        : {}),
                      ...(patch.thirdPartySickPay !== undefined
                        ? { box13ThirdPartySickPay: patch.thirdPartySickPay }
                        : {}),
                    })
                    markEdited('box13')
                  }}
                  onMarkReviewed={handleMarkReviewed}
                  onMarkReviewedBulk={handleMarkReviewedBulk}
                  reviewedFields={reviewedFields}
                  editedFields={editedFields}
                  editedFieldsMeta={editedFieldsMeta}
                  fieldOverrides={fieldOverrides}
                  onFieldOverride={setFieldOverride}
                  verifiedDocs={verifiedDocs}
                  verifiedDocsMeta={verifiedDocsMeta}
                  reviewerConfirmedDocs={reviewerConfirmedDocs}
                  reviewerConfirmedDocsMeta={reviewerConfirmedDocsMeta}
                  onVerifyDoc={toggleVerifiedDoc}
                  flaggedFields={mergeInputFlags({
                    ssn: PHASE1_FLAG_MESSAGES.w2.ssn,
                    wages: PHASE1_FLAG_MESSAGES.w2.wages,
                    box12: PHASE1_FLAG_MESSAGES.w2.box12,
                    ein: PHASE1_FLAG_MESSAGES.w2.ein,
                  }, yoyInputFlags)}
                />
              )}
              {activeTopTab === '1099-divs' && (
                <DetailFieldsDiv
                  importReadOnly={isReviewerConfirmMode}
                  activePayer={activeDivPayer}
                  selectedField={selectedField}
                  highlightMode={highlightMode}
                  onFieldSelect={handleFieldSelect}
                  fieldValues={{ ...fieldValues, withholding: totalWithholding, divWithholding: amounts.divWithholding }}
                  onFieldValueChange={(key, value) => {
                    updateField(key as keyof typeof fieldValues, value)
                    markEdited(String(key))
                  }}
                  onAmountChange={(patch, editedKey) => {
                    updateAmounts(patch)
                    if (editedKey) markEdited(editedKey)
                  }}
                  amounts={amounts}
                  onMarkReviewed={handleMarkReviewed}
                  onMarkReviewedBulk={handleMarkReviewedBulk}
                  reviewedFields={reviewedFields}
                  editedFields={editedFields}
                  fieldOverrides={fieldOverrides}
                  onFieldOverride={setFieldOverride}
                  verifiedDocs={verifiedDocs}
                  verifiedDocsMeta={verifiedDocsMeta}
                  onVerifyDoc={toggleVerifiedDoc}
                  reviewerConfirmedDocs={reviewerConfirmedDocs}
                  reviewerConfirmedDocsMeta={reviewerConfirmedDocsMeta}
                  flaggedFields={mergeInputFlags({
                    divCollectibles: PHASE1_FLAG_MESSAGES.div.divCollectibles,
                    divNonDiv: PHASE1_FLAG_MESSAGES.div.divNonDiv,
                    fedTaxWithheld: PHASE1_FLAG_MESSAGES.div.fedTaxWithheld,
                    ordinaryDivs: PHASE1_FLAG_MESSAGES.div.ordinaryDivs,
                  }, yoyInputFlags)}
                  onAddFieldNote={(text, context) => handleAddNote(text, context)}
                />
              )}
              {activeTopTab === '1099-ints' && (
                <DetailFields1099
                  importReadOnly={isReviewerConfirmMode}
                  activePayer={activeIntPayer}
                  selectedField={selectedField}
                  highlightMode={highlightMode}
                  onFieldSelect={handleFieldSelect}
                  fieldValues={{ ...fieldValues, withholding: totalWithholding }}
                  onFieldValueChange={(key, value) => {
                    updateField(key as keyof typeof fieldValues, value)
                    markEdited(String(key))
                  }}
                  onAmountChange={(patch, editedKey) => {
                    updateAmounts(patch)
                    if (editedKey) markEdited(editedKey)
                  }}
                  amounts={amounts}
                  onMarkReviewed={handleMarkReviewed}
                  onMarkReviewedBulk={handleMarkReviewedBulk}
                  reviewedFields={reviewedFields}
                  editedFields={editedFields}
                  editedFieldsMeta={editedFieldsMeta}
                  fieldOverrides={fieldOverrides}
                  onFieldOverride={setFieldOverride}
                  verifiedDocs={verifiedDocs}
                  verifiedDocsMeta={verifiedDocsMeta}
                  onVerifyDoc={toggleVerifiedDoc}
                  reviewerConfirmedDocs={reviewerConfirmedDocs}
                  reviewerConfirmedDocsMeta={reviewerConfirmedDocsMeta}
                  flaggedFields={mergeInputFlags({
                    taxableInterest: PHASE1_FLAG_MESSAGES.int.taxableInterest,
                  }, yoyInputFlags)}
                  onAddFieldNote={(text, context) => handleAddNote(text, context)}
                />
              )}
              {activeTopTab === '1099-rs' && (
                <DetailFields1099R
                  importReadOnly={isReviewerConfirmMode}
                  selectedField={selectedField}
                  highlightMode={highlightMode}
                  onFieldSelect={handleFieldSelect}
                  amounts={amounts}
                  onAmountChange={(patch, editedKey) => {
                    updateAmounts(patch)
                    if (editedKey) markEdited(editedKey)
                  }}
                  onMarkReviewed={handleMarkReviewed}
                  onMarkReviewedBulk={handleMarkReviewedBulk}
                  reviewedFields={reviewedFields}
                  editedFields={editedFields}
                  fieldOverrides={fieldOverrides}
                  onFieldOverride={setFieldOverride}
                  verifiedDocs={verifiedDocs}
                  verifiedDocsMeta={verifiedDocsMeta}
                  onVerifyDoc={toggleVerifiedDoc}
                  reviewerConfirmedDocs={reviewerConfirmedDocs}
                  reviewerConfirmedDocsMeta={reviewerConfirmedDocsMeta}
                  flaggedFields={mergeInputFlags({
                    grossDistrib: PHASE1_FLAG_MESSAGES.r.grossDistrib,
                  }, yoyInputFlags)}
                  onAddFieldNote={(text, context) => handleAddNote(text, context)}
                />
              )}
              {activeTopTab === '1099-necs' && (
                <DetailFieldsNec
                  importReadOnly={isReviewerConfirmMode}
                  selectedField={selectedField}
                  highlightMode={highlightMode}
                  onFieldSelect={handleFieldSelect}
                  amounts={amounts}
                  onAmountChange={(patch, editedKey) => {
                    updateAmounts(patch)
                    if (editedKey) markEdited(editedKey)
                  }}
                  onMarkReviewed={handleMarkReviewed}
                  onMarkReviewedBulk={handleMarkReviewedBulk}
                  reviewedFields={reviewedFields}
                  editedFields={editedFields}
                  fieldOverrides={fieldOverrides}
                  onFieldOverride={setFieldOverride}
                  verifiedDocs={verifiedDocs}
                  verifiedDocsMeta={verifiedDocsMeta}
                  onVerifyDoc={toggleVerifiedDoc}
                  reviewerConfirmedDocs={reviewerConfirmedDocs}
                  reviewerConfirmedDocsMeta={reviewerConfirmedDocsMeta}
                  onAddFieldNote={(text, context) => handleAddNote(text, context)}
                />
              )}
              {activeTopTab === 'prior-1040' && (
                <PriorYear1040Fields
                  selectedField={selectedField}
                  highlightMode={highlightMode}
                  onFieldSelect={handleFieldSelect}
                  onMarkReviewed={handleMarkReviewed}
                  reviewedFields={reviewedFields}
                  onAddFieldNote={(text, context) => handleAddNote(text, context)}
                  verifiedDocs={verifiedDocs}
                  verifiedDocsMeta={verifiedDocsMeta}
                  onVerifyDoc={toggleVerifiedDoc}
                  reviewerConfirmedDocs={reviewerConfirmedDocs}
                  reviewerConfirmedDocsMeta={reviewerConfirmedDocsMeta}
                />
              )}
              {activeTopTab === 'questionnaire' && (
                <QuestionnaireResponsesPanel
                  verifiedDocs={verifiedDocs}
                  verifiedDocsMeta={verifiedDocsMeta}
                  onVerifyDoc={toggleVerifiedDoc}
                  reviewerConfirmedDocs={reviewerConfirmedDocs}
                  reviewerConfirmedDocsMeta={reviewerConfirmedDocsMeta}
                  highlightResponseId={questionnaireHighlightId}
                />
              )}
              </div>
              </div>
              </>
              )}

              {rightPanelMode === 'ai' && (
                <AgentLoadingPane
                  onClose={handleAgentClose}
                  isLoading={agentView === 'loading'}
                  showReport={agentView === 'report' || agentView === 'closing'}
                  closing={agentView === 'closing'}
                  reportContent={
                    <AgentReportPane
                      embedded
                      closing={agentView === 'closing'}
                      onClose={handleAgentClose}
                      onSignOff={handleWrapUpPass}
                      onYoyToggle={setYoyExpanded}
                      onMarkReviewed={handlePhase2MarkReviewed}
                      reviewedFields={reviewedFields}
                      initialSubView={agentSubView}
                      onSubViewChange={(subView) => {
                        setAgentSubView(subView)
                        // Auto-select the issue field when detail pane opens
                        if (subView === 'yoyDetail') {
                          setSelectedField('wages')
                        } else {
                          setSelectedField(null)
                        }
                      }}
                      onViewW2={(fromSubView) => {
                        // Keep agentSubView as-is (yoyDetail) so orange highlight persists in doc panel
                        // Only update if explicitly provided and different
                        if (fromSubView) setAgentSubView(fromSubView)
                        setFromAgent(true)
                        setActiveIssueField('wages')
                        setSelectedField('wages')
                        // Preserve wages selection so highlight carries through to document panel
                        handleAgentClose(true)
                        setActiveTopTab('w2s')
                      }}
                      onNavigateToTab={(tab, subTab, field, questionnaireResponseId, focus) => {
                        // Summary-only CTAs (e.g. NIIT “Summary — investment lines”):
                        // switch to Summary, highlight the CY line, scroll it into view —
                        // do not open Sources on a stale tab.
                        if (!tab && field) {
                          setSelectedField(field)
                          setActiveIssueField(field)
                          setQuestionnaireHighlightId(null)
                          setOutputFormId('summary')
                          setShow1040(true)
                          const rowKey = get1040HighlightField(field) ?? field
                          requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                              const row = document.querySelector(
                                `[data-field-row="${rowKey}"]`,
                              ) as HTMLElement | null
                              row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                            })
                          })
                          return
                        }
                        if (tab) {
                          setActiveTopTab(tab)
                          if (subTab) setActiveSubTab(subTab)
                        }
                        // Prefer field-driven payer navigation (DIV / INT peel tabs)
                        if (field) {
                          const nav = navigationForDetailField(field)
                          if (nav?.divPayer) setActiveDivPayer(nav.divPayer)
                          if (nav?.intPayer) setActiveIntPayer(nav.intPayer)
                          if (nav?.tab && !tab) setActiveTopTab(nav.tab)
                        }
                        if (tab === 'questionnaire') {
                          setQuestionnaireHighlightId(questionnaireResponseId ?? null)
                          setSelectedField(null)
                          setActiveIssueField(null)
                        } else if (focus === 'preview') {
                          // Review source: open document preview; light/no Details highlight
                          setSelectedField(null)
                          setActiveIssueField(null)
                          setQuestionnaireHighlightId(null)
                          setPreviewHeight(58)
                        } else if (field) {
                          // Go to input: focus/highlight Details field and give it room
                          setSelectedField(field)
                          setActiveIssueField(field)
                          setQuestionnaireHighlightId(null)
                          setPreviewHeight(22)
                        } else if (!tab) {
                          setSelectedField(null)
                          setActiveIssueField(null)
                        }
                        setFromAgent(true)
                        ensureSourcePanelVisible()
                        handleAgentClose(true)
                      }}
                      onHighlightField={(field, issueKey) => {
                        setSelectedField(field)
                        setActiveIssueField(field)
                        setActiveDiagnosticKey(issueKey ?? null)
                      }}
                      onDiagnosticFocus={(issueKey) => {
                        setActiveDiagnosticKey(issueKey)
                        if (!issueKey) {
                          setActiveIssueField(null)
                        }
                      }}
                      fieldValues={{ ...fieldValues, withholding: totalWithholding }}
                      liveTotals={liveTotals}
                      amounts={amounts}
                      onOpenForm={(label) => {
                        const formId = resolveOutputFormFromAction(label)
                        if (formId) {
                          setOutputFormId(formId)
                          setShow1040(true)
                        }
                      }}
                      onFieldValueChange={(key, value) => {
                        if (key === 'withholding' && typeof value === 'number') {
                          updateField('withholding', { techCircle: value })
                        } else {
                          updateField(key as keyof typeof fieldValues, value as number)
                        }
                      }}
                    />
                  }
                />
              )}

              {rightPanelMode === 'comments' && (
                <NotesPane
                  notes={notes}
                  onAdd={(text) => handleAddNote(text)}
                  onEdit={handleEditNote}
                  onResolve={handleResolveNote}
                  onReply={handleReplyNote}
                  focusNoteId={focusNoteId}
                  onClose={handleCloseNotes}
                  closing={panelClosing}
                />
              )}

              {rightPanelMode === 'summary' && handoffSnapshot && (
                <HandoffSummary
                  variant="drawer"
                  snapshot={handoffSnapshot}
                  checklist={reviewChecklist}
                  milestoneState={milestoneState}
                  singlePersonMode={singlePersonMode}
                  showChecklist={showChecklist}
                  onToggleChecklistItem={setMilestoneDeclaration}
                  signOffReady={signOffReady}
                  signOffBlockerText={signOffBlockerMessage}
                  outstandingOpenCount={outstandingOpenCount}
                  manualChecklistItems={manualChecklistItems}
                  reviewPass={reviewPass}
                  isPreparer={reviewRole === 'preparer'}
                  amounts={amounts}
                  briefEnterAnim={summaryBriefEnterAnim}
                  closing={panelClosing}
                  onClose={handleCloseSummaryPanel}
                  onContinue={handleCloseSummaryPanel}
                  onJump={handleHandoffJump}
                  onFinishAndFile={handlePreviewFinishAndFile}
                  onPassToReviewer={handleConfirmHandoffSend}
                  onOpenAsReviewer={
                    summaryMode === 'awaiting-reviewer'
                      ? handleSwitchToReviewerRole
                      : handleBeginPass2Review
                  }
                  importsPending={reviewRole === 'preparer' && !importsStarted && reviewPass === 1}
                  onReviewImports={startReviewingImports}
                />
              )}
            </div>
      </div>
    </div>
  )
}
