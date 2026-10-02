import { useState } from 'react'
import { Alert, Button, ConfirmDialog, Dialog, EmptyState, LoadingState, Menu, MenuItem, TextInput } from '../../../shared/ui'
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
  onCreateCollection: () => void
  onUploadImages: () => void
  onUploadFolder: () => void
  onSelectProduct: (productId: string) => void
  onDeleteProduct: (product: Product) => Promise<boolean>
  onDeleteCollection: (collection: Collection) => Promise<boolean>
  onConfirm: () => void
}

type DeletionTarget =
  | { type: 'product'; item: Product }
  | { type: 'collection'; item: Collection }

const UPLOAD_NAMING_HINT = 'Upload images — elegant_black_x.png and elegant_black_y.png become one laminate with two faces. Upload a folder and its name becomes the laminate.'

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
  onCreateCollection,
  onUploadImages,
  onUploadFolder,
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

  const isDeleting = deletionTarget?.type === 'product'
    ? deletingProductId === deletionTarget.item.id
    : deletionTarget?.type === 'collection' && deletingCollectionId === deletionTarget.item.id

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={activeCollection?.name ?? 'Laminate collections'}
        description={activeCollection ? `${activeCollection.productCount ?? 0} laminates` : `${collections.length} collections`}
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

          <div className="library-toolbar-group">
            <Button shape="pill" icon="plus" onClick={onCreateCollection}>Collection</Button>
          </div>

          <div className="library-upload-actions">
            <Button variant="primary" shape="pill" icon="upload" className="library-upload-button" onClick={onUploadImages}>
              Upload images
            </Button>
            <Button shape="pill" icon="folder" className="library-upload-button" onClick={onUploadFolder}>
              Upload folder
            </Button>
          </div>
        </div>

        {error && !deletionTarget ? <Alert tone="error" className="library-message">{error}</Alert> : null}
        {notice ? <Alert tone="success" className="library-message">{notice}</Alert> : null}
        {isLoading ? (
          <LoadingState label="Loading materials…" className="library-loading" />
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
                      {displayedProducts.length ? (
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
                        <EmptyState
                          compact
                          icon="image"
                          headingLevel={3}
                          title="No laminates yet"
                          description={UPLOAD_NAMING_HINT}
                          actions={<Button variant="primary" shape="pill" icon="upload" onClick={onUploadImages}>Upload images</Button>}
                        />
                      )}
                    </>
                  ) : (
                    <EmptyState compact icon="folder" headingLevel={3} title="No collection selected" description="Choose a collection to browse its laminates." />
                  )}
                </section>
              </div>
            ) : (
              <EmptyState
                icon="layers"
                headingLevel={3}
                title="No collections yet"
                description={`Create a collection to start your library. ${UPLOAD_NAMING_HINT}`}
                actions={<Button variant="primary" shape="pill" icon="plus" onClick={onCreateCollection}>New collection</Button>}
              />
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
