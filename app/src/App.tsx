import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CatalogView } from './views/CatalogView'
import { ItemDetailView } from './views/ItemDetailView'
import { ItemEditView } from './views/ItemEditView'
import { ItemNewView } from './views/ItemNewView'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CatalogView />} />
        <Route path="/items/new" element={<ItemNewView />} />
        <Route path="/items/:id" element={<ItemDetailView />} />
        <Route path="/items/:id/edit" element={<ItemEditView />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
