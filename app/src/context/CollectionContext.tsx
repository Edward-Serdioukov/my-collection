import { useState, useEffect, type ReactNode } from 'react'
import type { CollectionItem } from '../types/item'
import { DEMO_ITEMS } from '../data/demoItems'
import { CollectionContext } from './CollectionContextDef'
import { loadCollection, saveCollection } from '../storage/indexedDbAdapter'
import { CollectionValidationError } from '../storage/validation'

type StorageStatus = 'loading' | 'first_launch' | 'ready' | 'error'

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CollectionItem[]>([])
  const [status, setStatus] = useState<StorageStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [diagnosticInfo, setDiagnosticInfo] = useState<string | null>(null)
  const [isOperating, setIsOperating] = useState<boolean>(false)
  const [reloadKey, setReloadKey] = useState<number>(0)
  const [isSavingInitial, setIsSavingInitial] = useState<boolean>(false)

  useEffect(() => {
    let isCancelled = false

    async function initCollection() {
      setStatus('loading')
      setError(null)
      setDiagnosticInfo(null)

      try {
        const record = await loadCollection()
        if (isCancelled) return

        if (record === null) {
          // Distinction 1: No saved collection in IndexedDB -> First launch
          setStatus('first_launch')
        } else {
          // Distinction 2: Saved collection exists (including saved empty collection [])
          setItems(record.items)
          setStatus('ready')
        }
      } catch (err) {
        if (isCancelled) return
        // Distinction 3: Reading or validation failed
        // Preserve invalid/newer data without overwriting or downgrading
        if (err instanceof CollectionValidationError) {
          setError(err.message)
          setDiagnosticInfo(
            JSON.stringify(
              {
                failureReason: err.reason,
                rawData: err.rawData,
              },
              null,
              2
            )
          )
        } else {
          const message =
            err instanceof Error ? err.message : 'Failed to read collection from storage'
          setError(message)
          setDiagnosticInfo(null)
        }
        setStatus('error')
      }
    }

    initCollection()

    return () => {
      isCancelled = true
    }
  }, [reloadKey])

  const handleStartWithDemo = async () => {
    setIsSavingInitial(true)
    setError(null)
    try {
      const demoWithDates: CollectionItem[] = DEMO_ITEMS.map((item) => ({
        ...item,
        createdAt: item.createdAt ?? Date.now(),
        updatedAt: item.updatedAt ?? Date.now(),
      }))

      await saveCollection(demoWithDates)
      setItems(demoWithDates)
      setStatus('ready')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save demo collection'
      setError(message)
      setStatus('error')
    } finally {
      setIsSavingInitial(false)
    }
  }

  const handleStartWithEmpty = async () => {
    setIsSavingInitial(true)
    setError(null)
    try {
      await saveCollection([])
      setItems([])
      setStatus('ready')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to initialize empty collection'
      setError(message)
      setStatus('error')
    } finally {
      setIsSavingInitial(false)
    }
  }

  const retryLoad = () => {
    setReloadKey((prev) => prev + 1)
  }

  const getItem = (id: string) => {
    return items.find((item) => item.id === id)
  }

  const addItem = async (data: {
    title: string
    description?: string
    image?: string
  }): Promise<CollectionItem> => {
    if (isOperating) {
      throw new Error('Another collection operation is currently in progress.')
    }

    setIsOperating(true)
    try {
      // 1. Prepare new state
      const now = Date.now()
      const uniqueId = `item-${now}-${Math.random().toString(36).substring(2, 7)}`
      const newItem: CollectionItem = {
        id: uniqueId,
        title: data.title.trim(),
        description: data.description ? data.description.trim() : undefined,
        image: data.image,
        createdAt: now,
        updatedAt: now,
      }
      const nextCollection = [newItem, ...items]

      // 2. Wait for successful writing (with transaction completion)
      await saveCollection(nextCollection)

      // 3. Update the shared collection only after successful writing
      setItems(nextCollection)

      // 4. Return new item for navigation
      return newItem
    } finally {
      setIsOperating(false)
    }
  }

  const updateItem = async (
    id: string,
    data: Partial<Omit<CollectionItem, 'id' | 'createdAt'>>
  ): Promise<void> => {
    if (isOperating) {
      throw new Error('Another collection operation is currently in progress.')
    }

    setIsOperating(true)
    try {
      // 1. Prepare new state
      const nextCollection = items.map((item) => {
        if (item.id !== id) {
          return item
        }
        return {
          ...item,
          ...data,
          id: item.id,
          createdAt: item.createdAt,
          updatedAt: Date.now(),
          image: data.image !== undefined ? data.image : item.image,
          title: data.title !== undefined ? data.title.trim() : item.title,
          description:
            data.description !== undefined
              ? data.description.trim() || undefined
              : item.description,
        }
      })

      // 2. Wait for successful writing (with transaction completion)
      await saveCollection(nextCollection)

      // 3. Update the shared collection only after successful writing
      setItems(nextCollection)
    } finally {
      setIsOperating(false)
    }
  }

  const deleteItem = async (id: string): Promise<void> => {
    if (isOperating) {
      throw new Error('Another collection operation is currently in progress.')
    }

    setIsOperating(true)
    try {
      // 1. Prepare new state
      const nextCollection = items.filter((item) => item.id !== id)

      // 2. Wait for successful writing (with transaction completion)
      await saveCollection(nextCollection)

      // 3. Update the shared collection only after successful writing
      setItems(nextCollection)
    } finally {
      setIsOperating(false)
    }
  }

  const replaceCollection = async (newItems: CollectionItem[]): Promise<void> => {
    if (isOperating) {
      throw new Error('Another collection operation is currently in progress.')
    }

    setIsOperating(true)
    try {
      // 1. Prepare new state (full replacement)
      // 2. Wait for successful writing (with transaction completion)
      await saveCollection(newItems)

      // 3. Update the shared collection only after successful writing
      setItems(newItems)
    } finally {
      setIsOperating(false)
    }
  }

  // 1. Loading state: disable operations and do not overwrite storage
  if (status === 'loading') {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1 className="app-heading">My Collection</h1>
        </header>
        <main className="catalog-main">
          <div className="collection-status-card" role="status" aria-live="polite">
            <div className="collection-status-spinner" aria-hidden="true" />
            <h2 className="collection-status-title">Loading collection...</h2>
            <p className="collection-status-caption">Reading from local storage</p>
          </div>
        </main>
      </div>
    )
  }

  // 2. Reading or validation failed error state
  if (status === 'error') {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1 className="app-heading">My Collection</h1>
        </header>
        <main className="catalog-main">
          <div className="collection-status-card collection-status-error" role="alert">
            <div className="collection-error-icon" aria-hidden="true">
              !
            </div>
            <h2 className="collection-status-title">Unable to load collection</h2>
            <p className="collection-status-message">
              {error || 'An error occurred while loading your collection.'}
            </p>

            {diagnosticInfo ? (
              <details className="collection-diagnostic-details">
                <summary className="collection-diagnostic-summary">
                  View diagnostic details
                </summary>
                <pre className="collection-diagnostic-pre">{diagnosticInfo}</pre>
              </details>
            ) : null}

            <div className="collection-status-actions">
              <button
                type="button"
                className="catalog-search-clear-action-btn"
                onClick={retryLoad}
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // 3. First launch state: no saved collection found
  if (status === 'first_launch') {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1 className="app-heading">My Collection</h1>
          <p className="app-caption">First launch setup</p>
        </header>
        <main className="catalog-main">
          <div className="first-launch-card">
            <div className="first-launch-icon-wrapper" aria-hidden="true">
              <svg
                className="first-launch-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </div>
            <h2 className="first-launch-title">Welcome to your collection</h2>
            <p className="first-launch-caption">
              How would you like to start?
            </p>
            <div className="first-launch-actions">
              <button
                type="button"
                className="catalog-add-btn first-launch-btn"
                disabled={isSavingInitial}
                onClick={handleStartWithDemo}
              >
                Load learning items
              </button>
              <button
                type="button"
                className="catalog-search-clear-action-btn first-launch-btn"
                disabled={isSavingInitial}
                onClick={handleStartWithEmpty}
              >
                Start with an empty collection
              </button>
            </div>
            {isSavingInitial ? (
              <p className="first-launch-saving-text" role="status">
                Saving selection...
              </p>
            ) : null}
          </div>
        </main>
      </div>
    )
  }

  // 4. Ready state: collection is loaded
  return (
    <CollectionContext.Provider
      value={{
        items,
        isLoading: false,
        isOperating,
        error: null,
        getItem,
        addItem,
        updateItem,
        deleteItem,
        replaceCollection,
        retryLoad,
      }}
    >
      {children}
    </CollectionContext.Provider>
  )
}
