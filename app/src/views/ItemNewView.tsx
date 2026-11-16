import { useNavigate } from 'react-router-dom'
import { useCollection } from '../context/useCollection'
import { ItemForm } from '../components/ItemForm'
import './ItemDetailView.css'

export function ItemNewView() {
  const navigate = useNavigate()
  const { addItem } = useCollection()

  const handleSave = async (data: { title: string; description?: string }) => {
    // 1. Prepare new state (inside addItem)
    // 2. Wait for successful writing with transaction completion (inside addItem)
    // 3. Update the shared collection (inside addItem)
    // 4. Navigate to the new item's details on success
    const newItem = await addItem(data)
    navigate(`/items/${newItem.id}`)
  }

  return (
    <div className="app-container">
      <main className="detail-main">
        <ItemForm
          mode="add"
          backLabel="← Back to catalog"
          onCancel={() => navigate('/')}
          onSave={handleSave}
        />
      </main>
    </div>
  )
}
