import { test, expect, type Page } from '@playwright/test'

/**
 * End-to-End Test Suite: Web Application with real IndexedDB adapter.
 *
 * Environment & Isolation:
 * - Each test runs in its own isolated browser context with an independent IndexedDB partition.
 * - Tests do not share state, do not depend on execution order, and prepare their own data.
 * - Real IndexedDB adapter is used without storage mocks.
 * - Note: This tests the browser application; it does NOT test the native Android app.
 */

async function ensureEmptyCollection(page: Page) {
  await page.goto('/')
  const startEmptyBtn = page.getByRole('button', {
    name: /Start with an empty collection/i,
  })

  try {
    await startEmptyBtn.waitFor({ state: 'visible', timeout: 3000 })
    await startEmptyBtn.click()
  } catch {
    // First launch screen was already completed in this context
  }

  // Confirm empty catalog state before proceeding
  const emptyNotice = page.getByText('There are no items in your collection yet')
  await expect(emptyNotice).toBeVisible()
}

test.describe('Collection End-to-End Scenarios', () => {
  test('Scenario: Start empty, add an item, change its name, find it, refresh and verify saved data', async ({
    page,
  }) => {
    // 1. Start with an empty collection
    await ensureEmptyCollection(page)

    // 2. Add an item
    const addItemBtn = page.getByRole('link', { name: /Add item/i }).first()
    await addItemBtn.click()
    await expect(page).toHaveURL(/\/items\/new/)

    const initialName = 'Antique Pocket Watch'
    const initialDesc = 'Mechanical pocket watch from 1920 with brass casing.'

    await page.locator('#item-name-input').fill(initialName)
    await page.locator('#item-description-input').fill(initialDesc)
    await page.getByRole('button', { name: /^Save$/i }).click()

    await expect(page).toHaveURL(/\/items\/item-/)
    await expect(page.locator('.detail-title')).toHaveText(initialName)
    await expect(page.locator('.detail-description')).toHaveText(initialDesc)

    // 3. Change its name
    await page.getByRole('link', { name: /^Edit$/i }).click()
    await expect(page).toHaveURL(/\/items\/.*\/edit/)

    const updatedName = 'Rare Golden Pocket Watch'
    await page.locator('#item-name-input').fill(updatedName)
    await page.getByRole('button', { name: /^Save$/i }).click()

    await expect(page).toHaveURL(/\/items\/item-/)
    await expect(page.locator('.detail-title')).toHaveText(updatedName)
    await expect(page.locator('.detail-description')).toHaveText(initialDesc)

    // 4. Find it via search
    await page.locator('.nav-back-link').click()
    await expect(page).toHaveURL('/')

    const searchInput = page.locator('#catalog-search-input')
    await expect(searchInput).toBeVisible()
    await searchInput.fill('Golden')

    const matchingCard = page.locator('.item-card', { hasText: updatedName })
    await expect(matchingCard).toBeVisible()
    await expect(page.locator('.item-card')).toHaveCount(1)

    // 5. Refresh in the same context
    await page.reload()

    // 6. Check saved data from real IndexedDB
    const persistedCard = page.locator('.item-card', { hasText: updatedName })
    await expect(persistedCard).toBeVisible()
    await expect(persistedCard).toContainText(updatedName)

    await persistedCard.click()
    await expect(page).toHaveURL(/\/items\/item-/)
    await expect(page.locator('.detail-title')).toHaveText(updatedName)
    await expect(page.locator('.detail-description')).toHaveText(initialDesc)
  })

  test('Scenario: Canceling edits leaves the entry unchanged', async ({ page }) => {
    // 1. Prepare own data: start empty and create an item
    await ensureEmptyCollection(page)

    const addItemBtn = page.getByRole('link', { name: /Add item/i }).first()
    await addItemBtn.click()
    await expect(page).toHaveURL(/\/items\/new/)

    const originalName = 'Untouched Jade Figurine'
    const originalDesc = 'Authentic Ming dynasty jade carving.'

    await page.locator('#item-name-input').fill(originalName)
    await page.locator('#item-description-input').fill(originalDesc)
    await page.getByRole('button', { name: /^Save$/i }).click()

    await expect(page).toHaveURL(/\/items\/item-/)
    await expect(page.locator('.detail-title')).toHaveText(originalName)
    await expect(page.locator('.detail-description')).toHaveText(originalDesc)

    // 2. Open edit view and type modifications
    await page.getByRole('link', { name: /^Edit$/i }).click()
    await expect(page).toHaveURL(/\/items\/.*\/edit/)

    await page.locator('#item-name-input').fill('Discarded Alteration')
    await page.locator('#item-description-input').fill('This draft text should not be saved.')

    // 3. Click Cancel button
    await page.getByRole('button', { name: /^Cancel$/i }).click()

    // Unsaved changes confirmation modal appears
    const confirmModal = page.locator('.modal-dialog')
    await expect(confirmModal).toBeVisible()
    await expect(confirmModal).toContainText('You have unsaved changes')

    // Confirm discarding changes
    await confirmModal.getByRole('button', { name: /Leave without saving/i }).click()

    // 4. Returns to details view: verify original data is completely unchanged
    await expect(page).toHaveURL(/\/items\/item-/)
    await expect(page.locator('.detail-title')).toHaveText(originalName)
    await expect(page.locator('.detail-description')).toHaveText(originalDesc)

    // 5. Verify catalog view as well
    await page.locator('.nav-back-link').click()
    await expect(page).toHaveURL('/')
    const itemCard = page.locator('.item-card', { hasText: originalName })
    await expect(itemCard).toBeVisible()
    await expect(page.locator('.item-card', { hasText: 'Discarded Alteration' })).toHaveCount(0)
  })

  test('Scenario: Deleting one of two identically named items preserves the other', async ({ page }) => {
    // 1. Prepare own data: start empty and create two identically named items
    await ensureEmptyCollection(page)

    const sharedName = 'Silver Roman Denarius'
    const descItem1 = 'Minted in Rome under Trajan, AD 110.'
    const descItem2 = 'Minted in Antioch under Hadrian, AD 125.'

    // Create item 1
    await page.getByRole('link', { name: /Add item/i }).first().click()
    await expect(page).toHaveURL(/\/items\/new/)
    await page.locator('#item-name-input').fill(sharedName)
    await page.locator('#item-description-input').fill(descItem1)
    await page.getByRole('button', { name: /^Save$/i }).click()
    await expect(page).toHaveURL(/\/items\/item-/)

    // Return to catalog to create item 2
    await page.locator('.nav-back-link').click()
    await expect(page).toHaveURL('/')

    // Create item 2
    await page.getByRole('link', { name: /\+ Add item/i }).click()
    await expect(page).toHaveURL(/\/items\/new/)
    await page.locator('#item-name-input').fill(sharedName)
    await page.locator('#item-description-input').fill(descItem2)
    await page.getByRole('button', { name: /^Save$/i }).click()
    await expect(page).toHaveURL(/\/items\/item-/)

    // Return to catalog and verify both items exist
    await page.locator('.nav-back-link').click()
    await expect(page).toHaveURL('/')

    const matchingCards = page.locator('.item-card', { hasText: sharedName })
    await expect(matchingCards).toHaveCount(2)
    await expect(page.locator('.item-card', { hasText: descItem1 })).toBeVisible()
    await expect(page.locator('.item-card', { hasText: descItem2 })).toBeVisible()

    // 2. Select and delete the first item
    await page.locator('.item-card', { hasText: descItem1 }).click()
    await expect(page).toHaveURL(/\/items\/item-/)
    await expect(page.locator('.detail-description')).toHaveText(descItem1)

    await page.getByRole('button', { name: /^Delete$/i }).click()
    const deleteModal = page.locator('.modal-dialog')
    await expect(deleteModal).toBeVisible()
    await expect(deleteModal).toContainText(sharedName)

    await deleteModal.getByRole('button', { name: /^Delete$/i }).click()

    // 3. Returns to catalog: verify the other item is preserved
    await expect(page).toHaveURL('/')

    // Exactly one item with sharedName remains
    await expect(page.locator('.item-card', { hasText: sharedName })).toHaveCount(1)

    // The preserved item is item 2 with descItem2
    const remainingCard = page.locator('.item-card', { hasText: descItem2 })
    await expect(remainingCard).toBeVisible()
    await expect(remainingCard).toContainText(sharedName)

    // Item 1 is no longer in the catalog
    await expect(page.locator('.item-card', { hasText: descItem1 })).toHaveCount(0)

    // 4. Reload page in the same context to verify persistence in real IndexedDB
    await page.reload()
    await expect(page.locator('.item-card', { hasText: sharedName })).toHaveCount(1)
    await expect(page.locator('.item-card', { hasText: descItem2 })).toBeVisible()
  })
})
