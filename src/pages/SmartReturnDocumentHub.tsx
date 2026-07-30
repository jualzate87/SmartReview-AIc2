import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CloudUpload, Upload, OverflowWeb, ChevronDown, ChevronUp, Download, Copy,
} from '@design-systems/icons'
import { Button } from '@ids-ts/button'
import '@ids-ts/button/dist/main.css'
import { IconControl } from '@ids-ts/icon-control'
import '@ids-ts/icon-control/dist/main.css'
import { Checkbox } from '@ids-ts/checkbox'
import '@ids-ts/checkbox/dist/main.css'
import sparklesIcon from '../assets/icons/sparkles.svg'
import inventoryIcon from '../assets/icons/inventory-stock-report.svg'
import readyToImportIcon from '../assets/icons/ready-to-import.svg'
import sidebarTaxOrganizerIcon from '../assets/icons/sidebar-tax-organizer.svg'
import sidebarImportHubIcon from '../assets/icons/sidebar-import-hub.svg'
import sidebarDocumentsListIcon from '../assets/icons/sidebar-documents-list.svg'
import sidebarClientActivityIcon from '../assets/icons/sidebar-client-activity.svg'
import sidebarFlaggedItemsIcon from '../assets/icons/sidebar-flagged-items.svg'
import sidebarCommentsIcon from '../assets/icons/sidebar-comments.svg'
import { SOURCE_DOCUMENTS } from '../data/sourceDocuments'
import styles from '../styles/OpenReturnPage.module.css'

type HubStep = 'hub' | 'importing'

const CHECKLIST_ITEMS = SOURCE_DOCUMENTS.map(doc => ({
  id: doc.id,
  type: doc.formType,
  label: doc.label,
}))

const RECEIVED_DOCS = SOURCE_DOCUMENTS.map(doc => ({
  id: doc.id,
  name: doc.label,
  status: 'Ready to import',
  type: doc.formType,
  date: 'Jun 27',
}))

interface SmartReturnDocumentHubProps {
  /** Reviewer sees checklist/docs but cannot upload or import */
  readOnly?: boolean
}

