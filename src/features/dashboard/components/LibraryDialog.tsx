import { useState } from 'react'
import { Alert, Button, ConfirmDialog, cx, Dialog, EmptyState, Icon, Menu, MenuItem, Skeleton, SkeletonGroup, TextInput } from '../../../shared/ui'
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
 * Picks a laminate from the library: a compact list of collections beside the laminates of
 * the open one. Click a laminate to select it, double-click to use it straight away.
 * Browsing only; collections are created and filled in Files › Library.
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

  const requestDelete = (target: DeletionTarget) => {
    setDeletionTarget(target)
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

  const isDeleting = deletionTarget?.type === 'product'
    ? deletingProductId === deletionTarget.item.id
    : deletionTarget?.type === 'collection' && deletingCollectionId === deletionTarget.item.id
  const isBusy = Boolean(deletingProductId || deletingCollectionId)
  const selectedProduct = displayedProducts.find((product) => product.id === selectedProductId)
  const isFirstLoad = isLoading && !collections.length

  // Laminates that are still loading: the tile's own frame, eight to a first screen.
  const productSkeleton = (
    <SkeletonGroup label="Loading laminates…" className="library-grid">
      {Array.from({ length: 8 }, (_, index) => (
        <div className="library-product is-skeleton" key={index}>
          <Skeleton className="library-skeleton-media" />
          <Skeleton variant="text" className="library-skeleton-name" />
        </div>
      ))}
    </SkeletonGroup>
  )

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title="Browse library"
        size="lg"
        className="library-dialog"
        footer={(
          <>
            <span className="library-footer-status" role="status">
              {selectedProduct ? `${selectedProduct.name} selected` : selectedProductId ? '1 laminate selected' : 'Select a laminate'}
            </span>
            <Button shape="pill" onClick={onClose}>Cancel</Button>
            <Button variant="primary" shape="pill" disabled={!selectedProductId} onClick={onConfirm}>Use laminate</Button>
          </>
        )}
      >
        <div className="library-toolbar">
          <TextInput
            className="library-search"
            type="search"
            startIcon="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search collections and laminates"
            aria-label="Search collections and laminates"
          />
        </div>

        {error && !deletionTarget ? <Alert tone="error" className="library-message">{error}</Alert> : null}
        {notice ? <Alert tone="success" className="library-message">{notice}</Alert> : null}

        {!isFirstLoad && !collections.length ? (
          <EmptyState className="library-empty" icon="layers" headingLevel={3} title="No collections yet" description="Collections in your library appear here." />
        ) : (
          <div className="library-browser">
            {isFirstLoad ? (
              <SkeletonGroup label="Loading collections…" className="library-collections">
                {[112, 88, 124, 96].map((width) => (
                  <div className="library-collection is-skeleton" key={width}><Skeleton variant="text" width={width} /></div>
                ))}
              </SkeletonGroup>
            ) : (
              <nav className="library-collections" aria-label="Collections">
                {displayedCollections.map((collection) => {
                  const isActive = activeCollection?.id === collection.id
                  return (
                    <div className={cx('library-collection', isActive && 'is-active')} key={collection.id}>
                      <button
                        className="library-collection-button"
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => onSelectCollection(collection.id)}
                      >
                        <span className="library-collection-name">{collection.name}</span>
                        <small aria-label={`${collection.productCount ?? 0} laminates`}>{collection.productCount ?? 0}</small>
                      </button>
                      <Menu
                        trigger={(props) => (
                          <Button
                            {...props}
                            variant="ghost"
                            size="xs"
                            iconOnly
                            icon="more"
                            className="library-collection-menu"
                            aria-label={`More actions for ${collection.name}`}
                          />
                        )}
                      >
                        <MenuItem tone="danger" icon="trash" onSelect={() => requestDelete({ type: 'collection', item: collection })}>
                          Delete collection
                        </MenuItem>
                      </Menu>
                    </div>
                  )
                })}
                {!displayedCollections.length ? <p className="library-collections-empty">No matching collections</p> : null}
              </nav>
            )}

            <section className="library-products" aria-label={activeCollection ? `${activeCollection.name} laminates` : 'Laminates'}>
              {/* Opening a collection keeps the list of collections and loads only its laminates. */}
              {isLoading ? productSkeleton : !activeCollection ? (
                <EmptyState compact icon="folder" headingLevel={3} title="No collection selected" description="Choose a collection to browse its laminates." />
              ) : displayedProducts.length ? (
                <div className="library-grid app-enter" key={activeCollection.id}>
                  {displayedProducts.map((product) => {
                    const isSelected = selectedProductId === product.id
                    const imageUrl = product.thumbUrl || product.coverThumbUrl || product.imageUrl
                    return (
                      <article className="library-product-card" key={product.id}>
                        <button
                          className={cx('library-product', isSelected && 'is-selected')}
                          type="button"
                          aria-pressed={isSelected}
                          title={product.name}
                          onClick={() => onSelectProduct(product.id)}
                          onDoubleClick={onConfirm}
                          disabled={isBusy}
                        >
                          <span className="library-product-media">
                            {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : <Icon name="image" />}
                            {isSelected ? <span className="app-check-badge library-product-check"><Icon name="check" /></span> : null}
                          </span>
                          <span className="library-product-name">{product.name}</span>
                        </button>
                        <Button
                          variant="ghost"
                          size="xs"
                          iconOnly
                          icon="trash"
                          className="library-product-delete"
                          aria-label={`Delete ${product.name}`}
                          tooltip="Delete"
                          disabled={isBusy}
                          onClick={() => requestDelete({ type: 'product', item: product })}
                        />
                      </article>
                    )
                  })}
                </div>
              ) : search.trim() ? (
                <EmptyState compact icon="search" headingLevel={3} title="No matching laminates" description="Try another search." />
              ) : (
                <EmptyState compact icon="image" headingLevel={3} title="No laminates yet" description="Laminates added to this collection appear here." />
              )}
            </section>
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
