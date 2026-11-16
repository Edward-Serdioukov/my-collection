import { Link, useParams } from 'react-router-dom'
import { DEMO_ITEMS } from '../data/demoItems'
import './ItemDetailView.css'

export function ItemDetailView() {
  const { id } = useParams<{ id: string }>()
  const item = DEMO_ITEMS.find((it) => it.id === id)

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
            {item.image ? (
              <img
                src={item.image}
                alt={item.title}
                className="detail-image"
              />
            ) : (
              <div className="detail-placeholder" aria-label="Image placeholder">
                <svg
                  className="detail-placeholder-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="detail-placeholder-text">No image</span>
              </div>
            )}
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
            </div>
          </div>
        </article>
      </main>
    </div>
  )
}
