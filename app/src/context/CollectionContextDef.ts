import { createContext } from 'react'
import type { CollectionItem } from '../types/item'

export interface CollectionContextType {
  items: CollectionItem[]
  isLoading: boolean
  isOperating: boolean
  error: string | null
  getItem: (id: string) => CollectionItem | undefined
  addItem: (data: { title: string; description?: string; image?: string }) => Promise<CollectionItem>
  updateItem: (id: string, data: Partial<Omit<CollectionItem, 'id' | 'createdAt'>>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  replaceCollection: (newItems: CollectionItem[]) => Promise<void>
  retryLoad: () => void
}

export const CollectionContext = createContext<CollectionContextType | null>(null)
