export interface ItemFormValidationResult {
  isValid: boolean
  nameError: string | null
  descriptionError: string | null
  normalizedData?: {
    title: string
    description?: string
  }
}

/**
 * Validates item form inputs according to application business rules:
 * - Name is required after trimming surrounding whitespace.
 * - Strings composed entirely of whitespace are treated as empty.
 * - Surrounding whitespace in name and description is normalized (trimmed).
 * - Empty description after trimming is normalized to undefined.
 * - Maximum character limits: Name (100), Description (2000).
 */
export function validateItemForm(
  name: string,
  description: string = ''
): ItemFormValidationResult {
  const trimmedName = name.trim()
  let nameError: string | null = null
  let descriptionError: string | null = null

  if (!trimmedName) {
    nameError = 'Name is required.'
  } else if (trimmedName.length > 100) {
    nameError = 'Name cannot exceed 100 characters.'
  }

  if (description.length > 2000) {
    descriptionError = 'Description cannot exceed 2000 characters.'
  }

  const isValid = !nameError && !descriptionError

  return {
    isValid,
    nameError,
    descriptionError,
    normalizedData: isValid
      ? {
          title: trimmedName,
          description: description.trim() || undefined,
        }
      : undefined,
  }
}
