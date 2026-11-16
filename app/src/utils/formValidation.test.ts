import { describe, it, expect } from 'vitest'
import { validateItemForm } from './formValidation'

describe('Form Validation Rules (validateItemForm)', () => {
  // Check 1: Empty name
  it('rejects an empty name', () => {
    const result = validateItemForm('')
    expect(result.isValid).toBe(false)
    expect(result.nameError).toBe('Name is required.')
    expect(result.normalizedData).toBeUndefined()
  })

  // Check 2: Spaces-only name
  it('rejects a name consisting only of spaces', () => {
    const result = validateItemForm('     ')
    expect(result.isValid).toBe(false)
    expect(result.nameError).toBe('Name is required.')
    expect(result.normalizedData).toBeUndefined()
  })

  // Check 3: Surrounding-space normalization
  it('normalizes surrounding spaces in name and description', () => {
    const result = validateItemForm('   Ancient Greek Coin   ', '   Minted in Athens.   ')
    expect(result.isValid).toBe(true)
    expect(result.nameError).toBeNull()
    expect(result.descriptionError).toBeNull()
    expect(result.normalizedData).toEqual({
      title: 'Ancient Greek Coin',
      description: 'Minted in Athens.',
    })
  })

  it('normalizes empty description after trimming to undefined', () => {
    const result = validateItemForm('Pocket Watch', '    ')
    expect(result.isValid).toBe(true)
    expect(result.normalizedData).toEqual({
      title: 'Pocket Watch',
      description: undefined,
    })
  })

  it('rejects names exceeding 100 characters after trimming', () => {
    const longName = 'A'.repeat(101)
    const result = validateItemForm(longName)
    expect(result.isValid).toBe(false)
    expect(result.nameError).toBe('Name cannot exceed 100 characters.')
  })

  it('rejects descriptions exceeding 2000 characters', () => {
    const longDesc = 'D'.repeat(2001)
    const result = validateItemForm('Valid Name', longDesc)
    expect(result.isValid).toBe(false)
    expect(result.descriptionError).toBe('Description cannot exceed 2000 characters.')
  })
})
