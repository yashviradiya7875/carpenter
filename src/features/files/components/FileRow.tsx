import { Mark } from '../../../shared/components/Mark'
import { Button, Menu, MenuItem, MenuSeparator } from '../../../shared/ui'
import { canEdit } from '../filesPermissions'
import type { DriveResourceType } from '../filesService'
import { formatDate } from '../filesUtils'

export type FileRowProps = {
  name: string
  kind: DriveResourceType
  updatedAt?: string
  role?: string
  isFavorite: boolean
  imageUrl?: string
  detail?: string
  isBusy: boolean
  onOpen: () => void
  onFavorite: () => void
  onRename: () => void
  onMove: () => void
  onShare: () => void
  onDelete?: () => void
  canManage: boolean
}

export function FileRow({ name, kind, updatedAt, role, isFavorite, imageUrl, detail, isBusy, onOpen, onFavorite, onRename, onMove, onShare, onDelete, canManage: canShare }: FileRowProps) {
  const mayEdit = canEdit(role)
  return (
    <article className="files-row">
      <button className="files-item-name" type="button" onClick={onOpen} disabled={kind === 'file' && !imageUrl}>
        {imageUrl ? <img className="files-thumbnail" src={imageUrl} alt="" /> : <span className={`files-item-icon ${kind}`}><Mark name={kind === 'folder' ? 'folder' : 'image'} /></span>}
        <span><strong>{name}</strong>{detail ? <small>{detail}</small> : null}</span>
      </button>
      <span className="files-updated">{formatDate(updatedAt) || '—'}</span>
      <span className="files-role">{role ?? 'Access'}</span>
      <div className="files-row-actions">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon="star"
          className={`favorite-button ${isFavorite ? 'is-favorite' : ''}`}
          onClick={onFavorite}
          aria-label={isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
          loading={isBusy}
        />
        {mayEdit || canShare ? (
          <Menu
            trigger={(props) => (
              <Button {...props} variant="ghost" size="sm" iconOnly icon="more" className="files-row-menu-trigger" aria-label={`Actions for ${name}`} />
            )}
          >
            {mayEdit ? (
              <>
                <MenuItem onSelect={onRename}>Rename</MenuItem>
                <MenuItem onSelect={onMove}>Move</MenuItem>
              </>
            ) : null}
            {canShare ? <MenuItem onSelect={onShare}>Sharing</MenuItem> : null}
            {kind === 'folder' && canShare && onDelete ? (
              <>
                <MenuSeparator />
                <MenuItem tone="danger" icon="trash" onSelect={onDelete}>Delete folder</MenuItem>
              </>
            ) : null}
          </Menu>
        ) : null}
      </div>
    </article>
  )
}
