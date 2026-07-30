import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SmartReturnHeader from './SmartReturnHeader'
import SmartReturnDocumentHub from './SmartReturnDocumentHub'
import handoffStyles from '../styles/data-review/HandoffSummary.module.css'
import styles from '../styles/SmartReturnPage.module.css'

const REVIEW_RETURN_PATH = '/data-review?entry=review-return&role=reviewer&startReview=true'

export default function SmartReturnPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const roleParam = searchParams.get('role')
  const [reviewRole, setReviewRole] = useState<'preparer' | 'reviewer'>(() =>
    roleParam === 'reviewer' ? 'reviewer' : 'preparer',
  )

  useEffect(() => {
    const el = document.documentElement
    const prevTheme = el.getAttribute('data-theme')
    el.setAttribute('data-theme', 'intuit')
    el.style.setProperty('--color-action-standard', '#205ea3')
    el.style.setProperty('--color-action-standard-hover', '#174d87')
    el.style.setProperty('--color-action-standard-active', '#174d87')
    return () => {
      if (prevTheme) el.setAttribute('data-theme', prevTheme)
      el.style.removeProperty('--color-action-standard')
      el.style.removeProperty('--color-action-standard-hover')
      el.style.removeProperty('--color-action-standard-active')
    }
  }, [])

  const handleSwitchRole = (role: 'preparer' | 'reviewer') => {
    setReviewRole(role)
    setSearchParams(role === 'reviewer' ? { role: 'reviewer' } : {}, { replace: true })
  }

  const handleReviewReturn = () => {
    const base = `${window.location.origin}${window.location.pathname}`
    window.open(`${base}#${REVIEW_RETURN_PATH}`, '_blank', 'noopener,noreferrer')
  }

  const isReviewer = reviewRole === 'reviewer'

  return (
    <div className={styles.page} data-theme="intuit">
      <div className={styles.rightSide}>
        <SmartReturnHeader
          activeTab="smartreturn"
          showReviewReturn={isReviewer}
          onReviewReturn={handleReviewReturn}
          demoRole={reviewRole}
          onDemoRoleChange={handleSwitchRole}
        />

        <div className={handoffStyles.passBar} role="status">
          <span>SmartReturn landing</span>
        </div>

        <SmartReturnDocumentHub readOnly={isReviewer} />
      </div>
    </div>
  )
}
