import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CollectionProvider } from './context/CollectionContext'
import { CatalogView } from './views/CatalogView'
import { ItemDetailView } from './views/ItemDetailView'
import { ItemEditView } from './views/ItemEditView'
import { ItemNewView } from './views/ItemNewView'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <CollectionProvider>
        <Routes>
          <Route path="/" element={<CatalogView />} />
          <Route path="/items/new" element={<ItemNewView />} />
          <Route path="/items/:id" element={<ItemDetailView />} />
          <Route path="/items/:id/edit" element={<ItemEditView />} />
        </Routes>
      </CollectionProvider>
    </BrowserRouter>
  )
}

export default App
