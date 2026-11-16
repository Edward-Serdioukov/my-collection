import { Link } from 'react-router-dom'
import type { CollectionItem } from '../types/item'
import { SafeImage } from './SafeImage'
import './ItemCard.css'

interface ItemCardProps {
  item: CollectionItem
}

export function ItemCard({ item }: ItemCardProps) {
  return (
    <Link to={`/items/${item.id}`} className="item-card">
      <div className="item-card-image-area">
        <SafeImage
          src={item.image}
          alt={item.title}
          className="item-card-image"
          placeholderText="No image"
        />
      </div>
      <div className="item-card-content">
        <h2 className="item-card-title">{item.title}</h2>
        {item.description ? (
          <p className="item-card-description">{item.description}</p>
        ) : null}
      </div>
    </Link>
  )
}
