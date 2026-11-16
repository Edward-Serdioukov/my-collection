import { useState, useEffect } from 'react'
import { resolveDisplayUrl } from '../storage/photoStorage'
import './SafeImage.css'

interface SafeImageProps {
  src?: string
  alt: string
  className?: string
  placeholderText?: string
}

export function SafeImage({
  src,
  alt,
  className = '',
  placeholderText = 'No image',
}: SafeImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [errorSrc, setErrorSrc] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    if (!src) {
      return
    }

    resolveDisplayUrl(src)
      .then((url) => {
        if (!isCancelled) {
          if (!url) {
            setErrorSrc(src)
          } else {
            setResolvedUrl(url)
          }
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setErrorSrc(src)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [src])

  const hasError = Boolean(src && errorSrc === src)

  // Case 1: No photo associated with the item
  if (!src) {
    return (
      <div
        className={`safe-image-placeholder ${className}`}
        aria-label="Image placeholder"
      >
        <svg
          className="safe-image-icon"
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
        <span className="safe-image-placeholder-text">{placeholderText}</span>
      </div>
    )
  }

  // Case 2: Photo file is missing, unreadable, or failed to decode
  if (hasError) {
    return (
      <div
        className={`safe-image-placeholder safe-image-unavailable ${className}`}
        aria-label="Photo unavailable"
      >
        <svg
          className="safe-image-icon safe-image-unavailable-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="9" x2="15" y2="15" />
          <line x1="15" y1="9" x2="9" y2="15" />
        </svg>
        <span className="safe-image-placeholder-text">Photo unavailable</span>
      </div>
    )
  }

  // Case 3: Waiting for display URL to resolve
  if (!resolvedUrl) {
    return (
      <div
        className={`safe-image-placeholder safe-image-loading ${className}`}
        aria-label="Loading image"
      >
        <svg
          className="safe-image-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
      </div>
    )
  }

  // Case 4: Resolved valid image
  return (
    <img
      src={resolvedUrl}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (src) setErrorSrc(src)
      }}
    />
  )
}
