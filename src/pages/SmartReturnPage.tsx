import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import SmartReturnHeader from './SmartReturnHeader'
import SmartReturnDocumentHub from './SmartReturnDocumentHub'
import handoffStyles from '../styles/data-review/HandoffSummary.module.css'
import styles from '../styles/SmartReturnPage.module.css'

export default function SmartReturnPage() {
  const navigate = useNavigate()
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
    navigate('/data-review?entry=review-return&role=reviewer&startReview=true')
  }

  const isReviewer = reviewRole === 'reviewer'

  return (
    <div className={styles.page} data-theme="intuit">
      <div className={styles.rightSide}>
        <SmartReturnHeader
          activeTab="smartreturn"
          showReviewReturn={isReviewer}
          onReviewReturn={handleReviewReturn}
        />

        <div className={handoffStyles.passBar} role="status">
          <span className={handoffStyles.passBarStrong}>
            {isReviewer ? 'Reviewer mode' : 'Preparer mode'}
          </span>
          <span>· SmartReturn landing</span>
          <span className={handoffStyles.roleSwitcher} role="group" aria-label="Demo role">
            <button
              type="button"
              className={`${handoffStyles.roleBtn} ${!isReviewer ? handoffStyles.roleBtnActive : ''}`}
              onClick={() => handleSwitchRole('preparer')}
            >
              Preparer
            </button>
            <button
              type="button"
              className={`${handoffStyles.roleBtn} ${isReviewer ? handoffStyles.roleBtnActive : ''}`}
              onClick={() => handleSwitchRole('reviewer')}
            >
              Reviewer
            </button>
          </span>
        </div>

        <SmartReturnDocumentHub readOnly={isReviewer} />
      </div>
    </div>
  )
}