export default function SmartReturnDocumentHub({ readOnly = false }: SmartReturnDocumentHubProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState<HubStep>('hub')
  const [progress, setProgress] = useState(2)
  const [checklistOpen, setChecklistOpen] = useState(true)
  const [lastYearOpen, setLastYearOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (step !== 'importing') return
    setProgress(2)
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval)
          timerRef.current = setTimeout(() => {
            navigate('/import-confirmation')
          }, 400)
          return 100
        }
        return Math.min(100, p + 2)
      })
    }, 40)
    return () => {
      clearInterval(interval)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [step, navigate])

  const handleUploadClick = () => {
    if (readOnly) return
    fileInputRef.current?.click()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items?.length) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0
  }

  const startImport = () => {
    if (readOnly) return
    setProgress(2)
    setStep('importing')
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={() => {}}
      />

      <div className={styles.body}>
        <div className={styles.main}>
          {step === 'importing' && (
            <div className={styles.loadingState}>
              <div className={styles.loadingIllustration}>
                <img src={inventoryIcon} alt="" className={styles.loadingIcon} />
              </div>
              <p className={styles.loadingText}>Importing documents to SmartReturn…</p>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {step === 'hub' && (
            <div className={styles.contentArea}>
              <div className={styles.pageHeading}>
                <h1 className={styles.pageTitle}>
                  {readOnly ? "Jordan's documents are ready" : "Let's get Jordan's documents"}
                </h1>
                <p className={styles.pageSubtitle}>
                  {readOnly
                    ? 'Review the received documents below. When you\'re ready, select Review return in the header to begin your review.'
                    : 'Gather your client\'s documents from the checklist, and import them all at once.'}
                </p>
              </div>

              {!readOnly && (
                <div
                  className={`${styles.uploadZone} ${isDragging ? styles.uploadZoneDragging : ''}`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <p className={styles.uploadZoneLabel}>Drop files here or click to upload</p>
                  <div className={styles.uploadCards}>
                    <button type="button" className={styles.uploadCard} onClick={handleUploadClick}>
                      <Upload size="large" className={styles.uploadCardIcon} />
                      <span className={styles.uploadCardLabel}>Upload from this device</span>
                    </button>
                    <button type="button" className={styles.uploadCard}>
                      <CloudUpload size="large" className={styles.uploadCardIcon} />
                      <span className={styles.uploadCardLabel}>Get from cloud apps</span>
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.checklist}>
                <button
                  type="button"
                  className={styles.checklistHeader}
                  onClick={() => setChecklistOpen(o => !o)}
                >
                  <div className={styles.checklistHeaderLeft}>
                    <img src={sparklesIcon} alt="" className={styles.checklistHeaderIcon} />
                    <span className={styles.checklistHeaderTitle}>Tax year 2025 document checklist</span>
                    <span className={styles.sentBadgePill}>SENT</span>
                  </div>
                  <div className={styles.checklistHeaderRight}>
                    <Button priority="tertiary" size="small">
                      {checklistOpen ? 'Show less' : 'Show more'}
                      {checklistOpen ? <ChevronUp size="small" /> : <ChevronDown size="small" />}
                    </Button>
                  </div>
                </button>

                {checklistOpen && (
                  <>
                    <div className={styles.checklistTabs}>
                      <span className={`${styles.checklistTab} ${styles.checklistTabActive}`}>
                        Received <span className={styles.tabBadge}>{RECEIVED_DOCS.length}</span>
                      </span>
                      <span className={styles.checklistTab}>
                        Needed <span className={styles.tabBadge}>0</span>
                      </span>
                    </div>
                    <div className={styles.checklistBody}>
                      <div className={styles.tableScroll}>
                        <div className={styles.tableHeader}>
                          <div className={styles.tableCheckAll}>
                            <Checkbox defaultChecked size="small" onChange={() => {}} disabled={readOnly} />
                          </div>
                          <span className={styles.tableColName}>Name ↕</span>
                          <span className={styles.tableColStatus}>Import status</span>
                          <span className={styles.tableColType}>Type ↕</span>
                          <span className={styles.tableColDate}>Updated ↕</span>
                          <span className={styles.tableColMenu} />
                        </div>
                        <div className={styles.tableRows}>
                          {RECEIVED_DOCS.map(doc => (
                            <div key={doc.id} className={styles.tableRow}>
                              <div className={styles.tableCheckAll}>
                                <Checkbox defaultChecked size="small" onChange={() => {}} disabled={readOnly} />
                              </div>
                              <span className={styles.tableDocName}>{doc.name}</span>
                              <div className={styles.tableStatus}>
                                <img src={readyToImportIcon} alt="" className={styles.statusIcon} />
                                <span className={styles.statusText}>{doc.status}</span>
                              </div>
                              <div className={styles.tableType}>
                                <span className={styles.typeText}>{doc.type}</span>
                                <ChevronDown size="xsmall" />
                              </div>
                              <span className={styles.tableDate}>{doc.date}</span>
                              <IconControl aria-label="More options" size="small" shape="square">
                                <OverflowWeb />
                              </IconControl>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className={styles.tableFooter}>
                        <div className={styles.tableFooterLeft}>
                          <IconControl aria-label="Copy" size="small" shape="square"><Copy /></IconControl>
                          <IconControl aria-label="Download" size="small" shape="square"><Download /></IconControl>
                        </div>
                        <div className={styles.tableFooterRight}>
                          {!readOnly && (
                            <>
                              <Button priority="tertiary" onClick={() => {}}>Edit request</Button>
                              <Button priority="primary" onClick={startImport}>
                                Import ready documents
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className={styles.lastYearSection}>
                <button
                  type="button"
                  className={styles.lastYearHeader}
                  onClick={() => setLastYearOpen(o => !o)}
                >
                  <span className={styles.lastYearTitle}>Last years&apos; documents</span>
                  <div className={styles.lastYearRight}>
                    <span className={styles.showToggle}>{lastYearOpen ? 'Show less' : 'Show more'}</span>
                    <ChevronDown size="small" />
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.sidebar}>
          <div className={styles.sidebarItem}>
            <img src={sidebarTaxOrganizerIcon} alt="" className={styles.sidebarIcon} />
            <span>Tax<br />Organizer</span>
          </div>
          <div className={styles.sidebarItem}>
            <img src={sidebarImportHubIcon} alt="" className={styles.sidebarIcon} />
            <span>Import<br />hub</span>
          </div>
          <div className={styles.sidebarItem}>
            <img src={sidebarDocumentsListIcon} alt="" className={styles.sidebarIcon} />
            <span>Documents<br />list</span>
          </div>
          <div className={styles.sidebarItem}>
            <img src={sidebarClientActivityIcon} alt="" className={styles.sidebarIcon} />
            <span>Client<br />activity</span>
          </div>
          <div className={styles.sidebarDivider} />
          <div className={styles.sidebarItem}>
            <img src={sidebarFlaggedItemsIcon} alt="" className={styles.sidebarIcon} />
            <span>Flagged<br />items</span>
          </div>
          <div className={styles.sidebarItem}>
            <img src={sidebarCommentsIcon} alt="" className={styles.sidebarIcon} />
            <span>Comments</span>
          </div>
        </div>
      </div>
    </>
  )
}
