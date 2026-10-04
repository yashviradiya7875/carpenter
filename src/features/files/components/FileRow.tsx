import type { ReactNode } from 'react'
import { Mark } from '../../../shared/components/Mark'
import { Button, Menu, Skeleton, type IconName } from '../../../shared/ui'
import { formatDate } from '../filesUtils'

export type FileRowProps = {
  name: string
  /** Folders (and collections) open in place; files open their image. */
  kind: 'file' | 'folder'
  /** Icon shown when there is no image; defaults to the kind's. */
  icon?: IconName
  imageUrl?: string
  /** Small line under the name. */
  detail?: string
  updatedAt?: string
  /** Third column in list view, e.g. the user's access or a view count. */
  meta?: string
  isBusy?: boolean
  /** Left out when the item has nothing to open. */
  onOpen?: () => void
  /** Adds the favorite star. */
  onFavorite?: () => void
  isFavorite?: boolean
  /** `MenuItem`s for the row's actions menu; no menu when left out. */
  menu?: ReactNode
}

/** One item in a Files list: a folder, file, collection, laminate or link, with its actions. */
export function FileRow({ name, kind, icon, imageUrl, detail, updatedAt, meta, isBusy = false, onOpen, onFavorite, isFavorite = false, menu }: FileRowProps) {
  return (
    <article className="files-row">
      <button className="files-item-name" type="button" onClick={onOpen} disabled={!onOpen}>
        {imageUrl
          ? <img className="files-thumbnail" src={imageUrl} alt="" loading="lazy" />
          : <span className={`files-item-icon ${kind}`}><Mark name={icon ?? (kind === 'folder' ? 'folder' : 'image')} /></span>}
        <span><strong>{name}</strong>{detail ? <small>{detail}</small> : null}</span>
      </button>
      <span className="files-updated">{formatDate(updatedAt) || '—'}</span>
      <span className="files-role">{meta ?? ''}</span>
      {/* Left out entirely when the row has no actions, so the grid views don't show an empty box. */}
      {onFavorite || menu ? (
        <div className="files-row-actions">
          {onFavorite ? (
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
          ) : null}
          {menu ? (
            <Menu
              trigger={(props) => (
                <Button {...props} variant="ghost" size="sm" iconOnly icon="more" className="files-row-menu-trigger" aria-label={`Actions for ${name}`} loading={isBusy && !onFavorite} />
              )}
            >
              {menu}
            </Menu>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

// Name lengths that vary from row to row, so a loading list doesn't look like a table of bars.
const SKELETON_NAME_WIDTHS = [168, 124, 196, 142]

/**
 * A row that is still loading. It uses the row's own layout classes, so it has the right
 * size in the list view and in both grid views.
 */
export function FileRowSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className="files-row is-skeleton">
      <span className="files-item-name">
        <span className="files-item-icon"><Skeleton className="files-skeleton-thumb" /></span>
        <span>
          <Skeleton variant="text" width={SKELETON_NAME_WIDTHS[index % SKELETON_NAME_WIDTHS.length]} />
          <Skeleton variant="text" width={72} className="files-skeleton-detail" />
        </span>
      </span>
      <span className="files-updated"><Skeleton variant="text" width={76} /></span>
      <span className="files-role"><Skeleton variant="text" width={44} /></span>
    </div>
  )
}
