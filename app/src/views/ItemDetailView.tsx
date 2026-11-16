import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCollection } from '../context/useCollection'
import { ConfirmModal } from '../components/ConfirmModal'
import { SafeImage } from '../components/SafeImage'
import './ItemDetailView.css'

export function ItemDetailView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getItem, deleteItem } = useCollection()
  const item = id ? getItem(id) : undefined

  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (!item) {
    return (
      <div className="app-container">
        <nav className="detail-nav">
          <Link to="/" className="nav-back-link">
            ← Back to catalog
          </Link>
        </nav>
        <main className="detail-main">
          <div className="detail-card">
            <div className="detail-content">
              <h1 className="detail-title">Item not found</h1>
              <p className="detail-description">
                The requested item could not be found.
              </p>
              <div className="detail-actions">
                <Link to="/" className="detail-link-btn">
                  Back to catalog
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const handleDeleteConfirm = async () => {
    if (isDeleting) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      // 1. Prepare new state (inside deleteItem)
      // 2. Wait for successful writing with transaction completion (inside deleteItem)
      // 3. Update the shared collection (inside deleteItem)
      // 4. Navigate to catalog on success
      await deleteItem(item.id)
      setShowDeleteModal(false)
      navigate('/')
    } catch (err) {
      // On error:
      // - do not report success
      // - do not close the detail view or modal
      // - preserve the previous collection
      // - offer retry
      const msg =
        err instanceof Error ? err.message : 'Failed to delete item. Please try again.'
      setDeleteError(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="app-container">
      <nav className="detail-nav">
        <Link to="/" className="nav-back-link">
          ← Back to catalog
        </Link>
      </nav>

      <main className="detail-main">
        <article className="detail-card">
          <div className="detail-image-area">
            <SafeImage
              src={item.image}
              alt={item.title}
              className="detail-image"
              placeholderText="No image"
            />
          </div>

          <div className="detail-content">
            <h1 className="detail-title">{item.title}</h1>
            {item.description ? (
              <p className="detail-description">{item.description}</p>
            ) : null}

            <div className="detail-actions">
              <Link to="/" className="detail-link-btn">
                Back to catalog
              </Link>
              <Link to={`/items/${item.id}/edit`} className="detail-link-btn detail-link-btn-edit">
                Edit
              </Link>
              <button
                type="button"
                className="detail-link-btn detail-link-btn-delete"
                onClick={() => setShowDeleteModal(true)}
              >
                Delete
              </button>
            </div>
          </div>
        </article>
      </main>

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete item"
        message={`Are you sure you want to delete "${item.title}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        errorMessage={deleteError}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          if (!isDeleting) {
            setShowDeleteModal(false)
            setDeleteError(null)
          }
        }}
      />
    </div>
  )
}
