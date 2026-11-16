import { useState, useRef, useEffect } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import type { ImportValidationSuccess } from '../storage/importCollection'
import './ImportModal.css'

interface ImportModalProps {
  isOpen: boolean
  currentCount: number
  pendingImport: ImportValidationSuccess | null
  onConfirm: () => Promise<void>
  onCancel: () => void
  onExportCurrent: () => void
}

export function ImportModal({
  isOpen,
  currentCount,
  pendingImport,
  onConfirm,
  onCancel,
  onExportCurrent,
}: ImportModalProps) {
  const [isReplacing, setIsReplacing] = useState<boolean>(false)
  const [replaceError, setReplaceError] = useState<string | null>(null)
  const [hasExported, setHasExported] = useState<boolean>(false)

  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Focus the safe option (Cancel) by default
      cancelBtnRef.current?.focus()
    }
  }, [isOpen])

  if (!isOpen || !pendingImport) return null

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !isReplacing) {
      e.preventDefault()
      onCancel()
    }
  }

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isReplacing) {
      onCancel()
    }
  }

  const handleExportClick = () => {
    onExportCurrent()
    setHasExported(true)
  }

  const handleConfirmClick = async () => {
    if (isReplacing) return
    setIsReplacing(true)
    setReplaceError(null)

    try {
      await onConfirm()
      // Success handled by parent closing modal
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to replace collection. Please try again.'
      setReplaceError(msg)
      setIsReplacing(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="modal-dialog import-modal-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
      >
        <h2 id="import-modal-title" className="modal-title">
          Replace collection with imported data?
        </h2>

        <div className="import-modal-content">
          <p className="import-modal-warning">
            This will <strong>fully replace</strong> your current collection without merging.
          </p>

          <div className="import-counts-card">
            <div className="import-count-row">
              <span className="import-count-label">Current collection items:</span>
              <span className="import-count-value">{currentCount}</span>
            </div>
            <div className="import-count-row">
              <span className="import-count-label">Items to be imported:</span>
              <span className="import-count-value import-count-new">{pendingImport.itemCount}</span>
            </div>
          </div>

          <div className="import-export-suggestion">
            <p className="import-suggestion-text">
              We strongly recommend exporting your current collection first before proceeding.
            </p>
            <button
              type="button"
              className="import-export-btn"
              disabled={isReplacing}
              onClick={handleExportClick}
            >
              {hasExported ? '✓ Current collection exported' : 'Export current collection first'}
            </button>
          </div>

          {pendingImport.unsupportedFields.length > 0 ? (
            <div className="import-unsupported-fields-card" role="note">
              <h3 className="import-unsupported-title">Unsupported fields detected:</h3>
              <p className="import-unsupported-desc">
                The imported file contains properties not defined in schema version{' '}
                {pendingImport.schemaVersion}:{' '}
                <strong>{pendingImport.unsupportedFields.join(', ')}</strong>.
                These fields are not part of the schema and will be discarded upon replacement.
              </p>
            </div>
          ) : null}

          <p className="import-photos-notice">
            {pendingImport.hasExcludedPhotos
              ? 'Note: Image files are excluded from text imports. Unportable photo references in this file were omitted to prevent broken image links.'
              : 'Note: Photos are not included in text export or import.'}
          </p>

          {replaceError ? (
            <div className="import-error-banner" role="alert">
              <p className="import-error-text">{replaceError}</p>
            </div>
          ) : null}
        </div>

        <div className="modal-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="modal-btn modal-btn-cancel"
            disabled={isReplacing}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="modal-btn modal-btn-confirm"
            disabled={isReplacing}
            onClick={handleConfirmClick}
          >
            {isReplacing ? 'Replacing...' : 'Replace collection'}
          </button>
        </div>
      </div>
    </div>
  )
}
