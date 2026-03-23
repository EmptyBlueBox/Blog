import type { CollectionEntry, CollectionKey } from 'astro:content'
import { getCollection } from 'astro:content'

type Collections<T extends CollectionKey> = CollectionEntry<T>[]

export type NormalizedLanguage = 'en' | 'zh' | 'unknown'

export interface TranslationEntry<T extends CollectionKey> {
  entry: CollectionEntry<T>
  normalizedLanguage: NormalizedLanguage
}

export interface TranslationInfo<T extends CollectionKey> {
  baseSlug: string
  entries: TranslationEntry<T>[]
}

const TRANSLATION_SUFFIX = /-(en|zh)$/i
const LANGUAGE_LABEL: Record<NormalizedLanguage, string> = {
  en: 'English',
  zh: 'Chinese',
  unknown: 'Unknown'
}

/** Note: this function filters out draft posts based on the environment */
export async function getAllCollections<T extends CollectionKey>(
  contentType: T = 'post' as T
): Promise<Collections<T>> {
  return (await getCollection(contentType, ({ data }: CollectionEntry<T>) => {
    return import.meta.env.PROD ? data.draft !== true : true
  })) as Collections<T>
}

/**
 * Normalize a frontmatter language tag to the internal two-letter code used for grouping translations.
 *
 * @param language string | undefined, shape=(), dtype=string: Optional BCP-47 language tag such as 'en-US'.
 * @returns NormalizedLanguage, shape=(), dtype=string: Two-letter normalized language code or 'unknown' when the tag is missing or unsupported.
 */
export function normalizeLanguage(language?: string | null): NormalizedLanguage {
  if (!language) return 'unknown'
  const value = language.toLowerCase()
  if (value.startsWith('en')) return 'en'
  if (value.startsWith('zh')) return 'zh'
  return 'unknown'
}

/**
 * Compute the translation grouping slug by stripping known language suffixes from a post slug.
 *
 * @param slug string, shape=(), dtype=string: Original slug from the content collection, e.g., 'retargeting-en'.
 * @returns string, shape=(), dtype=string: Base slug shared by all translations, e.g., 'retargeting'.
 */
export function getBaseSlugFromSlug(slug: string): string {
  const match = slug.match(TRANSLATION_SUFFIX)
  if (!match) return slug
  return slug.slice(0, -match[0].length)
}

/**
 * Group collection entries by their translation base slug.
 *
 * @param collections Collections<T>, shape=(N,), dtype=CollectionEntry: Collection entries that may contain translated variants.
 * @returns Map<string, CollectionEntry<T>[]>, shape=(), dtype=Map: Mapping from base slug to grouped collection entries.
 */
function groupCollectionsByBaseSlug<T extends CollectionKey>(collections: Collections<T>) {
  const groups = new Map<string, CollectionEntry<T>[]>()

  for (const entry of collections) {
    const baseSlug = getBaseSlugFromSlug(entry.slug)
    const group = groups.get(baseSlug)
    if (group) group.push(entry)
    else groups.set(baseSlug, [entry])
  }

  return groups
}

/**
 * Select the canonical entry inside a translation group, preferring English when present.
 *
 * @param entries Collections<T>, shape=(N,), dtype=CollectionEntry: Entries that belong to one translation group.
 * @returns CollectionEntry<T>, shape=(), dtype=CollectionEntry: Canonical entry for the group.
 */
function getCanonicalGroupEntry<T extends CollectionKey>(
  entries: Collections<T>
): CollectionEntry<T> {
  return entries.find((entry) => normalizeLanguage(entry.data.language) === 'en') ?? entries[0]
}

/**
 * Sort translation variants for UI display.
 *
 * @param entries Collections<T>, shape=(N,), dtype=CollectionEntry: Entries that belong to one translation group.
 * @returns TranslationEntry<T>[], shape=(N,), dtype=object: Translation entries sorted by preferred display order.
 */
function sortTranslationEntries<T extends CollectionKey>(
  entries: Collections<T>
): TranslationEntry<T>[] {
  return entries
    .map((entry) => ({
      entry,
      normalizedLanguage: normalizeLanguage(entry.data.language)
    }))
    .sort((a, b) => {
      if (a.normalizedLanguage === b.normalizedLanguage)
        return a.entry.slug.localeCompare(b.entry.slug)
      if (a.normalizedLanguage === 'en') return -1
      if (b.normalizedLanguage === 'en') return 1
      if (a.normalizedLanguage === 'unknown') return 1
      if (b.normalizedLanguage === 'unknown') return -1
      return a.entry.slug.localeCompare(b.entry.slug)
    })
}

