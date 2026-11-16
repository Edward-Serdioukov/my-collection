import { useState, useRef, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCollection } from '../context/useCollection'
import { ItemCard } from '../components/ItemCard'
import { exportCollectionAsJson } from '../storage/exportCollection'
import {
  validateCollectionImport,
  type ImportValidationSuccess,
} from '../storage/importCollection'
import { ImportModal } from '../components/ImportModal'
import { filterItemsByTitle } from '../utils/search'

export function CatalogView() {
  const { items, replaceCollection } = useCollection()
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingImport, setPendingImport] = useState<ImportValidationSuccess | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check whether the shared collection itself is empty (not inferred from filtered results)
  const isCollectionEmpty = items.length === 0

  // Derive filtered items from non-empty collection using pure search rules
  const filteredItems = filterItemsByTitle(items, searchQuery)

  const handleClearSearch = () => {
    setSearchQuery('')
  }

  const handleExport = () => {
    exportCollectionAsJson(items)
  }

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      const result = validateCollectionImport(text)

      if (!result.valid) {
        setImportError(result.error)
        return
      }

      setPendingImport(result)
    } catch (err) {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setImportError(
        err instanceof Error ? err.message : 'Failed to read selected file.'
      )
    }
  }

  const handleConfirmImport = async () => {
    if (!pendingImport) return
    await replaceCollection(pendingImport.items)
    setPendingImport(null)
  }

  const handleCancelImport = () => {
    setPendingImport(null)
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-heading">My Collection</h1>
        <p className="app-caption">Personal collection</p>
        <div className="catalog-header-actions">
          <Link to="/items/new" className="catalog-add-btn">
            + Add item
          </Link>
          <button
            type="button"
            className="catalog-export-btn"
            onClick={handleExport}
          >
            Export collection (JSON)
          </button>
          <button
            type="button"
            className="catalog-export-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Import collection (JSON)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>
        <p className="catalog-export-note">
          Note: Photos are not included in text export or import.
        </p>
      </header>

      {!isCollectionEmpty ? (
        <section className="catalog-search-section">
          <div className="catalog-search-group">
            <label htmlFor="catalog-search-input" className="catalog-search-label">
              Search by name
            </label>
            <div className="catalog-search-input-wrapper">
              <input
                id="catalog-search-input"
                type="text"
                className="catalog-search-input"
                placeholder="e.g., Coin, Watch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && searchQuery) {
                    e.preventDefault()
                    handleClearSearch()
                  }
                }}
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="catalog-search-clear-btn"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                >
                  Clear search
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <main className="catalog-main">
        {isCollectionEmpty ? (
          /* State 1: Shared collection itself is empty */
          <div className="catalog-empty-card">
            <div className="catalog-empty-icon-wrapper" aria-hidden="true">
              <svg
                className="catalog-empty-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m7.5 4.27 9 5.15" />
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                <path d="m3.3 7 8.7 5 8.7-5" />
                <path d="M12 22V12" />
              </svg>
            </div>
            <h2 className="catalog-empty-title">
              There are no items in your collection yet
            </h2>
            <div className="catalog-empty-action">
              <Link to="/items/new" className="catalog-add-btn">
                Add item
              </Link>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          /* State 2: Collection is not empty, but search has no matches */
          <div className="catalog-empty-card">
            <h2 className="catalog-empty-title">Nothing matches your search</h2>
            <div className="catalog-empty-action">
              <button
                type="button"
                className="catalog-search-clear-action-btn"
                onClick={handleClearSearch}
              >
                Clear search
              </button>
            </div>
          </div>
        ) : (
          /* State 3: Active items in catalog */
          <div className="catalog-grid">
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      <ImportModal
        isOpen={Boolean(pendingImport)}
        currentCount={items.length}
        pendingImport={pendingImport}
        onConfirm={handleConfirmImport}
        onCancel={handleCancelImport}
        onExportCurrent={handleExport}
      />

      {importError ? (
        <div
          className="modal-backdrop"
          onClick={() => setImportError(null)}
          role="presentation"
        >
          <div
            className="modal-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="import-error-title"
          >
            <h2 id="import-error-title" className="modal-title">
              Import validation failed
            </h2>
            <p className="modal-message">{importError}</p>
            <p className="import-photos-notice">
              The file was not imported. Your current collection remains unchanged.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn modal-btn-cancel"
                onClick={() => setImportError(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
