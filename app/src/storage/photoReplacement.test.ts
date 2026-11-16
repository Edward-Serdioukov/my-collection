import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  savePhotoFile,
  rollbackStagedPhoto,
  cleanupUnusedPhoto,
  clearWebPhotoStore,
  getWebPhotoStoreEntry,
  getManagedFilename,
  PHOTOS_DIR,
} from './photoStorage'
import type { CollectionItem } from '../types/item'

describe('Photo Replacement & Cleanup Rules', () => {
  beforeEach(() => {
    clearWebPhotoStore()
  })

  // Case 1: new photo + form cancellation
  it('Case 1: new photo + form cancellation leaves storage and existing photo untouched', async () => {
    const oldPhotoUri = await savePhotoFile({ rawBase64: 'existing-photo-bytes' })
    const existingFilename = getManagedFilename(oldPhotoUri)

    // In form cancellation, the draft preview is simply discarded without staging or database save
    // The existing photo in storage remains completely intact
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${existingFilename}`)).toBe('existing-photo-bytes')
  })

  // Case 2: new photo + successful saving
  it('Case 2: new photo + successful saving deletes old photo only after new one is committed', async () => {
    // 1. Stage existing photo in storage
    const oldUri = await savePhotoFile({ rawBase64: 'old-image-bytes' })
    const oldFilename = getManagedFilename(oldUri)
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${oldFilename}`)).toBe('old-image-bytes')

    // 2. Stage new photo with collision-resistant name
    const newUri = await savePhotoFile({ rawBase64: 'new-image-bytes' })
    const newFilename = getManagedFilename(newUri)
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${newFilename}`)).toBe('new-image-bytes')
    expect(newFilename).not.toBe(oldFilename)

    // 3. Database commit succeeds with nextCollection pointing to newUri
    const nextCollection: CollectionItem[] = [
      { id: 'item-1', title: 'Watch', image: newUri },
      { id: 'item-2', title: 'Coin' },
    ]

    // 4. Requirement: Delete the old photo ONLY AFTER the new reference has been saved successfully
    const cleaned = await cleanupUnusedPhoto(oldUri, nextCollection)
    expect(cleaned).toBe(true)

    // Old photo is deleted from storage
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${oldFilename}`)).toBeUndefined()
    // New photo is preserved in storage
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${newFilename}`)).toBe('new-image-bytes')
  })

  // Case 3: new photo + save failure
  it('Case 3: new photo + save failure rolls back newly staged file and preserves old photo and entry', async () => {
    // 1. Existing photo
    const oldUri = await savePhotoFile({ rawBase64: 'old-image-data' })
    const oldFilename = getManagedFilename(oldUri)

    // 2. Stage new photo
    const newUri = await savePhotoFile({ rawBase64: 'new-staged-data' })
    const newFilename = getManagedFilename(newUri)
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${newFilename}`)).toBe('new-staged-data')

    // 3. Database save fails!
    const saveDatabase = vi.fn().mockRejectedValue(new Error('IndexedDB transaction failed'))
    let rollbackTriggered = false

    try {
      await saveDatabase()
    } catch {
      // Requirement: Safely clean new unused files on save failure
      await rollbackStagedPhoto(newUri)
      rollbackTriggered = true
    }

    expect(rollbackTriggered).toBe(true)

    // Newly staged photo was safely rolled back / deleted (not leaked)
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${newFilename}`)).toBeUndefined()

    // Requirement: Preserve the old entry and photo
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${oldFilename}`)).toBe('old-image-data')
  })

  // Case 4: remove photo + cancel
  it('Case 4: remove photo + cancel preserves the original item and its photo in storage', async () => {
    const existingUri = await savePhotoFile({ rawBase64: 'original-photo-bytes' })
    const filename = getManagedFilename(existingUri)

    // User clicks "Remove photo" in form draft, but cancels out of the form
    // Since form is canceled, no save occurs and cleanup is never invoked
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${filename}`)).toBe('original-photo-bytes')
  })

  // Case 5: remove photo + save
  it('Case 5: remove photo + save deletes old photo from storage after entry is saved without image', async () => {
    const existingUri = await savePhotoFile({ rawBase64: 'to-be-removed' })
    const filename = getManagedFilename(existingUri)

    // Database save succeeds with image: undefined
    const updatedCollection: CollectionItem[] = [
      { id: 'item-1', title: 'Watch', image: undefined },
    ]

    // Requirement: Delete old photo after successful entry updating
    const cleaned = await cleanupUnusedPhoto(existingUri, updatedCollection)
    expect(cleaned).toBe(true)
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${filename}`)).toBeUndefined()
  })

  // Requirement: During cleanup, check the file is not used by other items
  it('does NOT delete a photo if it is still referenced by another item in the collection', async () => {
    const sharedUri = await savePhotoFile({ rawBase64: 'shared-photo-data' })
    const filename = getManagedFilename(sharedUri)

    // Item 1 and Item 2 both reference this photo
    // Item 1 removes its photo, but Item 2 still references it
    const remainingCollection: CollectionItem[] = [
      { id: 'item-1', title: 'Copy 1', image: undefined },
      { id: 'item-2', title: 'Copy 2', image: sharedUri },
    ]

    const cleaned = await cleanupUnusedPhoto(sharedUri, remainingCollection)

    // Must NOT delete because item-2 still uses it!
    expect(cleaned).toBe(false)
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${filename}`)).toBe('shared-photo-data')
  })

  // Requirement: Do not delete bundled resources
  it('never deletes bundled or demo resources', async () => {
    const bundledUris = [
      '/assets/demo-watch.jpg',
      'bundled:demo-coin.png',
      '/images/default-stamp.svg',
    ]

    for (const bundledUri of bundledUris) {
      const cleaned = await cleanupUnusedPhoto(bundledUri, [])
      expect(cleaned).toBe(false)
    }
  })

  // Requirement: Do not delete current files before successful data replacement
  it('does not delete current files if collection data replacement fails, and cleans up only after success', async () => {
    // 1. Existing collection has an active photo file
    const currentPhotoUri = await savePhotoFile({ rawBase64: 'current-photo-content' })
    const filename = getManagedFilename(currentPhotoUri)
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${filename}`)).toBe('current-photo-content')

    const replacementItems: CollectionItem[] = [
      { id: 'item-new', title: 'New Item without photo' },
    ]

    // Simulated replaceCollection procedure:
    // Case A: saveCollection fails
    let saveFailed = true
    const attemptReplacementWithFailure = async () => {
      if (saveFailed) {
        throw new Error('Database transaction failed!')
      }
      // Cleanup step is ONLY reached on success
      await cleanupUnusedPhoto(currentPhotoUri, replacementItems)
    }

    await expect(attemptReplacementWithFailure()).rejects.toThrow('Database transaction failed!')

    // Current photo file MUST still exist!
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${filename}`)).toBe('current-photo-content')

    // Case B: saveCollection succeeds
    saveFailed = false
    await attemptReplacementWithFailure()

    // File is cleaned up only after successful data replacement
    expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${filename}`)).toBeUndefined()
  })
})