/**
 * Select the canonical entry for each translation group, preferring English when available.
 *
 * @param collections Collections<T>, shape=(N,), dtype=CollectionEntry: Array of collection entries to deduplicate.
 * @returns Collections<T>, shape=(M,), dtype=CollectionEntry: Array containing a single canonical entry per translation group.
 */
export function selectCanonicalEntries<T extends CollectionKey>(
  collections: Collections<T>
): Collections<T> {
  return Array.from(groupCollectionsByBaseSlug(collections).values(), getCanonicalGroupEntry)
}

/**
 * Retrieve canonical collection entries by delegating to getAllCollections and applying translation deduplication.
 *
 * @param contentType CollectionKey, shape=(), dtype=string: Optional content collection key, defaults to 'post'.
 * @returns Promise<Collections<T>>, shape=(M,), dtype=CollectionEntry: Promise resolving to canonical collection entries.
 */
export async function getCanonicalCollections<T extends CollectionKey>(
  contentType: T = 'post' as T
): Promise<Collections<T>> {
  return selectCanonicalEntries(await getAllCollections(contentType))
}

/**
 * Collect translation metadata for a target entry, including every language variant within the same grouping.
 *
 * @param target CollectionEntry<T>, shape=(), dtype=CollectionEntry: Entry whose translations are queried.
 * @param collections Collections<T>, shape=(N,), dtype=CollectionEntry: Array of candidate entries to inspect for sibling translations.
 * @returns TranslationInfo<T> | null, shape=() or null: Translation metadata or null when no alternative language exists.
 */
export function getTranslationInfo<T extends CollectionKey>(
  target: CollectionEntry<T>,
  collections: Collections<T>
): TranslationInfo<T> | null {
  const baseSlug = getBaseSlugFromSlug(target.slug)
  const siblings = groupCollectionsByBaseSlug(collections).get(baseSlug)

  if (!siblings || siblings.length <= 1) return null

  return { baseSlug, entries: sortTranslationEntries(siblings) }
}

/**
 * Convert a normalized language identifier into a human-readable label for UI elements.
 *
 * @param language NormalizedLanguage, shape=(), dtype=string: Normalized language code obtained from normalizeLanguage.
 * @returns string, shape=(), dtype=string: Localized human-readable label such as 'English' or 'Chinese'.
 */
export function getLanguageLabel(language: NormalizedLanguage): string {
  return LANGUAGE_LABEL[language]
}

export function groupCollectionsByYear<T extends CollectionKey>(
  collections: Collections<T>
): [number, CollectionEntry<T>[]][] {
  const collectionsByYear = collections.reduce((groups, collection) => {
    const year = new Date(collection.data.updatedDate ?? collection.data.publishDate).getFullYear()
    const group = groups.get(year)
    if (group) group.push(collection)
    else groups.set(year, [collection])
    return groups
  }, new Map<number, Collections<T>>())

  return [...collectionsByYear.entries()].sort((a, b) => b[0] - a[0])
}

export function sortMDByDate<T extends CollectionKey>(collections: Collections<T>) {
  return collections.sort((a, b) => {
    const aDate = new Date(a.data.updatedDate ?? a.data.publishDate).valueOf()
    const bDate = new Date(b.data.updatedDate ?? b.data.publishDate).valueOf()
    return bDate - aDate
  })
}

/** Note: This function doesn't filter draft posts, pass it the result of getAllPosts above to do so. */
export function getAllTags<T extends CollectionKey>(collections: Collections<T>) {
  return collections.flatMap((collection) => [...collection.data.tags])
}

/** Note: This function doesn't filter draft posts, pass it the result of getAllPosts above to do so. */
export function getUniqueTags<T extends CollectionKey>(collections: Collections<T>) {
  return [...new Set(getAllTags(collections))]
}

/** Note: This function doesn't filter draft posts, pass it the result of getAllPosts above to do so. */
export function getUniqueTagsWithCount<T extends CollectionKey>(
  collections: Collections<T>
): [string, number][] {
  return [
    ...getAllTags(collections).reduce(
      (acc, t) => acc.set(t, (acc.get(t) || 0) + 1),
      new Map<string, number>()
    )
  ].sort((a, b) => b[1] - a[1])
}
