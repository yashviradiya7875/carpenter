import { useEffect, useState } from 'react'
import { Mark } from '../../shared/components/Mark'
import { buttonClasses, EmptyState, LoadingState } from '../../shared/ui'
import { getSharedDriveResource, getString, type DriveResourceType } from './filesService'
import { errorMessage } from './filesUtils'
import './FilesPage.css'

/** Public page for a Files share link (`/share/<token>`); no sign-in required. */
export function SharedResourcePage({ token }: { token: string }) {
  const [resource, setResource] = useState<unknown>(null)
  const [resourceType, setResourceType] = useState<DriveResourceType | null>(null)
  const [role, setRole] = useState('viewer')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    getSharedDriveResource(token, { signal: controller.signal })
      .then((result) => {
        setResource(result.resource)
        setResourceType(result.resourceType === 'folder' ? 'folder' : 'file')
        setRole(result.role ?? 'viewer')
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError))
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false) })
    return () => controller.abort()
  }, [token])

  const name = getString(resource, 'name', 'title', 'fileName') ?? 'Shared resource'
  const imageUrl = getString(resource, 'imageUrl', 'url', 'thumbnailUrl', 'thumbUrl')

  useEffect(() => {
    document.title = `${isLoading ? 'Shared item' : error ? 'Link unavailable' : name} · Carpenter Pro`
  }, [error, isLoading, name])

  return (
    <main className="files-page shared-files-page app-enter-fade">
      <section className="shared-resource">
        {isLoading ? <LoadingState label="Loading shared item…" /> : error ? (
          <EmptyState
            icon="alert"
            headingLevel={1}
            title="This link isn’t available"
            description={error}
            actions={<a className={buttonClasses({ variant: 'primary', shape: 'pill' })} href="/">Go to Carpenter Pro</a>}
          />
        ) : (
          <>
            <span className="files-modal-icon"><Mark name={resourceType === 'folder' ? 'folder' : 'image'} /></span>
            <span className="files-kicker">SHARED {resourceType?.toUpperCase()} · {role.toUpperCase()}</span>
            <h1>{name}</h1>
            {imageUrl ? <img src={imageUrl} alt={name} /> : <p>This shared folder is available through your organization’s Files workspace.</p>}
          </>
        )}
      </section>
    </main>
  )
}
