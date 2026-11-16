import type { CollectionItem } from '../types/item'
import './ItemCard.css'

interface ItemCardProps {
  item: CollectionItem
}

export function ItemCard({ item }: ItemCardProps) {
  return (
    <article className="item-card">
      <div className="item-card-image-area">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            className="item-card-image"
          />
        ) : (
          <div className="item-card-placeholder" aria-label="Image placeholder">
            <svg
              className="item-card-placeholder-icon"
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
            <span className="item-card-placeholder-text">No image</span>
          </div>
        )}
      </div>
      <div className="item-card-content">
        <h2 className="item-card-title">{item.title}</h2>
        {item.description ? (
          <p className="item-card-description">{item.description}</p>
        ) : null}
      </div>
    </article>
  )
}
