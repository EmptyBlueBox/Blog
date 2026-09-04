import { getCollection, type CollectionEntry } from 'astro:content'

export type Post = CollectionEntry<'post'>
export type Language = 'en' | 'zh'
const translation_groups = new WeakMap<Post[], Map<string, Post[]>>()

export async function get_all_posts() {
  return getCollection('post', ({ data }) => !import.meta.env.PROD || !data.draft)
}

export function normalize_language(language: Post['data']['language']): Language {
  return language === 'en-US' ? 'en' : 'zh'
}

export function get_base_slug(id: string) {
  return id.replace(/-(en|zh)$/u, '')
}

export function group_translations(posts: Post[]) {
  if (!translation_groups.has(posts)) {
    const groups = new Map<string, Post[]>()
    for (const post of posts) {
      const slug = get_base_slug(post.id)
      if (!groups.has(slug)) groups.set(slug, [])
      groups.get(slug)!.push(post)
    }
    for (const group of groups.values()) {
      group.sort((a, b) => a.data.language.localeCompare(b.data.language))
    }
    translation_groups.set(posts, groups)
  }
  return translation_groups.get(posts)!
}

export function select_canonical_posts(posts: Post[]) {
  return [...group_translations(posts).values()].map((group) => group[0])
}

export async function get_canonical_posts() {
  return select_canonical_posts(await get_all_posts())
}

export function get_translation_info(post: Post, posts: Post[]) {
  const base_slug = get_base_slug(post.id)
  const group = group_translations(posts).get(base_slug)!
  return group.length > 1
    ? {
        base_slug,
        entries: group.map((entry) => ({
          entry,
          language: normalize_language(entry.data.language)
        }))
      }
    : null
}

export function get_entry_languages(post: Post, posts: Post[]) {
  return group_translations(posts)
    .get(get_base_slug(post.id))!
    .map((entry) => normalize_language(entry.data.language))
}

export function group_posts_by_year(posts: Post[]) {
  const groups = new Map<number, Post[]>()
  for (const post of posts) {
    const year = (post.data.updatedDate ?? post.data.publishDate).getFullYear()
    if (!groups.has(year)) groups.set(year, [])
    groups.get(year)!.push(post)
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0])
}

export function sort_posts(posts: Post[]) {
  return [...posts].sort(
    (a, b) =>
      (b.data.updatedDate ?? b.data.publishDate).getTime() -
      (a.data.updatedDate ?? a.data.publishDate).getTime()
  )
}

export function get_unique_tags(posts: Post[]) {
  return [...new Set(posts.flatMap((post) => post.data.tags))]
}

export function get_tag_counts(posts: Post[]) {
  const counts = new Map<string, number>()
  for (const tag of posts.flatMap((post) => post.data.tags)) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}
