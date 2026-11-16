import type { CollectionItem } from '../types/item'
import { CURRENT_SCHEMA_VERSION } from './indexedDbAdapter'

export interface CollectionExportData {
  schemaVersion: number
  exportedAt: string
  itemCount: number
  note?: string
  items: Array<{
    id: string
    title: string
    description?: string
    createdAt?: number
    updatedAt?: number
  }>
}

/**
 * Prepares the collection data for export.
 * Preserves stable ids, creation and modification timestamps, and schemaVersion.
 * Photos are excluded as this is a text-based JSON export. Local device paths are omitted.
 */
export function formatCollectionExport(items: CollectionItem[]): CollectionExportData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    itemCount: items.length,
    note: 'Text export only. Image files are excluded.',
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  }
}

/**
 * Triggers a client-side JSON download of the current collection without server communication.
 * Returns the generated filename.
 */
export function exportCollectionAsJson(items: CollectionItem[]): string {
  const data = formatCollectionExport(items)
  const json = JSON.stringify(data, null, 2)
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const fileName = `my-collection-${dateStr}.json`

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)

  return fileName
}
