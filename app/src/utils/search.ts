import type { CollectionItem } from '../types/item'

/**
 * Filters collection items by title according to application search rules:
 * - Case-insensitive partial matching.
 * - Surrounding query spaces are ignored.
 * - Empty query returns all items unchanged.
 * - Descriptions are not searched (title only).
 * - Original item order is preserved.
 * - Original array is not mutated.
 */
export function filterItemsByTitle(
  items: CollectionItem[],
  query: string
): CollectionItem[] {
  const trimmedQuery = query.trim().toLowerCase()
  if (!trimmedQuery) {
    return items
  }
  return items.filter((item) =>
    item.title.toLowerCase().includes(trimmedQuery)
  )
}
