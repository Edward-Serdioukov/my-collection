import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Camera } from '@capacitor/camera'
import {
  savePhotoFile,
  rollbackStagedPhoto,
  cleanupUnusedPhoto,
  clearWebPhotoStore,
  getWebPhotoStoreEntry,
  getManagedFilename,
  MANAGED_PHOTO_PREFIX,
  PHOTOS_DIR,
} from './photoStorage'
import { ItemForm } from '../components/ItemForm'
import { SafeImage } from '../components/SafeImage'
import { ItemCard } from '../components/ItemCard'
import type { CollectionItem } from '../types/item'

// Mock Capacitor Camera plugin
vi.mock('@capacitor/camera', () => ({
  Camera: {
    getPhoto: vi.fn(),
  },
  CameraResultType: {
    Uri: 'uri',
  },
  CameraSource: {
    Camera: 'camera',
    Photos: 'photos',
  },
}))

describe('Photo Logic Verification (Using In-Memory Test File Service)', () => {
  beforeEach(() => {
    clearWebPhotoStore()
    vi.clearAllMocks()
  })

  // --------------------------------------------------------------------------
  // Check 1: Canceled selection
  // --------------------------------------------------------------------------
  describe('Check 1: Canceled selection', () => {
    it('canceling camera selection leaves form intact with no critical error or data change', async () => {
      // Simulate user canceling the system camera
      vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error('User cancelled photos app'))

      const onSave = vi.fn()
      const onCancel = vi.fn()

      render(<ItemForm mode="add" onCancel={onCancel} onSave={onSave} />)

      const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement
      const descInput = screen.getByLabelText(/Description/i) as HTMLInputElement

      fireEvent.change(nameInput, { target: { value: 'Silver Pocket Watch' } })
      fireEvent.change(descInput, { target: { value: 'Engraved vintage watch' } })

      // User clicks Take photo button
      const takePhotoBtn = screen.getByRole('button', { name: /^Take photo$/i })
      fireEvent.click(takePhotoBtn)

      // 1. No error alert is shown
      await waitFor(() => {
        expect(screen.queryByRole('alert')).toBeNull()
      })

      // 2. Text fields remain intact
      expect(nameInput.value).toBe('Silver Pocket Watch')
      expect(descInput.value).toBe('Engraved vintage watch')

      // 3. No photo preview is shown
      expect(screen.queryByAltText('Item photo preview')).toBeNull()

      // 4. Item save was not invoked
      expect(onSave).not.toHaveBeenCalled()
    })

    it('canceling a second selection preserves the previously active preview and text', async () => {
      // 1. Initial selection succeeds
      vi.mocked(Camera.getPhoto).mockResolvedValueOnce({
        webPath: 'blob:first-selection',
        format: 'jpeg',
        saved: false,
      })

      render(<ItemForm mode="add" onCancel={vi.fn()} onSave={vi.fn()} />)

      const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: 'Compass' } })

      fireEvent.click(screen.getByRole('button', { name: /^Take photo$/i }))
      const preview = await screen.findByAltText('Item photo preview') as HTMLImageElement
      expect(preview.src).toContain('blob:first-selection')

      // 2. Second selection via camera is canceled by user
      vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error('User cancelled photos app'))
      fireEvent.click(screen.getByRole('button', { name: /Take new photo/i }))

      // 3. Previous preview and text are preserved
      await waitFor(() => {
        expect(screen.queryByRole('alert')).toBeNull()
      })
      const keptPreview = screen.getByAltText('Item photo preview') as HTMLImageElement
      expect(keptPreview.src).toContain('blob:first-selection')
      expect(nameInput.value).toBe('Compass')
    })

    it('canceling system file picker (0 files selected) preserves draft and does not error', () => {
      render(<ItemForm mode="add" onCancel={vi.fn()} onSave={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).toBeTruthy()

      // Trigger change with empty FileList (simulating file picker cancel)
      fireEvent.change(fileInput, { target: { files: [] } })

      // No error alert is shown
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByAltText('Item photo preview')).toBeNull()
    })
  })

  // --------------------------------------------------------------------------
  // Check 2: Canceled replacement
  // --------------------------------------------------------------------------
  describe('Check 2: Canceled replacement', () => {
    it('canceling replacement leaves existing file in storage and original item untouched', async () => {
      // Existing photo in storage
      const existingUri = await savePhotoFile({ rawBase64: 'original-saved-file-data' })
      const filename = getManagedFilename(existingUri)
      expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${filename}`)).toBe('original-saved-file-data')

      const initialItem: CollectionItem = {
        id: 'item-orig-1',
        title: 'Original Title',
        description: 'Original Description',
        image: existingUri,
      }

      const onSave = vi.fn()
      const onCancel = vi.fn()

      render(<ItemForm mode="edit" initialItem={initialItem} onCancel={onCancel} onSave={onSave} />)

      // User selects a draft replacement photo via Camera
      vi.mocked(Camera.getPhoto).mockResolvedValueOnce({
        webPath: 'blob:new-draft-photo',
        format: 'jpeg',
        saved: false,
      })
      fireEvent.click(screen.getByRole('button', { name: /Take new photo/i }))

      await waitFor(() => {
        const preview = screen.getByAltText('Item photo preview') as HTMLImageElement
        expect(preview.src).toContain('blob:new-draft-photo')
      })

      // User decides to cancel form edit
      const cancelBtn = screen.getByRole('button', { name: /^Cancel$/i })
      fireEvent.click(cancelBtn)

      // ConfirmModal appears because form is dirty
      const discardBtn = screen.getByRole('button', { name: /Leave without saving/i })
      fireEvent.click(discardBtn)

      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(onSave).not.toHaveBeenCalled()

      // The original photo file in storage MUST remain untouched
      expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${filename}`)).toBe('original-saved-file-data')
    })

    it('removing photo in draft and then canceling form leaves original photo file intact', async () => {
      const existingUri = await savePhotoFile({ rawBase64: 'keep-this-photo' })
      const filename = getManagedFilename(existingUri)

      const initialItem: CollectionItem = {
        id: 'item-orig-2',
        title: 'Painting',
        image: existingUri,
      }

      const onCancel = vi.fn()
      render(<ItemForm mode="edit" initialItem={initialItem} onCancel={onCancel} onSave={vi.fn()} />)

      // User clicks Remove photo button
      const removeBtn = screen.getByRole('button', { name: /Remove photo/i })
      fireEvent.click(removeBtn)

      // Preview is cleared in draft UI
      expect(screen.queryByAltText('Item photo preview')).toBeNull()

      // User cancels the form
      fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }))

      // Confirm modal opens because draft photo was removed (dirty)
      const discardBtn = screen.getByRole('button', { name: /Leave without saving/i })
      fireEvent.click(discardBtn)

      expect(onCancel).toHaveBeenCalledTimes(1)

      // Existing photo in storage MUST NOT be deleted
      expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${filename}`)).toBe('keep-this-photo')
    })
  })

  // --------------------------------------------------------------------------
  // Check 3: Entry save failure after file preparation
  // --------------------------------------------------------------------------
  describe('Check 3: Entry save failure after file preparation', () => {
    it('rolls back newly prepared photo file when database entry save fails', async () => {
      // 1. Existing photo
      const oldUri = await savePhotoFile({ rawBase64: 'old-persisted-photo' })
      const oldFilename = getManagedFilename(oldUri)

      // 2. Prepare / stage new photo file in storage
      const newUri = await savePhotoFile({ rawBase64: 'new-prepared-photo-bytes' })
      const newFilename = getManagedFilename(newUri)
      expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${newFilename}`)).toBe('new-prepared-photo-bytes')

      // 3. Database saving fails (e.g. IndexedDB transaction abort or quota exceeded)
      const mockDatabaseSave = vi.fn().mockRejectedValue(new Error('IndexedDB QuotaExceededError'))

      let caughtError = false
      try {
        await mockDatabaseSave()
      } catch {
        caughtError = true
        // Rollback staged file
        await rollbackStagedPhoto(newUri)
      }

      expect(caughtError).toBe(true)

      // Staged file is removed from storage (not leaked or orphaned)
      expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${newFilename}`)).toBeUndefined()

      // Old photo file is safely preserved
      expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${oldFilename}`)).toBe('old-persisted-photo')
    })
  })

  // --------------------------------------------------------------------------
  // Check 4: Photo deletion only after successful confirmation
  // --------------------------------------------------------------------------
  describe('Check 4: Photo deletion only after successful confirmation', () => {
    it('does NOT delete old photo if database update fails; deletes only after success', async () => {
      const oldUri = await savePhotoFile({ rawBase64: 'persisted-photo-v1' })
      const oldFilename = getManagedFilename(oldUri)

      const newUri = await savePhotoFile({ rawBase64: 'persisted-photo-v2' })
      const newFilename = getManagedFilename(newUri)

      let shouldFailDb = true
      const saveItemTransaction = async (updatedCollection: CollectionItem[]) => {
        if (shouldFailDb) {
          throw new Error('Database transaction write failure!')
        }
        // Deletion step runs strictly after database write succeeds
        await cleanupUnusedPhoto(oldUri, updatedCollection)
      }

      const nextCollection: CollectionItem[] = [
        { id: 'item-1', title: 'Watch', image: newUri },
      ]

      // Attempt 1: Database failure
      await expect(saveItemTransaction(nextCollection)).rejects.toThrow('Database transaction write failure!')

      // Old photo MUST still exist in storage!
      expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${oldFilename}`)).toBe('persisted-photo-v1')
      expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${newFilename}`)).toBe('persisted-photo-v2')

      // Attempt 2: Database success
      shouldFailDb = false
      await saveItemTransaction(nextCollection)

      // Old photo is deleted only AFTER successful commit
      expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${oldFilename}`)).toBeUndefined()
      // New photo remains in storage
      expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${newFilename}`)).toBe('persisted-photo-v2')
    })

    it('does not delete photo during cleanup if another item references it', async () => {
      const sharedUri = await savePhotoFile({ rawBase64: 'shared-asset-bytes' })
      const sharedFilename = getManagedFilename(sharedUri)

      // Collection where item-2 still uses the photo
      const activeCollection: CollectionItem[] = [
        { id: 'item-1', title: 'Item 1 without photo', image: undefined },
        { id: 'item-2', title: 'Item 2 with shared photo', image: sharedUri },
      ]

      const cleaned = await cleanupUnusedPhoto(sharedUri, activeCollection)
      expect(cleaned).toBe(false)
      expect(getWebPhotoStoreEntry(`${PHOTOS_DIR}/${sharedFilename}`)).toBe('shared-asset-bytes')
    })
  })

  // --------------------------------------------------------------------------
  // Check 5: Placeholder for unavailable files
  // --------------------------------------------------------------------------
  describe('Check 5: Placeholder for unavailable files', () => {
    it('shows Photo unavailable placeholder when file is missing from storage and preserves item data', async () => {
      const missingUri = `${MANAGED_PHOTO_PREFIX}deleted_or_missing_photo.jpg`

      const itemWithMissingPhoto: CollectionItem = {
        id: 'item-missing-1',
        title: 'Rare Antique Gramophone',
        description: 'Brass horn, hand-cranked mechanism in working condition.',
        image: missingUri,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }

      render(
        <BrowserRouter>
          <ItemCard item={itemWithMissingPhoto} />
        </BrowserRouter>
      )

      // 1. Text data is preserved and displayed
      expect(screen.getByText('Rare Antique Gramophone')).toBeTruthy()
      expect(screen.getByText('Brass horn, hand-cranked mechanism in working condition.')).toBeTruthy()

      // 2. Shows distinct "Photo unavailable" placeholder
      await waitFor(() => {
        expect(screen.getByLabelText('Photo unavailable')).toBeTruthy()
      })
      expect(screen.getByText('Photo unavailable')).toBeTruthy()

      // 3. No real <img> element is rendered
      expect(screen.queryByRole('img')).toBeNull()

      // 4. Card link remains intact
      const link = screen.getByRole('link')
      expect(link.getAttribute('href')).toBe('/items/item-missing-1')
    })

    it('SafeImage handles corrupted/unreadable image decode error without crashing', async () => {
      render(<SafeImage src="/images/corrupted-image.jpg" alt="Corrupt file" />)

      const img = await screen.findByRole('img')
      expect(img).toBeTruthy()

      // Simulate browser decode failure (e.g. truncated or corrupted binary)
      fireEvent.error(img)

      await waitFor(() => {
        expect(screen.getByLabelText('Photo unavailable')).toBeTruthy()
      })
      expect(screen.getByText('Photo unavailable')).toBeTruthy()
    })
  })
})
