import SegmentedButton from '@ids-ts/segmented-button'
import '@ids-ts/segmented-button/dist/main.css'
import styles from './DemoRoleBar.module.css'

export type DemoRole = 'preparer' | 'reviewer'

interface DemoRoleBarProps {
  role: DemoRole
  onRoleChange: (role: DemoRole) => void
}

export default function DemoRoleBar({ role, onRoleChange }: DemoRoleBarProps) {
  return (
    <div className={styles.bar} role="region" aria-label="Prototype demo controls">
      <span className={styles.label}>Prototype demo</span>
      <div className={styles.controls}>
        <div className={styles.segmented}>
          <SegmentedButton
            ariaLabel="Demo role"
            buttonType="mini"
            buttonInfos={[
              {
                label: 'Preparer',
                selected: role === 'preparer',
                onClick: () => onRoleChange('preparer'),
              },
              {
                label: 'Reviewer',
                selected: role === 'reviewer',
                onClick: () => onRoleChange('reviewer'),
              },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
