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

export async function getAllCollections<T extends CollectionKey>(
  contentType: T = 'post' as T
): Promise<Collections<T>> {
  return (await getCollection(contentType, ({ data }: CollectionEntry<T>) => {
    return import.meta.env.PROD ? data.draft !== true : true
  })) as Collections<T>
}

export function normalizeLanguage(language?: string | null): NormalizedLanguage {
  if (!language) return 'unknown'
  const value = language.toLowerCase()
  if (value.startsWith('en')) return 'en'
  if (value.startsWith('zh')) return 'zh'
  return 'unknown'
}

export function getBaseSlugFromId(entryId: string): string {
  const match = entryId.match(TRANSLATION_SUFFIX)
  if (!match) return entryId
  return entryId.slice(0, -match[0].length)
}

function groupCollectionsByBaseSlug<T extends CollectionKey>(collections: Collections<T>) {
  const groups = new Map<string, CollectionEntry<T>[]>()

  for (const entry of collections) {
    const baseSlug = getBaseSlugFromId(entry.id)
    const group = groups.get(baseSlug)
    if (group) group.push(entry)
    else groups.set(baseSlug, [entry])
  }

  return groups
}

function getCanonicalGroupEntry<T extends CollectionKey>(
  entries: Collections<T>
): CollectionEntry<T> {
  return entries.find((entry) => normalizeLanguage(entry.data.language) === 'en') ?? entries[0]
}

function sortTranslationEntries<T extends CollectionKey>(
  entries: Collections<T>
): TranslationEntry<T>[] {
  return entries
    .map((entry) => ({
      entry,
      normalizedLanguage: normalizeLanguage(entry.data.language)
    }))
    .sort((a, b) => {
      if (a.normalizedLanguage === b.normalizedLanguage) return a.entry.id.localeCompare(b.entry.id)
      if (a.normalizedLanguage === 'en') return -1
      if (b.normalizedLanguage === 'en') return 1
      if (a.normalizedLanguage === 'unknown') return 1
      if (b.normalizedLanguage === 'unknown') return -1
      return a.entry.id.localeCompare(b.entry.id)
    })
}

export function selectCanonicalEntries<T extends CollectionKey>(
  collections: Collections<T>
): Collections<T> {
  return Array.from(groupCollectionsByBaseSlug(collections).values(), getCanonicalGroupEntry)
}

export async function getCanonicalCollections<T extends CollectionKey>(
  contentType: T = 'post' as T
): Promise<Collections<T>> {
  return selectCanonicalEntries(await getAllCollections(contentType))
}

export function getTranslationInfo<T extends CollectionKey>(
  target: CollectionEntry<T>,
  collections: Collections<T>
): TranslationInfo<T> | null {
  const baseSlug = getBaseSlugFromId(target.id)
  const siblings = groupCollectionsByBaseSlug(collections).get(baseSlug)

  if (!siblings || siblings.length <= 1) return null

  return { baseSlug, entries: sortTranslationEntries(siblings) }
}

export function get_entry_languages<T extends CollectionKey>(
  target: CollectionEntry<T>,
  collections: Collections<T>
) {
  return (
    getTranslationInfo(target, collections)?.entries.map(
      ({ normalizedLanguage }) => normalizedLanguage
    ) ?? [normalizeLanguage(target.data.language)]
  )
}

export function getLanguageLabel(language: NormalizedLanguage): string {
  return LANGUAGE_LABEL[language]
}

export function getEntryLanguageTag<T extends CollectionKey>(entry: CollectionEntry<T>): string {
  if (entry.data.language) return entry.data.language
  const normalizedLanguage = normalizeLanguage(entry.data.language)
  if (normalizedLanguage === 'zh') return 'zh-CN'
  if (normalizedLanguage === 'en') return 'en-US'
  return 'en-US'
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

export function getAllTags<T extends CollectionKey>(collections: Collections<T>) {
  return collections.flatMap((collection) => [...collection.data.tags])
}

export function getUniqueTags<T extends CollectionKey>(collections: Collections<T>) {
  return [...new Set(getAllTags(collections))]
}

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
