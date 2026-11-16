import { useEffect, useRef } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import './ConfirmModal.css'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Leave without saving',
  cancelLabel = 'Stay',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement
      // Focus the safe option (Cancel/Stay) by default
      cancelBtnRef.current?.focus()
    } else if (previousActiveElementRef.current) {
      // Restore focus to the trigger element when closed
      previousActiveElementRef.current.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Escape key closes modal (cancels leave)
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
      return
    }

    // Tab key focus trap between the two action buttons
    if (e.key === 'Tab') {
      const cancelBtn = cancelBtnRef.current
      const confirmBtn = confirmBtnRef.current

      if (!cancelBtn || !confirmBtn) return

      if (e.shiftKey) {
        if (document.activeElement === cancelBtn) {
          e.preventDefault()
          confirmBtn.focus()
        }
      } else {
        if (document.activeElement === confirmBtn) {
          e.preventDefault()
          cancelBtn.focus()
        }
      }
    }
  }

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel()
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
        className="modal-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-message"
      >
        <h2 id="modal-title" className="modal-title">
          {title}
        </h2>
        <p id="modal-message" className="modal-message">
          {message}
        </p>

        <div className="modal-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="modal-btn modal-btn-cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className="modal-btn modal-btn-confirm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
