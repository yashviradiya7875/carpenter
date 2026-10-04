import { useState } from 'react'
import { Alert, Button, ConfirmDialog, Dialog, EmptyState, Menu, MenuItem, Skeleton, SkeletonGroup, TextInput } from '../../../shared/ui'
import { Mark } from '../../../shared/components/Mark'
import type { Collection, Product } from '../dashboardTypes'

type LibraryDialogProps = {
  activeCollection: Collection | null
  collections: Collection[]
  displayedCollections: Collection[]
  displayedProducts: Product[]
  selectedProductId: string | null
  search: string
  error: string
  notice: string
  isLoading: boolean
  deletingProductId: string | null
  deletingCollectionId: string | null
  onClose: () => void
  onSearchChange: (search: string) => void
  onSelectCollection: (collectionId: string) => void
  onSelectProduct: (productId: string) => void
  onDeleteProduct: (product: Product) => Promise<boolean>
  onDeleteCollection: (collection: Collection) => Promise<boolean>
  onConfirm: () => void
}

type DeletionTarget =
  | { type: 'product'; item: Product }
  | { type: 'collection'; item: Collection }

/**
 * Picks a laminate from the library: collections on the left, the laminates of the open one
 * on the right. Browsing only; collections are created and filled in Files › Library.
 */
