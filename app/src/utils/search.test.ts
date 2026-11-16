import { describe, it, expect } from 'vitest'
import { filterItemsByTitle } from './search'
import type { CollectionItem } from '../types/item'

describe('Search rules (filterItemsByTitle)', () => {
  const sampleItems: CollectionItem[] = [
    { id: '1', title: 'Antique Pocket Watch', description: 'Gold plated' },
    { id: '2', title: 'Silver Roman Coin', description: 'Rare coin from Rome' },
    { id: '3', title: 'Vintage Stamp', description: 'Pocket watch picture on stamp' },
    { id: '4', title: 'Bronze Medal', description: 'Commemorative' },
  ]

  // Check 4: Case-insensitive search
  it('performs case-insensitive search matching any casing variant', () => {
    expect(filterItemsByTitle(sampleItems, 'roman')).toHaveLength(1)
    expect(filterItemsByTitle(sampleItems, 'ROMAN')).toHaveLength(1)
    expect(filterItemsByTitle(sampleItems, 'RoMaN')).toHaveLength(1)
  })

  // Check 5: Partial name search
  it('performs partial name matching anywhere within the title', () => {
    // Prefix
    expect(filterItemsByTitle(sampleItems, 'Ant')).toHaveLength(1)
    // Infix / middle substring
    expect(filterItemsByTitle(sampleItems, 'ocket')).toHaveLength(1)
    // Suffix
    expect(filterItemsByTitle(sampleItems, 'Watch')).toHaveLength(1)
  })

  it('ignores surrounding whitespace in search query', () => {
    const results = filterItemsByTitle(sampleItems, '   medal   ')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('4')
  })

  it('returns all items unchanged when query is empty or whitespace', () => {
    expect(filterItemsByTitle(sampleItems, '')).toEqual(sampleItems)
    expect(filterItemsByTitle(sampleItems, '   ')).toEqual(sampleItems)
  })

  it('searches only item titles and does not search descriptions', () => {
    // "Gold" is in item 1 description, but not in its title
    const results = filterItemsByTitle(sampleItems, 'Gold')
    expect(results).toHaveLength(0)

    // "Pocket watch" is in item 3 description, but only in item 1 title
    const watchResults = filterItemsByTitle(sampleItems, 'Pocket watch')
    expect(watchResults).toHaveLength(1)
    expect(watchResults[0].id).toBe('1')
  })

  it('preserves the original collection order', () => {
    // Both item 2 ("Silver") and item 3 ("Vintage") contain "v"
    const results = filterItemsByTitle(sampleItems, 'v')
    expect(results.map((i) => i.id)).toEqual(['2', '3'])
  })

  it('does not mutate the original collection array', () => {
    const clone = [...sampleItems]
    filterItemsByTitle(sampleItems, 'coin')
    expect(sampleItems).toEqual(clone)
  })
})
