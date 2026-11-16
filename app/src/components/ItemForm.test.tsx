import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Camera } from '@capacitor/camera'
import { ItemForm } from './ItemForm'

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

/**
 * Note: Real IndexedDB is NOT tested in this suite.
 * Storage adapter operations are substituted at the component boundary via mock save handlers.
 */
describe('ItemForm - User Interaction Scenarios (React Testing Library)', () => {
  // Scenario 1: Empty names are not submitted
  it('Scenario 1: does not submit when name is empty or only whitespace', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(<ItemForm mode="add" onCancel={onCancel} onSave={onSave} />)

    // 1. Find field by visible label
    const nameInput = screen.getByLabelText(/Name/i)
    const saveButton = screen.getByRole('button', { name: /^Save$/i })

    // 2. Type text (only whitespace)
    fireEvent.change(nameInput, { target: { value: '     ' } })

    // 3. Press button
    fireEvent.click(saveButton)

    // 4. Check observable results:
    // - Validation alert appears on screen
    const alertMessage = screen.getByRole('alert')
    expect(alertMessage.textContent).toContain('Name is required.')

    // - Focus is moved to the invalid input
    expect(document.activeElement).toBe(nameInput)

    // - Storage save callback is not triggered
    expect(onSave).not.toHaveBeenCalled()
  })

  // Scenario 2: Valid data is passed for saving
  it('Scenario 2: passes valid trimmed data to storage handler when Save is pressed', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn()

    render(<ItemForm mode="add" onCancel={onCancel} onSave={onSave} />)

    // 1. Find fields by visible labels
    const nameInput = screen.getByLabelText(/Name/i)
    const descriptionInput = screen.getByLabelText(/Description/i)
    const saveButton = screen.getByRole('button', { name: /^Save$/i })

    // 2. Type text
    fireEvent.change(nameInput, { target: { value: '   Silver Pocket Watch   ' } })
    fireEvent.change(descriptionInput, { target: { value: '  Mechanical watch from 1920.  ' } })

    // 3. Press button
    fireEvent.click(saveButton)

    // 4. Check observable result: valid normalized data passed for saving
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith({
        title: 'Silver Pocket Watch',
        description: 'Mechanical watch from 1920.',
      })
    })
  })

  // Scenario 3: Save failure does not clear the form
  it('Scenario 3: does not clear the form when storage save fails, displays error banner and allows retry', async () => {
    // Substituted storage adapter simulating write failure
    const onSave = vi.fn().mockRejectedValue(new Error('Substituted storage write failure'))
    const onCancel = vi.fn()

    render(<ItemForm mode="add" onCancel={onCancel} onSave={onSave} />)

    // 1. Find fields by visible labels
    const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement
    const descriptionInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement
    const saveButton = screen.getByRole('button', { name: /^Save$/i })

    // 2. Type text
    fireEvent.change(nameInput, { target: { value: 'Rare Roman Denarius' } })
    fireEvent.change(descriptionInput, { target: { value: 'Silver coin from 1st century AD.' } })

    // 3. Press button
    fireEvent.click(saveButton)

    // 4. Check observable results:
    // - Error message banner is displayed
    const errorBanner = await screen.findByRole('alert')
    expect(errorBanner.textContent).toContain('Substituted storage write failure')

    // - Entered values remain intact in the form fields (not cleared)
    expect(nameInput.value).toBe('Rare Roman Denarius')
    expect(descriptionInput.value).toBe('Silver coin from 1st century AD.')

    // - Retry button is visible and accessible
    const retryButton = screen.getByRole('button', { name: /Retry/i })
    expect(retryButton).toBeDefined()
  })

  // Scenario 4: Repeated submission is impossible while saving
  it('Scenario 4: prevents repeated submission and disables controls while saving is in progress', () => {
    // Substituted storage write in progress (unresolved promise)
    const onSave = vi.fn().mockImplementation(() => new Promise<void>(() => {}))
    const onCancel = vi.fn()

    render(<ItemForm mode="add" onCancel={onCancel} onSave={onSave} />)

    // 1. Find fields by visible labels
    const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement
    const descriptionInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement
    const saveButton = screen.getByRole('button', { name: /^Save$/i }) as HTMLButtonElement

    // 2. Type text
    fireEvent.change(nameInput, { target: { value: 'Vintage Postage Stamp' } })

    // 3. Press button
    fireEvent.click(saveButton)

    // 4. Check observable results while saving is in progress:
    // - onSave was called exactly once
    expect(onSave).toHaveBeenCalledTimes(1)

    // - Save button shows saving state and is disabled
    expect(screen.getByRole('button', { name: /Saving\.\.\./i })).toBeDefined()
    expect(saveButton.disabled).toBe(true)

    // - Input controls are disabled to prevent editing while saving
    expect(nameInput.disabled).toBe(true)
    expect(descriptionInput.disabled).toBe(true)

    // - User attempts repeated submission
    fireEvent.click(saveButton)

    // - Observable result: repeated submission is ignored, onSave still called once
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  // Photo Draft Scenarios (Gallery Selection)
  it('preserves name and description when selecting a draft photo without modifying saved item', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(<ItemForm mode="add" onCancel={onCancel} onSave={onSave} />)

    const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement
    const descInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement

    // User enters name and description
    fireEvent.change(nameInput, { target: { value: 'Antique Compass' } })
    fireEvent.change(descInput, { target: { value: 'Solid brass case.' } })

    // User selects a photo file
    const fileInput = document.getElementById('item-photo-input') as HTMLInputElement
    const file = new File(['fake-image-bytes'], 'compass.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    // Observable results:
    // 1. Preview is visible
    const previewImg = screen.getByAltText('Item photo preview') as HTMLImageElement
    expect(previewImg).toBeDefined()
    expect(previewImg.src).toContain('blob:')

    // 2. Name and description remain intact
    expect(nameInput.value).toBe('Antique Compass')
    expect(descInput.value).toBe('Solid brass case.')

    // 3. Selection does not modify the saved item (onSave is not called)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('selecting another photo replaces the previous draft photo', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(<ItemForm mode="add" onCancel={onCancel} onSave={onSave} />)

    const fileInput = document.getElementById('item-photo-input') as HTMLInputElement

    // Select first photo
    const file1 = new File(['img1'], 'photo1.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file1] } })

    const preview1 = screen.getByAltText('Item photo preview') as HTMLImageElement
    const firstUrl = preview1.src

    // Select second photo
    const file2 = new File(['img2'], 'photo2.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file2] } })

    const preview2 = screen.getByAltText('Item photo preview') as HTMLImageElement
    expect(preview2.src).not.toBe(firstUrl)
    expect(preview2.src).toContain('blob:')
  })

  it('canceling the system picker is not an error and preserves previous preview', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(<ItemForm mode="add" onCancel={onCancel} onSave={onSave} />)

    const fileInput = document.getElementById('item-photo-input') as HTMLInputElement

    // First select a photo
    const file = new File(['img'], 'photo.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    const initialPreview = screen.getByAltText('Item photo preview') as HTMLImageElement
    const initialSrc = initialPreview.src

    // User opens picker and cancels (empty files array)
    fireEvent.change(fileInput, { target: { files: [] } })

    // Observable results:
    // 1. No error banner is displayed
    expect(screen.queryByRole('alert')).toBeNull()

    // 2. Previous preview is preserved
    const currentPreview = screen.getByAltText('Item photo preview') as HTMLImageElement
    expect(currentPreview.src).toBe(initialSrc)
  })

  it('displays an understandable error message when selecting an invalid non-image file', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(<ItemForm mode="add" onCancel={onCancel} onSave={onSave} />)

    const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Compass' } })

    const fileInput = document.getElementById('item-photo-input') as HTMLInputElement
    const textFile = new File(['hello'], 'document.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [textFile] } })

    // Observable results:
    // 1. Understandable error message appears
    const errorMessage = screen.getByRole('alert')
    expect(errorMessage.textContent).toContain('Selected file is not an image')

    // 2. Name is preserved
    expect(nameInput.value).toBe('Compass')

    // 3. No preview is displayed
    expect(screen.queryByAltText('Item photo preview')).toBeNull()
  })

  it('removes draft photo when Remove photo button is clicked', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(<ItemForm mode="add" onCancel={onCancel} onSave={onSave} />)

    const fileInput = document.getElementById('item-photo-input') as HTMLInputElement
    const file = new File(['img'], 'photo.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(screen.getByAltText('Item photo preview')).toBeDefined()

    // Click Remove photo
    const removeBtn = screen.getByRole('button', { name: /Remove photo/i })
    fireEvent.click(removeBtn)

    // Preview is removed and Choose from gallery is available
    expect(screen.queryByAltText('Item photo preview')).toBeNull()
    expect(screen.getByRole('button', { name: /Choose from gallery/i })).toBeDefined()
  })

  // Camera Capture Scenarios
  it('successfully captures photo via Camera, sets draft preview, and preserves entered text', async () => {
    const onSave = vi.fn()
    vi.mocked(Camera.getPhoto).mockResolvedValueOnce({
      webPath: 'blob:captured-compass-photo',
      format: 'jpeg',
      saved: false,
    })

    render(<ItemForm mode="add" onCancel={vi.fn()} onSave={onSave} />)

    const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement
    const descInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement

    // Enter name and description
    fireEvent.change(nameInput, { target: { value: 'Maritime Sextant' } })
    fireEvent.change(descInput, { target: { value: 'Brass navigation instrument.' } })

    // User clicks Take photo button
    const takePhotoBtn = screen.getByRole('button', { name: /^Take photo$/i })
    fireEvent.click(takePhotoBtn)

    // Observable results:
    // 1. Preview shows captured image
    await waitFor(() => {
      const previewImg = screen.getByAltText('Item photo preview') as HTMLImageElement
      expect(previewImg.src).toContain('blob:captured-compass-photo')
    })

    // 2. Text remains preserved
    expect(nameInput.value).toBe('Maritime Sextant')
    expect(descInput.value).toBe('Brass navigation instrument.')

    // 3. Selection does not modify saved item (onSave is not called yet)
    expect(onSave).not.toHaveBeenCalled()

    // 4. Does not show "Photo saved to collection" before form is confirmed
    expect(screen.queryByText(/Photo saved to collection/i)).toBeNull()
  })

  it('canceling camera capture is not treated as an error and preserves previous preview and text', async () => {
    vi.mocked(Camera.getPhoto).mockResolvedValueOnce({
      webPath: 'blob:first-photo',
      format: 'jpeg',
      saved: false,
    })

    render(<ItemForm mode="add" onCancel={vi.fn()} onSave={vi.fn()} />)

    const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Pocket Watch' } })

    // Take first photo
    fireEvent.click(screen.getByRole('button', { name: /^Take photo$/i }))
    await waitFor(() => {
      expect(screen.getByAltText('Item photo preview')).toBeDefined()
    })

    const initialImg = screen.getByAltText('Item photo preview') as HTMLImageElement
    expect(initialImg.src).toContain('blob:first-photo')

    // Now user clicks Take new photo and cancels system camera
    vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error('User cancelled photos app'))
    fireEvent.click(screen.getByRole('button', { name: /Take new photo/i }))

    // Observable results:
    // 1. No critical error alert displayed
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull()
    })

    // 2. Previous preview is preserved
    const currentImg = screen.getByAltText('Item photo preview') as HTMLImageElement
    expect(currentImg.src).toContain('blob:first-photo')

    // 3. Text is preserved
    expect(nameInput.value).toBe('Pocket Watch')
  })

  it('displays an understandable error message when camera permission is denied and preserves text', async () => {
    vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error('Camera permission denied'))

    render(<ItemForm mode="add" onCancel={vi.fn()} onSave={vi.fn()} />)

    const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Golden Coin' } })

    fireEvent.click(screen.getByRole('button', { name: /^Take photo$/i }))

    // Observable results:
    // 1. Understandable error message appears
    const errorAlert = await screen.findByRole('alert')
    expect(errorAlert.textContent).toContain('Camera permission was denied')

    // 2. Name is preserved
    expect(nameInput.value).toBe('Golden Coin')

    // 3. No preview is displayed
    expect(screen.queryByAltText('Item photo preview')).toBeNull()
  })

  it('allows taking another capture which replaces the existing draft preview', async () => {
    vi.mocked(Camera.getPhoto)
      .mockResolvedValueOnce({
        webPath: 'blob:first-capture',
        format: 'jpeg',
        saved: false,
      })
      .mockResolvedValueOnce({
        webPath: 'blob:second-capture',
        format: 'jpeg',
        saved: false,
      })

    render(<ItemForm mode="add" onCancel={vi.fn()} onSave={vi.fn()} />)

    // First capture
    fireEvent.click(screen.getByRole('button', { name: /^Take photo$/i }))
    await waitFor(() => {
      const img = screen.getByAltText('Item photo preview') as HTMLImageElement
      expect(img.src).toContain('blob:first-capture')
    })

    // Another capture replaces previous
    fireEvent.click(screen.getByRole('button', { name: /Take new photo/i }))
    await waitFor(() => {
      const img = screen.getByAltText('Item photo preview') as HTMLImageElement
      expect(img.src).toContain('blob:second-capture')
    })
  })
})