export function LibraryDialog({
  activeCollection,
  collections,
  displayedCollections,
  displayedProducts,
  selectedProductId,
  search,
  error,
  notice,
  isLoading,
  deletingProductId,
  deletingCollectionId,
  onClose,
  onSearchChange,
  onSelectCollection,
  onSelectProduct,
  onDeleteProduct,
  onDeleteCollection,
  onConfirm,
}: LibraryDialogProps) {
  const [deletionTarget, setDeletionTarget] = useState<DeletionTarget | null>(null)
  const [deleteAttempted, setDeleteAttempted] = useState(false)

  const requestDelete = (product: Product) => {
    setDeletionTarget({ type: 'product', item: product })
    setDeleteAttempted(false)
  }

  const requestDeleteCollection = (collection: Collection) => {
    setDeletionTarget({ type: 'collection', item: collection })
    setDeleteAttempted(false)
  }

  const confirmDelete = async () => {
    if (!deletionTarget) return
    setDeleteAttempted(true)
    const deleted = deletionTarget.type === 'product'
      ? await onDeleteProduct(deletionTarget.item)
      : await onDeleteCollection(deletionTarget.item)
    if (deleted) setDeletionTarget(null)
  }

  // Laminates that are still loading: the product card's own frame, six to a first screen.
  const productSkeleton = (
    <SkeletonGroup label="Loading laminates…" className="library-grid">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="library-product is-skeleton" key={index}>
          <Skeleton className="library-skeleton-image" />
          <Skeleton variant="text" width="68%" />
        </div>
      ))}
    </SkeletonGroup>
  )

  const isDeleting = deletionTarget?.type === 'product'
    ? deletingProductId === deletionTarget.item.id
    : deletionTarget?.type === 'collection' && deletingCollectionId === deletionTarget.item.id

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={activeCollection?.name ?? 'Laminate collections'}
        description={activeCollection
          ? `${activeCollection.productCount ?? 0} laminates`
          : isLoading && !collections.length ? 'Loading collections…' : `${collections.length} collections`}
        size="lg"
        className="library-dialog"
        footer={(
          <>
            <span className="library-footer-status" role="status">{selectedProductId ? '1 laminate selected' : 'Select one laminate'}</span>
            <Button shape="pill" onClick={onClose}>Cancel</Button>
            <Button variant="primary" shape="pill" disabled={!selectedProductId} onClick={onConfirm}>
              Use
            </Button>
          </>
        )}
      >
        <div className="library-toolbar">
          <TextInput
            className="library-search"
            size="lg"
            type="search"
            startIcon="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search laminates…"
            aria-label="Search laminates"
          />
        </div>

        {error && !deletionTarget ? <Alert tone="error" className="library-message">{error}</Alert> : null}
        {notice ? <Alert tone="success" className="library-message">{notice}</Alert> : null}
        {isLoading && !collections.length ? (
          // First load: nothing to show yet, so the whole browser is placeholders.
          <div className="library-body">
            <div className="library-browser">
              <SkeletonGroup label="Loading collections…" className="library-folders">
                <Skeleton variant="text" width={84} className="library-skeleton-title" />
                <div className="collection-list">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div className="collection-row is-skeleton" key={index}>
                      <Skeleton width={36} height={36} className="library-skeleton-mark" />
                      <span><Skeleton variant="text" width={[118, 92, 132, 104][index]} /><Skeleton variant="text" width={64} /></span>
                    </div>
                  ))}
                </div>
              </SkeletonGroup>
              <div className="library-folder-content">{productSkeleton}</div>
            </div>
          </div>
        ) : (
          <div className="library-body">
            {collections.length ? (
              <div className="library-browser">
                <aside className="library-folders" aria-label="Collections">
                  <h3 className="library-folders-title">Collections</h3>
                  <div className="collection-list">
                    {displayedCollections.map((collection) => (
                      <div className={`library-collection-item ${activeCollection?.id === collection.id ? 'is-active' : ''}`} key={collection.id}>
                        <button
                          className="collection-row"
                          type="button"
                          aria-current={activeCollection?.id === collection.id ? 'page' : undefined}
                          onClick={() => onSelectCollection(collection.id)}
                        >
                          <span className="collection-mark"><Mark name="folder" /></span>
                          <span><strong>{collection.name}</strong><small>{collection.productCount ?? 0} materials</small></span>
                        </button>
                        <div className="library-collection-actions">
                          <Menu
                            trigger={(props) => (
                              <Button
                                {...props}
                                variant="ghost"
                                size="sm"
                                iconOnly
                                icon="more"
                                className="library-collection-menu-trigger"
                                aria-label={`More actions for ${collection.name}`}
                              />
                            )}
                          >
                            <MenuItem tone="danger" icon="trash" onSelect={() => requestDeleteCollection(collection)}>
                              Delete collection
                            </MenuItem>
                          </Menu>
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>

                <section className="library-folder-content" aria-label={activeCollection ? `${activeCollection.name} products` : 'Collection products'}>
                  {activeCollection ? (
                    <>
                      <div className="library-folder-heading">
                        <Mark name="folder" />
                        <span><strong>{activeCollection.name}</strong><small>{activeCollection.productCount ?? 0} materials</small></span>
                      </div>
                      {/* Opening a collection keeps the list of collections and loads only its laminates. */}
                      {isLoading ? productSkeleton : displayedProducts.length ? (
                        <div className="library-grid app-enter">
                          {displayedProducts.map((product) => (
                            <article className="library-product-card" key={product.id}>
                              <button
                                className={`library-product ${selectedProductId === product.id ? 'is-selected' : ''}`}
                                type="button"
                                aria-pressed={selectedProductId === product.id}
                                onClick={() => onSelectProduct(product.id)}
                                disabled={Boolean(deletingProductId || deletingCollectionId)}
                              >
                                {product.thumbUrl || product.coverThumbUrl || product.imageUrl ? (
                                  <img src={product.thumbUrl || product.coverThumbUrl || product.imageUrl} alt="" />
                                ) : <span className="product-placeholder"><Mark name="image" /></span>}
                                <span className="library-product-name">{product.name}</span>
                              </button>
                              <Button
                                variant="destructive"
                                size="sm"
                                iconOnly
                                icon="trash"
                                className="library-product-delete"
                                aria-label={`Delete ${product.name}`}
                                title={`Delete ${product.name}`}
                                disabled={Boolean(deletingProductId || deletingCollectionId)}
                                onClick={() => requestDelete(product)}
                              />
                            </article>
                          ))}
                        </div>
                      ) : search.trim() ? (
                        <EmptyState compact icon="search" headingLevel={3} title="No matching laminates" description="Try another search." />
                      ) : (
                        <EmptyState compact icon="image" headingLevel={3} title="No laminates yet" description="Laminates added to this collection appear here." />
                      )}
                    </>
                  ) : (
                    <EmptyState compact icon="folder" headingLevel={3} title="No collection selected" description="Choose a collection to browse its laminates." />
                  )}
                </section>
              </div>
            ) : (
              <EmptyState icon="layers" headingLevel={3} title="No collections yet" description="Collections in your library appear here." />
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={deletionTarget !== null}
        tone="danger"
        title={deletionTarget ? `Delete ${deletionTarget.item.name}?` : ''}
        description={deletionTarget?.type === 'product'
          ? 'This removes the product and all of its uploaded image files from the collection. Its public page stays online.'
          : 'This permanently removes the collection and all products, faces, and uploaded files inside it.'}
        confirmLabel={deletionTarget ? `Delete ${deletionTarget.type}` : 'Delete'}
        loading={Boolean(isDeleting)}
        loadingLabel="Deleting…"
        error={deleteAttempted && error ? error : undefined}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeletionTarget(null)}
      />
    </>
  )
}
