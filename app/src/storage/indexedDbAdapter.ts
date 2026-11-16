import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CollectionItem } from '../types/item'
import { validateStoredCollection } from './validation'

export const DB_NAME = 'my_collection_db'
export const DB_VERSION = 1
export const STORE_NAME = 'collection_store'
export const DOC_KEY = 'current_collection'
export const CURRENT_SCHEMA_VERSION = 1

export interface StoredCollectionDoc {
  id: string
  schemaVersion: number
  updatedAt: number
  items: CollectionItem[]
}

interface MyCollectionDB extends DBSchema {
  collection_store: {
    key: string
    value: StoredCollectionDoc
  }
}

let dbPromise: Promise<IDBPDatabase<MyCollectionDB>> | null = null

function getDb(): Promise<IDBPDatabase<MyCollectionDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MyCollectionDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

/**
 * Loads the saved collection document from IndexedDB.
 *
 * Distinguishes a missing saved record from a saved empty collection:
 * - Returns `null` if no collection record has ever been saved (missing).
 * - Returns `StoredCollectionDoc` if a saved record exists (even if `items` is empty `[]`).
 *
 * Errors are propagated directly to the caller.
 */
export async function loadCollection(): Promise<StoredCollectionDoc | null> {
  const db = await getDb()
  const record = await db.get(STORE_NAME, DOC_KEY)
  if (record === undefined) {
    return null
  }
  return validateStoredCollection(record)
}

/**
 * Saves the collection to IndexedDB as a single document.
 *
 * Preserves each item's existing id, createdAt, updatedAt, and other fields.
 * Includes schemaVersion and current updatedAt timestamp.
 *
 * Errors are propagated directly to the caller.
 */
export async function saveCollection(collection: CollectionItem[]): Promise<void> {
  // Isolated test simulation hook: strictly guarded to development environment
  // and only triggers when an explicit test flag is active.
  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { __SIMULATE_WRITE_ERROR__?: boolean }).__SIMULATE_WRITE_ERROR__)
  ) {
    // Clear immediately (one-shot) so retry attempts proceed normally
    delete (window as unknown as { __SIMULATE_WRITE_ERROR__?: boolean }).__SIMULATE_WRITE_ERROR__
    throw new Error('Simulated write failure for verification.')
  }

  const db = await getDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')

  const doc: StoredCollectionDoc = {
    id: DOC_KEY,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: Date.now(),
    // Preserve existing items, ids, and timestamps
    items: collection.map((item) => ({ ...item })),
  }

  await tx.store.put(doc)
  // Explicitly await transaction completion
  await tx.done
}

/**
 * Closes the database connection and resets the singleton instance.
 * Useful for tests or resetting database connections.
 */
export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
}
