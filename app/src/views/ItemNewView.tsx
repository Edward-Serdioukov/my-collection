import { useNavigate } from 'react-router-dom'
import { ItemForm } from '../components/ItemForm'
import './ItemDetailView.css'

export function ItemNewView() {
  const navigate = useNavigate()

  return (
    <div className="app-container">
      <main className="detail-main">
        <ItemForm
          mode="add"
          backLabel="← Back to catalog"
          onCancel={() => navigate('/')}
        />
      </main>
    </div>
  )
}
