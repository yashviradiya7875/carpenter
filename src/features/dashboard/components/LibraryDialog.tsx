import { useState } from 'react'
import { Mark } from './DashboardIcon'
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

const EMPTY_PRODUCT_MESSAGE = 'Upload images — a filenam e like elegant_black_x.png and elegant_black_y.png becomes one laminate with two faces. Upload a folder and the folder name becomes the laminate.'
const EMPTY_COLLECTION_MESSAGE = 'Upload images — a filename like elegant_black_x.png and elegant_black_y.png becomes one laminate with two faces. Upload a folder and the folder name becomes the laminate.'

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
  const [openCollectionMenuId, setOpenCollectionMenuId] = useState<string | null>(null)
  const [deleteAttempted, setDeleteAttempted] = useState(false)

  const requestDelete = (product: Product) => {
    setDeletionTarget({ type: 'product', item: product })
    setOpenCollectionMenuId(null)
    setDeleteAttempted(false)
  }

  const requestDeleteCollection = (collection: Collection) => {
    setDeletionTarget({ type: 'collection', item: collection })
    setOpenCollectionMenuId(null)
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
    <div className="library-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="library-dialog" role="dialog" aria-modal="true" aria-labelledby="library-title">
        <header className="library-header">
          <div>
            <h2 id="library-title">{activeCollection?.name ?? 'Laminate collections'}</h2>
            <p>{activeCollection ? `${activeCollection.productCount ?? 0} laminates` : `${collections.length} collections`}</p>
          </div>
          <button className="library-close" type="button" aria-label="Close library" onClick={onClose}>
            <Mark name="close" />
          </button>
        </header>

        <div className="library-toolbar">
          <input
            className="library-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search laminates..."
            aria-label="Search laminates"
          />

          <div className="library-toolbar-group">
            <button className="library-create-button" type="button" onClick={onCreateCollection}>+ Collection</button>
          </div>

          <div className="library-upload-actions">
            <button className="library-upload-button primary" type="button" onClick={onUploadImages}>
              Upload images
            </button>
            <button className="library-upload-button secondary" type="button" onClick={onUploadFolder}>
              Upload folder
            </button>
          </div>
        </div>

        {error ? <p className="library-error" role="alert">{error}</p> : null}
        {notice ? <p className="library-notice" role="status">{notice}</p> : null}
        {isLoading ? (
          <div className="library-loading" role="status"><span className="loading-indicator" /> Loading materials…</div>
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
                          onClick={() => {
                            setOpenCollectionMenuId(null)
                            onSelectCollection(collection.id)
                          }}
                        >
                          <span className="collection-mark"><Mark name="folder" /></span>
                          <span><strong>{collection.name}</strong><small>{collection.productCount ?? 0} materials</small></span>
                        </button>
                        <div className="library-collection-actions">
                          <button
                            className="library-collection-menu-trigger"
                            type="button"
                            aria-label={`More actions for ${collection.name}`}
                            aria-haspopup="menu"
                            aria-expanded={openCollectionMenuId === collection.id}
                            onClick={() => setOpenCollectionMenuId((current) => current === collection.id ? null : collection.id)}
                          >
                            <Mark name="more" />
                          </button>
                          {openCollectionMenuId === collection.id ? (
                            <div className="library-collection-menu" role="menu">
                              <button type="button" role="menuitem" onClick={() => requestDeleteCollection(collection)}>
                                <Mark name="trash" /> Delete collection
                              </button>
                            </div>
                          ) : null}
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
                        <div className="library-grid">
                          {displayedProducts.map((product) => (
                            <article className="library-product-card" key={product.id}>
                              <button
                                className={`library-product ${selectedProductId === product.id ? 'is-selected' : ''}`}
                                type="button"
                                onClick={() => onSelectProduct(product.id)}
                                disabled={Boolean(deletingProductId || deletingCollectionId)}
                              >
                                {product.thumbUrl || product.coverThumbUrl || product.imageUrl ? (
                                  <img src={product.thumbUrl || product.coverThumbUrl || product.imageUrl} alt={product.name} />
                                ) : <span className="product-placeholder"><Mark name="image" /></span>}
                                <span className="library-product-name">{product.name}</span>
                              </button>
                              <button
                                className="library-product-delete"
                                type="button"
                                aria-label={`Delete ${product.name}`}
                                title={`Delete ${product.name}`}
                                disabled={Boolean(deletingProductId || deletingCollectionId)}
                                onClick={() => requestDelete(product)}
                              >
                                <Mark name="trash" />
                              </button>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="library-empty-state">
                          <h3>No laminates yet</h3>
                          <p>{EMPTY_PRODUCT_MESSAGE}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="library-empty-state">
                      <h3>No collection selected</h3>
                      <p>Choose a folder to browse its laminates.</p>
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="library-empty-state">
                <h3>No laminates yet</h3>
                <p>{EMPTY_COLLECTION_MESSAGE}</p>
              </div>
            )}
          </div>
        )}

        <footer className="library-footer">
          <span className="library-footer-status">{selectedProductId ? '1 laminate selected' : 'Select one laminate'}</span>
          <div className="library-footer-actions">
            <button className="library-footer-button neutral" type="button" onClick={onClose}>Cancel</button>
            <button
              className="library-footer-button primary"
              type="button"
              disabled={!selectedProductId}
              onClick={onConfirm}
            >
              Use
            </button>
          </div>
        </footer>
      </section>

      {deletionTarget ? (
        <div className="library-delete-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isDeleting) setDeletionTarget(null)
        }}>
          <section className="library-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-item-title" aria-describedby="delete-item-description">
            <span className="library-delete-icon"><Mark name="trash" /></span>
            <h2 id="delete-item-title">Delete {deletionTarget.item.name}?</h2>
            <p id="delete-item-description">{deletionTarget.type === 'product'
              ? 'This removes the product and all of its uploaded image files from the collection. Its public page stays online.'
              : 'This permanently removes the collection and all products, faces, and uploaded files inside it.'}</p>
            {deleteAttempted && error ? <p className="library-error" role="alert">{error}</p> : null}
            <div className="library-delete-actions">
              <button className="library-footer-button neutral" type="button" disabled={isDeleting} onClick={() => setDeletionTarget(null)}>Cancel</button>
              <button className="library-delete-confirm" type="button" disabled={isDeleting} onClick={() => void confirmDelete()}>
                {isDeleting ? 'Deleting…' : `Delete ${deletionTarget.type}`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}