import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ChangeEvent,
} from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import type { CollectionItem } from '../types/item'
import { ConfirmModal } from './ConfirmModal'
import { validateItemForm } from '../utils/formValidation'
import { savePhotoFile, rollbackStagedPhoto } from '../storage/photoStorage'
import './ItemForm.css'

interface ItemFormProps {
  mode: 'add' | 'edit'
  initialItem?: CollectionItem
  initialName?: string
  initialDescription?: string
  initialImage?: string
  onCancel: () => void
  onSave?: (data: {
    title: string
    description?: string
    image?: string
  }) => Promise<void> | void
  backLabel?: string
}

export function ItemForm({
  mode,
  initialItem,
  initialName: explicitInitialName,
  initialDescription: explicitInitialDescription,
  initialImage: explicitInitialImage,
  onCancel,
  onSave,
  backLabel,
}: ItemFormProps) {
  const initialName =
    explicitInitialName ?? (mode === 'edit' && initialItem ? initialItem.title : '')
  const initialDescription =
    explicitInitialDescription ??
    (mode === 'edit' && initialItem?.description ? initialItem.description : '')
  const initialPhotoUrl =
    explicitInitialImage ??
    (mode === 'edit' && initialItem?.image ? initialItem.image : null)

  const [name, setName] = useState<string>(initialName)
  const [description, setDescription] = useState<string>(initialDescription)
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialPhotoUrl)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const [nameError, setNameError] = useState<string | null>(null)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const draftObjectUrlRef = useRef<string | null>(null)

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (draftObjectUrlRef.current) {
        URL.revokeObjectURL(draftObjectUrlRef.current)
      }
    }
  }, [])

  // Compare current and initial values
  const isPhotoChanged = photoPreview !== initialPhotoUrl
  const isDirty =
    name !== initialName || description !== initialDescription || isPhotoChanged

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
    if (draftObjectUrlRef.current) {
      URL.revokeObjectURL(draftObjectUrlRef.current)
      draftObjectUrlRef.current = null
    }
    onCancel()
  }

  const handleCancelLeave = () => {
    setShowConfirmModal(false)
  }

  const handleTakePhoto = async () => {
    setPhotoError(null)
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      })

      if (photo.webPath) {
        if (draftObjectUrlRef.current) {
          URL.revokeObjectURL(draftObjectUrlRef.current)
          draftObjectUrlRef.current = null
        }
        setPhotoPreview(photo.webPath)
        setPhotoFile(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const isCancelled =
        message.toLowerCase().includes('cancel') ||
        message.toLowerCase().includes('no image picked') ||
        message.toLowerCase().includes('no photo selected')

      if (isCancelled) {
        // Requirement: Do not treat cancellation of a system operation as a critical app error.
        // Return to form with previous preview and text preserved.
        return
      }

      const isPermissionDenied =
        message.toLowerCase().includes('permission') ||
        message.toLowerCase().includes('denied')

      if (isPermissionDenied) {
        setPhotoError(
          'Camera permission was denied. Please allow camera access in device settings.'
        )
      } else {
        setPhotoError(
          err instanceof Error
            ? err.message
            : 'Unable to capture photo. Please check permissions.'
        )
      }
    }
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null)
    const file = e.target.files?.[0]

    // Reset input value so selecting the same file again triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    // Requirement: Canceling the system picker is not an error; previous preview is preserved
    if (!file) {
      return
    }

    // Requirement: Denial or invalid file produces an understandable message
    if (!file.type.startsWith('image/')) {
      setPhotoError('Selected file is not an image. Please choose an image file.')
      return
    }

    try {
      // Requirement: Selecting again replaces the draft image
      if (draftObjectUrlRef.current) {
        URL.revokeObjectURL(draftObjectUrlRef.current)
      }

      const objectUrl = URL.createObjectURL(file)
      draftObjectUrlRef.current = objectUrl
      setPhotoPreview(objectUrl)
      setPhotoFile(file)
    } catch (err) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : 'Unable to load selected photo. Please check permissions.'
      )
    }
  }

  const handleRemovePhoto = () => {
    setPhotoError(null)
    if (draftObjectUrlRef.current) {
      URL.revokeObjectURL(draftObjectUrlRef.current)
      draftObjectUrlRef.current = null
    }
    setPhotoPreview(null)
    setPhotoFile(null)
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

      let newlyStagedPhotoUri: string | undefined = undefined

      try {
        let finalImageUri: string | undefined = undefined

        if (photoPreview) {
          if (
            photoFile ||
            photoPreview.startsWith('blob:') ||
            photoPreview.startsWith('data:')
          ) {
            // Stage new photo in managed storage and verify availability
            newlyStagedPhotoUri = await savePhotoFile(
              photoFile ? { file: photoFile } : { dataUrl: photoPreview }
            )
            finalImageUri = newlyStagedPhotoUri
          } else {
            // Existing unchanged photo URI
            finalImageUri = photoPreview
          }
        } else {
          // Photo was removed or unset
          finalImageUri = undefined
        }

        try {
          await onSave({
            ...validation.normalizedData,
            image: finalImageUri,
          })
        } catch (saveErr) {
          // Requirement: If entry saving fails, rollback the newly staged photo
          if (newlyStagedPhotoUri) {
            await rollbackStagedPhoto(newlyStagedPhotoUri)
          }
          throw saveErr
        }
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

          {/* Photo Selection and Preview Field */}
          <div className="form-group form-photo-group">
            <label htmlFor="item-photo-input" className="form-label">
              <span>Photo</span>
            </label>
            <input
              ref={fileInputRef}
              id="item-photo-input"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              disabled={isSubmitting}
              onChange={handleFileSelect}
            />

            {photoPreview ? (
              <div className="form-photo-preview-wrapper">
                <img
                  src={photoPreview}
                  alt="Item photo preview"
                  className="form-photo-preview"
                />
                <div className="form-photo-actions">
                  <button
                    type="button"
                    className="form-photo-action-btn"
                    disabled={isSubmitting}
                    onClick={handleTakePhoto}
                  >
                    Take new photo
                  </button>
                  <button
                    type="button"
                    className="form-photo-action-btn"
                    disabled={isSubmitting}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose from gallery
                  </button>
                  <button
                    type="button"
                    className="form-photo-action-btn form-photo-remove-btn"
                    disabled={isSubmitting}
                    onClick={handleRemovePhoto}
                  >
                    Remove photo
                  </button>
                </div>
              </div>
            ) : (
              <div className="form-photo-empty-wrapper">
                <button
                  type="button"
                  className="form-photo-btn form-photo-camera-btn"
                  disabled={isSubmitting}
                  onClick={handleTakePhoto}
                >
                  <svg
                    className="form-photo-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>Take photo</span>
                </button>
                <button
                  type="button"
                  className="form-photo-btn form-photo-gallery-btn"
                  disabled={isSubmitting}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg
                    className="form-photo-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span>Choose from gallery</span>
                </button>
              </div>
            )}

            {photoError ? (
              <p id="item-photo-error" className="form-error-message" role="alert">
                {photoError}
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
