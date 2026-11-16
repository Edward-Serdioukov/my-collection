import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import type { CollectionItem } from '../types/item'

export const MANAGED_PHOTO_PREFIX = 'managed:photos/'
export const PHOTOS_DIR = 'photos'

// In-memory backing store for web / jsdom test environments
const webPhotoStore = new Map<string, string>()

/**
 * Checks if a URI references an app-managed user photo.
 */
export function isManagedPhotoUri(uri?: string): boolean {
  return typeof uri === 'string' && uri.startsWith(MANAGED_PHOTO_PREFIX)
}

/**
 * Checks if an image URI is an immutable bundled asset.
 * Bundled resources must NEVER be deleted.
 */
export function isBundledPhoto(uri?: string): boolean {
  if (!uri || typeof uri !== 'string') return false
  return (
    uri.startsWith('bundled:') ||
    uri.startsWith('/assets/') ||
    uri.startsWith('/images/') ||
    uri.startsWith('data:image/svg+xml') ||
    uri.includes('demo-item')
  )
}

/**
 * Extracts the relative filename from a managed photo URI.
 */
export function getManagedFilename(uri: string): string {
  if (!isManagedPhotoUri(uri)) {
    throw new Error(`Invalid managed photo URI: ${uri}`)
  }
  return uri.slice(MANAGED_PHOTO_PREFIX.length)
}

/**
 * Helper to convert Blob or File to a base64 string.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Format: "data:image/jpeg;base64,..." -> extract base64 part
      const base64Index = result.indexOf(',')
      resolve(base64Index >= 0 ? result.slice(base64Index + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Stages and persists a new user photo file into the app's managed area.
 *
 * Requirements satisfied:
 * - Generates unique collision-resistant filename.
 * - Confirms availability on disk before returning.
 * - Returns managed URI ('managed:photos/<filename>'), NOT a temporary address.
 */
export async function savePhotoFile(
  input: { file?: File | Blob; dataUrl?: string; rawBase64?: string }
): Promise<string> {
  const extension = 'jpg'
  const uniqueName = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`
  const relativePath = `${PHOTOS_DIR}/${uniqueName}`

  let base64Data = ''
  if (input.file) {
    base64Data = await blobToBase64(input.file)
  } else if (input.dataUrl) {
    const commaIdx = input.dataUrl.indexOf(',')
    base64Data = commaIdx >= 0 ? input.dataUrl.slice(commaIdx + 1) : input.dataUrl
  } else if (input.rawBase64) {
    base64Data = input.rawBase64
  } else {
    throw new Error('No image data provided for saving.')
  }

  if (Capacitor.isNativePlatform()) {
    // 1. Write file to Directory.Data sandbox
    await Filesystem.writeFile({
      directory: Directory.Data,
      path: relativePath,
      data: base64Data,
      recursive: true,
    })

    // 2. Requirement: Check file is available before returning
    const stat = await Filesystem.stat({
      directory: Directory.Data,
      path: relativePath,
    })

    if (!stat || stat.size === 0) {
      throw new Error(`Failed to verify stored photo file: ${relativePath}`)
    }
  } else {
    // Web / Test fallback
    webPhotoStore.set(relativePath, base64Data)
    // Verification
    if (!webPhotoStore.has(relativePath)) {
      throw new Error(`Failed to store photo in web storage: ${relativePath}`)
    }
  }

  return `${MANAGED_PHOTO_PREFIX}${uniqueName}`
}

/**
 * Deletes a newly staged photo file if subsequent database saving fails (rollback).
 */
export async function rollbackStagedPhoto(photoUri?: string): Promise<void> {
  if (!isManagedPhotoUri(photoUri)) return

  try {
    const filename = getManagedFilename(photoUri!)
    const relativePath = `${PHOTOS_DIR}/${filename}`

    if (Capacitor.isNativePlatform()) {
      await Filesystem.deleteFile({
        directory: Directory.Data,
        path: relativePath,
      })
    } else {
      webPhotoStore.delete(relativePath)
    }
  } catch (err) {
    console.warn(`[photoStorage] Rollback failed for ${photoUri}:`, err)
  }
}

/**
 * Safely cleans up an unreferenced previous photo file.
 *
 * Requirements satisfied:
 * - Never deletes bundled resources.
 * - Checks if the file is used by any other items before deleting.
 * - Restricts deletion strictly to app managed photos area.
 */
export async function cleanupUnusedPhoto(
  photoUri?: string,
  allItems: CollectionItem[] = []
): Promise<boolean> {
  if (!photoUri || !isManagedPhotoUri(photoUri)) {
    // Never delete bundled resources or non-managed URIs
    return false
  }

  // Check if still used by ANY item in the collection
  const isUsedByOtherItems = allItems.some((item) => item.image === photoUri)
  if (isUsedByOtherItems) {
    // Still in use -> do not delete!
    return false
  }

  try {
    const filename = getManagedFilename(photoUri)
    const relativePath = `${PHOTOS_DIR}/${filename}`

    if (Capacitor.isNativePlatform()) {
      await Filesystem.deleteFile({
        directory: Directory.Data,
        path: relativePath,
      })
    } else {
      webPhotoStore.delete(relativePath)
    }
    return true
  } catch (err) {
    console.warn(`[photoStorage] Failed to cleanup ${photoUri}:`, err)
    return false
  }
}

/**
 * Resolves a persistent reference into a displayable URL for <img> tags.
 */
export async function resolveDisplayUrl(uri?: string): Promise<string | undefined> {
  if (!uri) return undefined

  if (!isManagedPhotoUri(uri)) {
    // Bundled, blob:, data:, or http URI -> return as-is
    return uri
  }

  const filename = getManagedFilename(uri)
  const relativePath = `${PHOTOS_DIR}/${filename}`

  if (Capacitor.isNativePlatform()) {
    const nativeUri = await Filesystem.getUri({
      directory: Directory.Data,
      path: relativePath,
    })
    return Capacitor.convertFileSrc(nativeUri.uri)
  } else {
    // Web / Test fallback
    const base64 = webPhotoStore.get(relativePath)
    return base64 ? `data:image/jpeg;base64,${base64}` : undefined
  }
}

/**
 * Utility for tests: inspects active web storage entries.
 */
export function getWebPhotoStoreEntry(relativePath: string): string | undefined {
  return webPhotoStore.get(relativePath)
}

/**
 * Utility for tests: clears web storage.
 */
export function clearWebPhotoStore(): void {
  webPhotoStore.clear()
}
