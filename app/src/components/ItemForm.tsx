import { useState, useRef } from 'react'
import type { FormEvent, KeyboardEvent, MouseEvent } from 'react'
import type { CollectionItem } from '../types/item'
import { ConfirmModal } from './ConfirmModal'
import { validateItemForm } from '../utils/formValidation'
import './ItemForm.css'

interface ItemFormProps {
  mode: 'add' | 'edit'
  initialItem?: CollectionItem
  onCancel: () => void
  onSave?: (data: { title: string; description?: string }) => Promise<void> | void
  backLabel?: string
}

export function ItemForm({
  mode,
  initialItem,
  onCancel,
  onSave,
  backLabel,
}: ItemFormProps) {
  const initialName = mode === 'edit' && initialItem ? initialItem.title : ''
  const initialDescription =
    mode === 'edit' && initialItem?.description ? initialItem.description : ''

  const [name, setName] = useState<string>(initialName)
  const [description, setDescription] = useState<string>(initialDescription)
  const [nameError, setNameError] = useState<string | null>(null)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)

  // Compare current and initial values
  const isDirty = name !== initialName || description !== initialDescription

  const handleLeaveRequest = (e?: MouseEvent) => {
    if (e) {
      e.preventDefault()
    }

    if (isDirty && !isSubmitting) {
      setShowConfirmModal(true)
    } else {
      onCancel()
    }
  }

  const handleConfirmLeave = () => {
    setShowConfirmModal(false)
    onCancel()
  }

  const handleCancelLeave = () => {
    setShowConfirmModal(false)
  }

  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    // Prevent duplicate submissions when submitted repeatedly
    if (isSubmitting) {
      return
    }

    const validation = validateItemForm(name, description)

    setNameError(validation.nameError)
    setDescriptionError(validation.descriptionError)

    if (validation.nameError) {
      nameInputRef.current?.focus()
      return
    }

    if (validation.descriptionError) {
      descriptionInputRef.current?.focus()
      return
    }

    if (validation.isValid && validation.normalizedData && onSave) {
      setIsSubmitting(true)
      setSubmitError(null)

      try {
        await onSave(validation.normalizedData)
      } catch (err) {
        // On error:
        // - do not report success
        // - do not close the form
        // - do not lose entered text
        // - offer retry
        const msg =
          err instanceof Error ? err.message : 'Failed to save item. Please try again.'
        setSubmitError(msg)
        setIsSubmitting(false)
      }
    }
  }

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (
      e.key === 'Enter' &&
      (e.currentTarget.tagName === 'INPUT' || e.metaKey || e.ctrlKey)
    ) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const headingText = mode === 'add' ? 'Add item.' : 'Edit item.'
  const navBackText =
    backLabel || (mode === 'add' ? '← Back to catalog' : '← Back to details')

  return (
    <>
      <nav className="detail-nav">
        <a href="#leave" className="nav-back-link" onClick={handleLeaveRequest}>
          {navBackText}
        </a>
      </nav>

      <div className="item-form-card">
        <header className="item-form-header">
          <h1 className="item-form-heading">{headingText}</h1>
        </header>

        <form className="item-form-body" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="item-name-input" className="form-label">
              <span>
                Name<span className="form-required-mark">*</span>
              </span>
              <span className="form-char-count">{name.length} / 100</span>
            </label>
            <input
              ref={nameInputRef}
              id="item-name-input"
              type="text"
              className={`form-input ${nameError ? 'input-error' : ''}`}
              placeholder="e.g., Antique Brass Compass"
              maxLength={100}
              value={name}
              disabled={isSubmitting}
              aria-invalid={nameError ? 'true' : 'false'}
              aria-describedby={nameError ? 'item-name-error' : undefined}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(null)
                if (submitError) setSubmitError(null)
              }}
              onKeyDown={handleKeyDown}
            />
            {nameError ? (
              <p id="item-name-error" className="form-error-message" role="alert">
                {nameError}
              </p>
            ) : null}
          </div>

          <div className="form-group">
            <label htmlFor="item-description-input" className="form-label">
              <span>Description</span>
              <span className="form-char-count">{description.length} / 2000</span>
            </label>
            <textarea
              ref={descriptionInputRef}
              id="item-description-input"
              className={`form-textarea ${descriptionError ? 'input-error' : ''}`}
              placeholder="Enter detailed description of the item..."
              maxLength={2000}
              value={description}
              disabled={isSubmitting}
              aria-invalid={descriptionError ? 'true' : 'false'}
              aria-describedby={
                descriptionError ? 'item-description-error' : undefined
              }
              onChange={(e) => {
                setDescription(e.target.value)
                if (descriptionError) setDescriptionError(null)
                if (submitError) setSubmitError(null)
              }}
              onKeyDown={handleKeyDown}
            />
            {descriptionError ? (
              <p
                id="item-description-error"
                className="form-error-message"
                role="alert"
              >
                {descriptionError}
              </p>
            ) : null}
          </div>

          {submitError ? (
            <div className="form-submit-error-banner" role="alert">
              <span className="form-submit-error-icon" aria-hidden="true">
                !
              </span>
              <div className="form-submit-error-content">
                <p className="form-submit-error-message">{submitError}</p>
                <button
                  type="button"
                  className="form-submit-retry-btn"
                  onClick={() => handleSubmit()}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : null}

          <div className="item-form-actions">
            <button
              type="submit"
              className="form-btn form-btn-validate"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="form-btn form-btn-cancel"
              disabled={isSubmitting}
              onClick={handleLeaveRequest}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        title="Unsaved changes"
        message="You have unsaved changes. Are you sure you want to leave without saving?"
        confirmLabel="Leave without saving"
        cancelLabel="Stay"
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />
    </>
  )
}
