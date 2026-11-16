import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCollection } from '../context/useCollection'
import { ItemForm } from '../components/ItemForm'
import './ItemDetailView.css'

export function ItemEditView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getItem, updateItem } = useCollection()
  const item = id ? getItem(id) : undefined

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
                The requested item could not be found for editing.
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

  const handleSave = async (data: { title: string; description?: string }) => {
    // 1. Prepare new state (inside updateItem)
    // 2. Wait for successful writing with transaction completion (inside updateItem)
    // 3. Update the shared collection (inside updateItem)
    // 4. Navigate to details on success
    await updateItem(item.id, data)
    navigate(`/items/${item.id}`)
  }

  return (
    <div className="app-container">
      <main className="detail-main">
        <ItemForm
          mode="edit"
          initialItem={item}
          backLabel="← Back to details"
          onCancel={() => navigate(`/items/${item.id}`)}
          onSave={handleSave}
        />
      </main>
    </div>
  )
}
