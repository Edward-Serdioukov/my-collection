import { describe, it, expect } from 'vitest'
import {
  validateStoredCollection,
  CollectionValidationError,
} from './validation'
import { validateCollectionImport } from './importCollection'
import { formatCollectionExport } from './exportCollection'

describe('Data validation rules (validateStoredCollection)', () => {
  it('accepts a valid collection document', () => {
    const validDoc = {
      id: 'current_collection',
      schemaVersion: 1,
      updatedAt: 1000,
      items: [
        { id: 'item-1', title: 'Coin', createdAt: 500, updatedAt: 600 },
      ],
    }
    const result = validateStoredCollection(validDoc)
    expect(result.schemaVersion).toBe(1)
    expect(result.items).toHaveLength(1)
  })

  it('rejects root non-object values', () => {
    expect(() => validateStoredCollection(null)).toThrow(
      CollectionValidationError
    )
    expect(() => validateStoredCollection('string')).toThrow(
      CollectionValidationError
    )
  })

  it('rejects missing or non-integer schemaVersion', () => {
    expect(() =>
      validateStoredCollection({ id: 'test', items: [] })
    ).toThrow(CollectionValidationError)
    expect(() =>
      validateStoredCollection({ schemaVersion: 1.5, items: [] })
    ).toThrow(CollectionValidationError)
  })

  it('rejects newer schema version without automatically downgrading', () => {
    expect(() =>
      validateStoredCollection({ schemaVersion: 2, items: [] })
    ).toThrow(/newer schema version/)
  })

  it('rejects items with missing or empty titles', () => {
    expect(() =>
      validateStoredCollection({
        schemaVersion: 1,
        items: [{ id: '1', title: '   ' }],
      })
    ).toThrow(CollectionValidationError)
  })

  it('rejects items with missing or empty IDs', () => {
    expect(() =>
      validateStoredCollection({
        schemaVersion: 1,
        items: [{ id: '', title: 'Watch' }],
      })
    ).toThrow(CollectionValidationError)
  })
})

describe('Imported data schema validation (validateCollectionImport)', () => {
  // Check 6: Imported data schema validation
  it('accepts valid collection JSON adhering to schema', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      items: [
        { id: 'import-1', title: 'Ancient Coin', description: 'Silver denarius', createdAt: 1000, updatedAt: 2000 },
      ],
    })
    const result = validateCollectionImport(json)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.schemaVersion).toBe(1)
      expect(result.itemCount).toBe(1)
      expect(result.items[0].id).toBe('import-1')
    }
  })

  it('rejects malformed JSON syntax', () => {
    const result = validateCollectionImport('{ broken json')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('syntax error')
    }
  })

  it('rejects non-object root or JSON array root', () => {
    const arrayJson = JSON.stringify([{ id: '1', title: 'Item' }])
    const result = validateCollectionImport(arrayJson)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('must be a JSON object')
    }
  })

  it('rejects missing or unsupported newer schemaVersion in import', () => {
    const missingVer = JSON.stringify({ items: [] })
    expect(validateCollectionImport(missingVer).valid).toBe(false)

    const newerVer = JSON.stringify({ schemaVersion: 99, items: [] })
    const newerResult = validateCollectionImport(newerVer)
    expect(newerResult.valid).toBe(false)
    if (!newerResult.valid) {
      expect(newerResult.error).toContain('Unsupported schema version (99)')
    }
  })

  it('rejects non-array items field in import', () => {
    const json = JSON.stringify({ schemaVersion: 1, items: 'not an array' })
    const result = validateCollectionImport(json)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('"items" field must be an array')
    }
  })

  it('rejects import items with missing or empty title', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      items: [{ id: '1', title: '   ' }],
    })
    const result = validateCollectionImport(json)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('missing a required name/title')
    }
  })

  it('rejects import items with missing or empty id', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      items: [{ id: '', title: 'Watch' }],
    })
    const result = validateCollectionImport(json)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('missing a valid identifier ("id")')
    }
  })

  it('rejects import with duplicate item IDs', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      items: [
        { id: 'dup-1', title: 'Item 1' },
        { id: 'dup-1', title: 'Item 2' },
      ],
    })
    const result = validateCollectionImport(json)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('Duplicate identifier')
    }
  })

  it('detects and lists unsupported fields during import without silent modification', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      items: [{ id: '1', title: 'Coin', price: 100, customNote: 'Special' }],
    })
    const result = validateCollectionImport(json)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.unsupportedFields).toEqual(['price', 'customNote'])
    }
  })

  it('preserves IDs, dates, and schemaVersion in export formatting and excludes local photo paths', () => {
    const exportResult = formatCollectionExport([
      {
        id: 'item-1',
        title: 'Watch',
        description: 'Mechanical',
        image: 'managed:photos/device_local_photo.jpg',
        createdAt: 1234,
        updatedAt: 5678,
      },
    ])
    expect(exportResult.schemaVersion).toBe(1)
    expect(exportResult.note).toBe('Text export only. Image files are excluded.')
    expect(exportResult.items[0]).toEqual({
      id: 'item-1',
      title: 'Watch',
      description: 'Mechanical',
      createdAt: 1234,
      updatedAt: 5678,
    })
    // Ensure local device path is completely omitted
    expect((exportResult.items[0] as Record<string, unknown>).image).toBeUndefined()
  })

  it('safely imports previous exports (schemaVersion 1 without image or note)', () => {
    // Exact structure produced by previous version before photo support
    const previousExportJson = JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      itemCount: 1,
      items: [
        {
          id: 'prev-1',
          title: 'Antique Clock',
          description: 'Working pendulum',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
    })

    const result = validateCollectionImport(previousExportJson)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe('prev-1')
      expect(result.items[0].title).toBe('Antique Clock')
      expect(result.items[0].description).toBe('Working pendulum')
      expect(result.items[0].image).toBeUndefined()
      expect(result.unsupportedFields).toEqual([])
      expect(result.hasExcludedPhotos).toBe(false)
    }
  })

  it('strips misleading local and external user photo paths during import to prevent broken references', () => {
    const craftedImportJson = JSON.stringify({
      schemaVersion: 1,
      items: [
        {
          id: 'item-local',
          title: 'Camera',
          image: 'managed:photos/non_existent.jpg',
        },
        {
          id: 'item-abs',
          title: 'Laptop',
          image: '/data/user/0/com.app/photos/pic.jpg',
        },
        {
          id: 'item-external',
          title: 'Phone',
          image: 'https://example.com/unverified.jpg',
        },
        {
          id: 'item-bundled',
          title: 'Bundled Sample',
          image: '/images/demo-item.jpg',
        },
      ],
    })

    const result = validateCollectionImport(craftedImportJson)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.hasExcludedPhotos).toBe(true)
      // Local/external paths are stripped
      expect(result.items[0].image).toBeUndefined()
      expect(result.items[1].image).toBeUndefined()
      expect(result.items[2].image).toBeUndefined()
      // Bundled asset path is preserved
      expect(result.items[3].image).toBe('/images/demo-item.jpg')
    }
  })
})
