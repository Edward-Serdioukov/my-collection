import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ItemForm } from './ItemForm'

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
})
