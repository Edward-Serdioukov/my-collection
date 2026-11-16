import type { CollectionItem } from '../types/item'
import { CURRENT_SCHEMA_VERSION } from './indexedDbAdapter'
import { isBundledPhoto } from './photoStorage'

export const RECOGNIZED_ITEM_KEYS = [
  'id',
  'title',
  'description',
  'createdAt',
  'updatedAt',
  'image',
] as const

export interface ImportValidationSuccess {
  valid: true
  schemaVersion: number
  items: CollectionItem[]
  unsupportedFields: string[]
  itemCount: number
  hasExcludedPhotos?: boolean
}

export interface ImportValidationFailure {
  valid: false
  error: string
  details?: string
}

export type ImportValidationResult =
  | ImportValidationSuccess
  | ImportValidationFailure

/**
 * Validates text-based collection JSON for full-replacement import.
 *
 * Rules:
 * - Must be valid JSON object with schemaVersion <= CURRENT_SCHEMA_VERSION.
 * - items must be an Array.
 * - Each item must have a valid non-empty id and title.
 * - Item IDs must be strictly unique within the file.
 * - Detects unsupported fields without silent modification.
 * - No network requests are made to URLs within the file.
 * - External image links are not verified or treated as transferred photos.
 */
export function validateCollectionImport(jsonText: string): ImportValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (err) {
    return {
      valid: false,
      error: 'Invalid JSON file: syntax error.',
      details: err instanceof Error ? err.message : undefined,
    }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      valid: false,
      error: 'Invalid file format: root must be a JSON object.',
    }
  }

  const doc = parsed as Record<string, unknown>

  // 1. Check schemaVersion
  if (
    typeof doc.schemaVersion !== 'number' ||
    !Number.isInteger(doc.schemaVersion) ||
    doc.schemaVersion < 1
  ) {
    return {
      valid: false,
      error: 'Invalid or missing schemaVersion in file.',
    }
  }

  if (doc.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Unsupported schema version (${doc.schemaVersion}). This application supports schema version ${CURRENT_SCHEMA_VERSION}.`,
    }
  }

  // 2. Check items array
  if (!Array.isArray(doc.items)) {
    return {
      valid: false,
      error: 'Invalid collection format: "items" field must be an array.',
    }
  }

  const seenIds = new Set<string>()
  const unsupportedFieldsSet = new Set<string>()
  const validatedItems: CollectionItem[] = []
  let hasExcludedPhotos = false
  const now = Date.now()

  // 3. Validate entries and check ID uniqueness
  for (let index = 0; index < doc.items.length; index++) {
    const rawItem = doc.items[index]

    if (typeof rawItem !== 'object' || rawItem === null || Array.isArray(rawItem)) {
      return {
        valid: false,
        error: `Item at index ${index} is not a valid object.`,
      }
    }

    const itemObj = rawItem as Record<string, unknown>

    // Check id
    if (typeof itemObj.id !== 'string' || !itemObj.id.trim()) {
      return {
        valid: false,
        error: `Item at index ${index} is missing a valid identifier ("id").`,
      }
    }

    const trimmedId = itemObj.id.trim()
    if (seenIds.has(trimmedId)) {
      return {
        valid: false,
        error: `Duplicate identifier found in import file: "${trimmedId}". All item IDs must be unique.`,
      }
    }
    seenIds.add(trimmedId)

    // Check title
    if (typeof itemObj.title !== 'string' || !itemObj.title.trim()) {
      return {
        valid: false,
        error: `Item "${trimmedId}" is missing a required name/title.`,
      }
    }

    // Check description
    let description: string | undefined
    if (itemObj.description !== undefined && itemObj.description !== null) {
      if (typeof itemObj.description !== 'string') {
        return {
          valid: false,
          error: `Item "${trimmedId}" has an invalid description format (must be text).`,
        }
      }
      description = itemObj.description.trim() || undefined
    }

    // Timestamps
    const createdAt =
      typeof itemObj.createdAt === 'number' && !isNaN(itemObj.createdAt)
        ? itemObj.createdAt
        : now
    const updatedAt =
      typeof itemObj.updatedAt === 'number' && !isNaN(itemObj.updatedAt)
        ? itemObj.updatedAt
        : now

    // Detect unsupported fields (Rule: surface them explicitly, do not change silently)
    Object.keys(itemObj).forEach((key) => {
      if (!RECOGNIZED_ITEM_KEYS.includes(key as (typeof RECOGNIZED_ITEM_KEYS)[number])) {
        unsupportedFieldsSet.add(key)
      }
    })

    // Image handling: text import does not transfer user photos.
    // To prevent misleading broken references to missing user files,
    // only immutable bundled app resources are retained.
    // Local device paths (managed:photos/, file://, content://, etc.) or external URLs are stripped.
    let image: string | undefined
    if (typeof itemObj.image === 'string' && itemObj.image.trim()) {
      const candidate = itemObj.image.trim()
      if (isBundledPhoto(candidate)) {
        image = candidate
      } else {
        hasExcludedPhotos = true
      }
    }

    validatedItems.push({
      id: trimmedId,
      title: itemObj.title.trim(),
      description,
      createdAt,
      updatedAt,
      image,
    })
  }

  return {
    valid: true,
    schemaVersion: doc.schemaVersion,
    items: validatedItems,
    unsupportedFields: Array.from(unsupportedFieldsSet),
    itemCount: validatedItems.length,
    hasExcludedPhotos,
  }
}
