import type { Ref } from 'react'
import { Mark } from './DashboardIcon'
import { UPLOAD_TYPES, type UploadType } from '../dashboardTypes'

type UploadOptionsDialogProps = {
  selectedUploadType: UploadType | null
  dialogRef: Ref<HTMLElement>
  onClose: () => void
  onSelect: (type: UploadType) => void
}

export function UploadOptionsDialog({ selectedUploadType, dialogRef, onClose, onSelect }: UploadOptionsDialogProps) {
  return (
    <div className="upload-options-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section
        className="upload-options-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-options-title"
        ref={dialogRef}
      >
        <header className="upload-options-header">
          <div>
            <span className="upload-options-kicker">COMMON WORKSPACE</span>
            <h2 id="upload-options-title">Choose an upload type</h2>
            <p>Select a workflow to continue.</p>
          </div>
          <button
            className="upload-options-close"
            type="button"
            aria-label="Close upload options"
            onClick={onClose}
          >
            <Mark name="close" />
          </button>
        </header>
        <div className="upload-option-list">
          {UPLOAD_TYPES.map((option) => (
            <button
              className={`upload-option ${selectedUploadType === option.id ? 'is-selected' : ''}`}
              type="button"
              key={option.id}
              data-upload-option
              aria-pressed={selectedUploadType === option.id}
              onClick={() => onSelect(option.id)}
            >
              <span className="upload-option-icon"><Mark name={option.icon} /></span>
              <span className="upload-option-copy"><strong>{option.title}</strong><small>{option.description}</small></span>
              <Mark name="arrow" />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}