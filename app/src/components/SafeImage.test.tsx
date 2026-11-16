import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { SafeImage } from './SafeImage'
import { ItemCard } from './ItemCard'
import { clearWebPhotoStore, MANAGED_PHOTO_PREFIX } from '../storage/photoStorage'
import type { CollectionItem } from '../types/item'
import { BrowserRouter } from 'react-router-dom'

describe('SafeImage Component', () => {
  beforeEach(() => {
    clearWebPhotoStore()
  })

  it('renders "No image" placeholder when src is missing or empty', () => {
    render(<SafeImage alt="Test item" />)

    const placeholder = screen.getByLabelText('Image placeholder')
    expect(placeholder).toBeTruthy()
    expect(screen.getByText('No image')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('renders "Photo unavailable" placeholder when managed file is missing in storage', async () => {
    // Managed URI that does not exist in photo storage
    render(
      <SafeImage
        src={`${MANAGED_PHOTO_PREFIX}missing_photo.jpg`}
        alt="Missing item"
      />
    )

    await waitFor(() => {
      const errorPlaceholder = screen.getByLabelText('Photo unavailable')
      expect(errorPlaceholder).toBeTruthy()
    })
    expect(screen.getByText('Photo unavailable')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('renders img element when src is bundled/valid and handles onError gracefully', async () => {
    render(<SafeImage src="/images/bundled-test.jpg" alt="Bundled item" />)

    // Initially resolves to img
    const img = await screen.findByRole('img')
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('/images/bundled-test.jpg')
    expect(img.getAttribute('alt')).toBe('Bundled item')
    expect(img.getAttribute('loading')).toBe('lazy')

    // Simulate img failing to decode or 404 (onError)
    fireEvent.error(img)

    // Switches to Photo unavailable placeholder
    await waitFor(() => {
      expect(screen.getByLabelText('Photo unavailable')).toBeTruthy()
    })
    expect(screen.getByText('Photo unavailable')).toBeTruthy()
  })

  it('preserves item text and structure when photo is unavailable (does not delete or hide entry)', async () => {
    const brokenItem: CollectionItem = {
      id: 'item-broken-1',
      title: 'Vintage Mechanical Watch',
      description: 'Rare 1968 chronometer in good condition.',
      image: `${MANAGED_PHOTO_PREFIX}deleted_file.jpg`,
      createdAt: 1704067200000,
      updatedAt: 1704067200000,
    }

    render(
      <BrowserRouter>
        <ItemCard item={brokenItem} />
      </BrowserRouter>
    )

    // Verify text is completely intact
    expect(screen.getByText('Vintage Mechanical Watch')).toBeTruthy()
    expect(screen.getByText('Rare 1968 chronometer in good condition.')).toBeTruthy()

    // Verify unavailable photo placeholder is shown
    await waitFor(() => {
      expect(screen.getByLabelText('Photo unavailable')).toBeTruthy()
    })

    // The card link remains navigable and valid
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/items/item-broken-1')
  })
})
