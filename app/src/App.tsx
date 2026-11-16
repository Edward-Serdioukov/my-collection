import { DEMO_ITEMS } from './data/demoItems'
import { ItemCard } from './components/ItemCard'
import './App.css'

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-heading">My Collection</h1>
        <p className="app-caption">Demo collection</p>
      </header>

      <main className="catalog-main">
        <div className="catalog-grid">
          {DEMO_ITEMS.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      </main>
    </div>
  )
}

export default App
