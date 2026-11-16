import { useState, useRef } from 'react'
import type { FormEvent, KeyboardEvent, MouseEvent } from 'react'
import type { CollectionItem } from '../types/item'
import { ConfirmModal } from './ConfirmModal'
import './ItemForm.css'

interface ItemFormProps {
  mode: 'add' | 'edit'
  initialItem?: CollectionItem
  onCancel: () => void
  backLabel?: string
}

export function ItemForm({ mode, initialItem, onCancel, backLabel }: ItemFormProps) {
  const initialName = mode === 'edit' && initialItem ? initialItem.title : ''
  const initialDescription =
    mode === 'edit' && initialItem?.description ? initialItem.description : ''

  const [name, setName] = useState<string>(initialName)
  const [description, setDescription] = useState<string>(initialDescription)
  const [nameError, setNameError] = useState<string | null>(null)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [validFeedback, setValidFeedback] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)

  // Compare current and initial values
  const isDirty = name !== initialName || description !== initialDescription

  const handleLeaveRequest = (e?: MouseEvent) => {
    if (e) {
      e.preventDefault()
    }

    if (isDirty) {
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

  const handleValidate = (e?: FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    setValidFeedback(null)

    let hasError = false
    let currentNameError: string | null = null
    let currentDescError: string | null = null

    const trimmedName = name.trim()
    if (!trimmedName) {
      currentNameError = 'Name is required.'
      hasError = true
    } else if (trimmedName.length > 100) {
      currentNameError = 'Name cannot exceed 100 characters.'
      hasError = true
    }

    if (description.length > 2000) {
      currentDescError = 'Description cannot exceed 2000 characters.'
      hasError = true
    }

    setNameError(currentNameError)
    setDescriptionError(currentDescError)

    if (currentNameError) {
      nameInputRef.current?.focus()
    } else if (currentDescError) {
      descriptionInputRef.current?.focus()
    }

    if (!hasError) {
      setValidFeedback('The data is valid.\nWe will add saving in the next step.')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.currentTarget.tagName === 'INPUT' || e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleValidate()
    }
  }

  const headingText = mode === 'add' ? 'Add item.' : 'Edit item.'
  const navBackText = backLabel || (mode === 'add' ? '← Back to catalog' : '← Back to details')

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
          <p className="item-form-learning-notice">
            Learning mode: changes are not saved yet.
          </p>
        </header>

        <form className="item-form-body" onSubmit={handleValidate} noValidate>
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
              aria-invalid={nameError ? 'true' : 'false'}
              aria-describedby={nameError ? 'item-name-error' : undefined}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(null)
                if (validFeedback) setValidFeedback(null)
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
              aria-invalid={descriptionError ? 'true' : 'false'}
              aria-describedby={descriptionError ? 'item-description-error' : undefined}
              onChange={(e) => {
                setDescription(e.target.value)
                if (descriptionError) setDescriptionError(null)
                if (validFeedback) setValidFeedback(null)
              }}
              onKeyDown={handleKeyDown}
            />
            {descriptionError ? (
              <p id="item-description-error" className="form-error-message" role="alert">
                {descriptionError}
              </p>
            ) : null}
          </div>

          {validFeedback ? (
            <div className="form-validation-status status-success" role="status">
              {validFeedback.split('\n').map((line, idx) => (
                <p key={idx} className="status-line">
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          <div className="item-form-actions">
            <button type="submit" className="form-btn form-btn-validate">
              Validate data
            </button>
            <button
              type="button"
              className="form-btn form-btn-cancel"
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
