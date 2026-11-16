import type { StoredCollectionDoc } from './indexedDbAdapter'
import { CURRENT_SCHEMA_VERSION } from './indexedDbAdapter'

export type ValidationFailureReason =
  | { type: 'unsupported_schema'; currentVersion: number; foundVersion: number }
  | { type: 'corrupted_structure'; detail: string }

export class CollectionValidationError extends Error {
  readonly reason: ValidationFailureReason
  readonly rawData: unknown

  constructor(message: string, reason: ValidationFailureReason, rawData: unknown) {
    super(message)
    this.name = 'CollectionValidationError'
    this.reason = reason
    this.rawData = rawData
  }
}

/**
 * Validates the loaded document format from storage.
 *
 * Rules:
 * - Must be an object with an integer schemaVersion.
 * - If schemaVersion > CURRENT_SCHEMA_VERSION, reject without downgrading.
 * - items must be an Array.
 * - Each item must have a valid non-empty id, valid non-empty title, and valid timestamps if present.
 */
export function validateStoredCollection(raw: unknown): StoredCollectionDoc {
  if (typeof raw !== 'object' || raw === null) {
    throw new CollectionValidationError(
      'The saved collection data is corrupted (expected an object).',
      { type: 'corrupted_structure', detail: 'Root document is not a non-null object.' },
      raw
    )
  }

  const doc = raw as Record<string, unknown>

  // Schema version validation
  if (
    typeof doc.schemaVersion !== 'number' ||
    !Number.isInteger(doc.schemaVersion) ||
    doc.schemaVersion < 1
  ) {
    throw new CollectionValidationError(
      'The saved collection has an invalid or missing schema version.',
      {
        type: 'corrupted_structure',
        detail: `Invalid schemaVersion: ${String(doc.schemaVersion)}`,
      },
      raw
    )
  }

  // Newer schema detected: must NOT automatically downgrade
  if (doc.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new CollectionValidationError(
      `The saved collection uses a newer schema version (${doc.schemaVersion}) than this application supports (${CURRENT_SCHEMA_VERSION}). Data has been preserved without changes.`,
      {
        type: 'unsupported_schema',
        currentVersion: CURRENT_SCHEMA_VERSION,
        foundVersion: doc.schemaVersion,
      },
      raw
    )
  }

  // Items array validation
  if (!Array.isArray(doc.items)) {
    throw new CollectionValidationError(
      'The saved collection items field is missing or corrupted (expected an array).',
      { type: 'corrupted_structure', detail: 'items field is not an array.' },
      raw
    )
  }

  // Item-level validation
  doc.items.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new CollectionValidationError(
        `Item at index ${index} is corrupted (expected an object).`,
        { type: 'corrupted_structure', detail: `Item at index ${index} is not an object.` },
        raw
      )
    }

    const itemObj = item as Record<string, unknown>

    if (typeof itemObj.id !== 'string' || !itemObj.id.trim()) {
      throw new CollectionValidationError(
        `Item at index ${index} is missing a valid identifier.`,
        {
          type: 'corrupted_structure',
          detail: `Item at index ${index} has invalid id: ${String(itemObj.id)}`,
        },
        raw
      )
    }

    if (typeof itemObj.title !== 'string' || !itemObj.title.trim()) {
      throw new CollectionValidationError(
        `Item "${itemObj.id}" is missing a valid title.`,
        {
          type: 'corrupted_structure',
          detail: `Item "${itemObj.id}" has invalid title: ${String(itemObj.title)}`,
        },
        raw
      )
    }

    if (
      itemObj.description !== undefined &&
      itemObj.description !== null &&
      typeof itemObj.description !== 'string'
    ) {
      throw new CollectionValidationError(
        `Item "${itemObj.id}" has an invalid description format.`,
        {
          type: 'corrupted_structure',
          detail: `Item "${itemObj.id}" description is not a string.`,
        },
        raw
      )
    }

    if (
      itemObj.image !== undefined &&
      itemObj.image !== null &&
      typeof itemObj.image !== 'string'
    ) {
      throw new CollectionValidationError(
        `Item "${itemObj.id}" has an invalid image format.`,
        {
          type: 'corrupted_structure',
          detail: `Item "${itemObj.id}" image is not a string.`,
        },
        raw
      )
    }

    if (
      itemObj.createdAt !== undefined &&
      (typeof itemObj.createdAt !== 'number' || isNaN(itemObj.createdAt))
    ) {
      throw new CollectionValidationError(
        `Item "${itemObj.id}" has an invalid creation date timestamp.`,
        {
          type: 'corrupted_structure',
          detail: `Item "${itemObj.id}" createdAt is not a valid number.`,
        },
        raw
      )
    }

    if (
      itemObj.updatedAt !== undefined &&
      (typeof itemObj.updatedAt !== 'number' || isNaN(itemObj.updatedAt))
    ) {
      throw new CollectionValidationError(
        `Item "${itemObj.id}" has an invalid modification date timestamp.`,
        {
          type: 'corrupted_structure',
          detail: `Item "${itemObj.id}" updatedAt is not a valid number.`,
        },
        raw
      )
    }
  })

  return doc as unknown as StoredCollectionDoc
}
