import { Dialog } from '../../../shared/ui'
import { Mark } from '../../../shared/components/Mark'
import { UPLOAD_TYPES, type UploadType } from '../dashboardTypes'

type UploadOptionsDialogProps = {
  open: boolean
  selectedUploadType: UploadType | null
  onClose: () => void
  onSelect: (type: UploadType) => void
}

export function UploadOptionsDialog({ open, selectedUploadType, onClose, onSelect }: UploadOptionsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Choose an upload type"
      description="Select a workflow to continue."
      size="sm"
    >
      <div className="upload-option-list">
        {UPLOAD_TYPES.map((option) => (
          <button
            className={`upload-option ${selectedUploadType === option.id ? 'is-selected' : ''}`}
            type="button"
            key={option.id}
            aria-pressed={selectedUploadType === option.id}
            onClick={() => onSelect(option.id)}
          >
            <span className="upload-option-icon"><Mark name={option.icon} /></span>
            <span className="upload-option-copy"><strong>{option.title}</strong><small>{option.description}</small></span>
            <Mark name="arrow" />
          </button>
        ))}
      </div>
    </Dialog>
  )
}
