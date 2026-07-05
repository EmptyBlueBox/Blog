import type { APIRoute } from 'astro'

import { getAllCollections, getBaseSlugFromId, selectCanonicalEntries } from '@/utils/collections'
import { siteConfig } from '@/site-config'

const CACHE_TTL_MS = 5 * 60 * 1000
const SERVER_URL = 'https://waline.lyt0112.com'
const STATIC_PAGE_FILES = Object.keys(import.meta.glob('/src/pages/**/*.{astro,md,mdx}'))
const CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'

type SummaryPayload = {
  home: number
  total: number
  total_paths: number
  received_paths: number
}

const json = (body: unknown, force_refresh: boolean) =>
  new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': force_refresh ? 'no-store' : CACHE_CONTROL
    }
  })

let cached_paths: { expires_at: number; value: string[] } | null = null
let cached_summary: { expires_at: number; value: SummaryPayload } | null = null

function get_static_page_path(file_path: string) {
  const route_segments = file_path
    .replace('/src/pages', '')
    .replace(/\.(astro|md|mdx)$/u, '')
    .split('/')
    .filter(Boolean)

  if (!route_segments.length) return '/'
  if (route_segments[0] === '404' || route_segments.some((segment) => segment.startsWith('[')))
    return null

  const normalized_segments =
    route_segments.at(-1) === 'index' ? route_segments.slice(0, -1) : route_segments

  return normalized_segments.length
    ? `/${normalized_segments.map((segment) => encodeURIComponent(segment)).join('/')}`
    : '/'
}

function get_paginated_paths(base_path: string, item_count: number) {
  const page_count = Math.ceil(item_count / siteConfig.blog.pageSize)
  return Array.from({ length: page_count }, (_, index) =>
    index === 0 ? base_path : `${base_path}/${index + 1}`
  )
}

async function get_summary_paths() {
  const all_posts = await getAllCollections()
  const canonical_posts = selectCanonicalEntries(all_posts)
  const translation_group_sizes = new Map<string, number>()
  const tag_counts = new Map<string, number>()

  for (const post of all_posts) {
    const base_slug = getBaseSlugFromId(post.id)
    translation_group_sizes.set(base_slug, (translation_group_sizes.get(base_slug) ?? 0) + 1)
  }

  for (const post of canonical_posts) {
    for (const tag of post.data.tags) {
      tag_counts.set(tag, (tag_counts.get(tag) ?? 0) + 1)
    }
  }

  const static_page_paths = STATIC_PAGE_FILES.map(get_static_page_path).filter(
    (path): path is string => path !== null
  )
  const blog_pagination_paths = get_paginated_paths('/blog', canonical_posts.length)
  const blog_post_paths = Array.from(
    new Set(
      all_posts.map((post) => {
        const base_slug = getBaseSlugFromId(post.id)
        const slug = (translation_group_sizes.get(base_slug) ?? 0) > 1 ? base_slug : post.id
        return `/blog/${encodeURIComponent(slug)}`
      })
    )
  )
  const tag_page_paths = Array.from(tag_counts.entries()).flatMap(([tag, count]) =>
    get_paginated_paths(`/tags/${encodeURIComponent(tag)}`, count)
  )
  const paths = Array.from(
    new Set([...static_page_paths, ...blog_pagination_paths, ...blog_post_paths, ...tag_page_paths])
  )

  return ['/', ...paths.filter((path) => path !== '/').sort()]
}

async function get_cached_summary_paths() {
  if (cached_paths && cached_paths.expires_at > Date.now()) return cached_paths.value

  const value = await get_summary_paths()
  cached_paths = { expires_at: Date.now() + CACHE_TTL_MS, value }
  return value
}

async function fetch_summary(paths: string[]): Promise<SummaryPayload> {
  const response = await fetch(
    `${SERVER_URL}/api/article?path=${encodeURIComponent(paths.join(','))}&type=time&lang=en-US`
  )
  const payload = await response.json()
  const counts = new Map<string, number>(
    (payload.data as { path?: string; time?: number }[]).map((item, index) => [
      item.path ?? paths[index],
      typeof item.time === 'number' ? item.time : 0
    ])
  )

  return {
    home: counts.get('/') ?? 0,
    total: paths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0),
    total_paths: paths.length,
    received_paths: paths.filter((path) => counts.has(path)).length
  }
}

async function get_cached_summary(force_refresh = false) {
  if (!force_refresh && cached_summary && cached_summary.expires_at > Date.now()) {
    return cached_summary.value
  }

  const value = await fetch_summary(await get_cached_summary_paths())
  cached_summary = { expires_at: Date.now() + CACHE_TTL_MS, value }
  return value
}

export const GET: APIRoute = async ({ url }) => {
  const force_refresh = url.searchParams.get('fresh') === '1'
  return json(await get_cached_summary(force_refresh), force_refresh)
}
