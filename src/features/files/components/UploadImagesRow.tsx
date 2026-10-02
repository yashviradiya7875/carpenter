import { Mark } from '../../../shared/components/Mark'

export function UploadImagesRow({ onClick, isUploading }: { onClick: () => void; isUploading: boolean }) {
  return (
    <div className="files-upload-row">
      <button type="button" onClick={onClick} disabled={isUploading}>
        <span className="files-upload-row-icon"><Mark name="upload" /></span>
        <span><strong>{isUploading ? 'Uploading images…' : 'Upload images'}</strong><small>Choose images or drag them into this folder</small></span>
      </button>
    </div>
  )
}
