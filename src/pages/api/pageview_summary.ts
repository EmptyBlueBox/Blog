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

const get_json_headers = (force_refresh: boolean) => ({
  'Content-Type': 'application/json',
  'Cache-Control': force_refresh ? 'no-store' : CACHE_CONTROL
})

const json = (body: unknown, force_refresh: boolean) =>
  new Response(JSON.stringify(body), { headers: get_json_headers(force_refresh) })

let cached_paths: { expires_at: number; value: string[] } | null = null
let cached_summary: { expires_at: number; value: SummaryPayload } | null = null

/**
 * Convert a static page source file into its public pathname.
 *
 * Parameters
 * ----------
 * file_path : string, shape=(), dtype=string
 *     Absolute source file path returned by import.meta.glob.
 *
 * Returns
 * -------
 * string | null, shape=() or null, dtype=string
 *     Public pathname or null when the file does not map to a routable page.
 */
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

/**
 * Build the list of filesystem-backed static page paths.
 *
 * Parameters
 * ----------
 * None
 *
 * Returns
 * -------
 * string[], shape=(N,), dtype=string
 *     Static page pathnames derived from src/pages source files.
 */
function get_static_page_paths() {
  return STATIC_PAGE_FILES.map(get_static_page_path).filter((path): path is string => path !== null)
}

/**
 * Build paginated pathnames for a list page.
 *
 * Parameters
 * ----------
 * base_path : string, shape=(), dtype=string
 *     Base pathname such as ``"/blog"`` or ``"/tags/foo"``.
 * item_count : number, shape=(), dtype=number
 *     Number of items paginated under the base pathname.
 *
 * Returns
 * -------
 * string[], shape=(N,), dtype=string
 *     Ordered paginated pathnames with page 1 mapped to the base pathname.
 */
function get_paginated_paths(base_path: string, item_count: number) {
  const page_count = Math.ceil(item_count / siteConfig.blog.pageSize)
  return Array.from({ length: page_count }, (_, index) =>
    index === 0 ? base_path : `${base_path}/${index + 1}`
  )
}

/**
 * Build the pathname list used by the homepage summary widget.
 *
 * Parameters
 * ----------
 * None
 *
 * Returns
 * -------
 * Promise<string[]>, shape=(N,), dtype=string
 *     Unique pathname list covering all current site pages and canonical blog post counters.
 */
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
    new Set([
      ...get_static_page_paths(),
      ...blog_pagination_paths,
      ...blog_post_paths,
      ...tag_page_paths
    ])
  )

  return ['/', ...paths.filter((path) => path !== '/').sort()]
}

/**
 * Read the cached pathname list or rebuild it when expired.
 *
 * Parameters
 * ----------
 * None
 *
 * Returns
 * -------
 * Promise<string[]>, shape=(N,), dtype=string
 *     Stable pathname list used by the homepage summary widget.
 */
async function get_cached_summary_paths() {
  if (cached_paths && cached_paths.expires_at > Date.now()) return cached_paths.value

  const value = await get_summary_paths()
  cached_paths = { expires_at: Date.now() + CACHE_TTL_MS, value }
  return value
}

/**
 * Fetch Waline pageview counters for a pathname list.
 *
 * Parameters
 * ----------
 * paths : string[], shape=(N,), dtype=string
 *     Ordered pathname list that should be aggregated into a homepage summary.
 *
 * Returns
 * -------
 * Promise<Map<string, number>>, shape=(), dtype=Map
 *     Mapping from pathname to received pageview count.
 */
async function fetch_count_map(paths: string[]) {
  const response = await fetch(
    `${SERVER_URL}/api/article?path=${encodeURIComponent(paths.join(','))}&type=time&lang=en-US`
  )
  const payload = await response.json()

  return new Map<string, number>(
    (payload.data as { path?: string; time?: number }[]).map((item, index) => [
      item.path ?? paths[index],
      typeof item.time === 'number' ? item.time : 0
    ])
  )
}

/**
 * Fetch the homepage summary payload for a pathname list.
 *
 * Parameters
 * ----------
 * paths : string[], shape=(N,), dtype=string
 *     Ordered pathname list that should be aggregated into a homepage summary.
 *
 * Returns
 * -------
 * Promise<SummaryPayload>, shape=(), dtype=object
 *     Homepage count, site total, page count, and number of paths returned by Waline.
 */
async function fetch_summary(paths: string[]): Promise<SummaryPayload> {
  const counts = await fetch_count_map(paths)

  return {
    home: counts.get('/') ?? 0,
    total: paths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0),
    total_paths: paths.length,
    received_paths: paths.filter((path) => counts.has(path)).length
  }
}

/**
 * Read the cached summary or refresh it from Waline when expired.
 *
 * Parameters
 * ----------
 * force_refresh : boolean, shape=(), dtype=boolean
 *     When true, bypass the in-memory summary cache.
 *
 * Returns
 * -------
 * Promise<SummaryPayload>, shape=(), dtype=object
 *     Cached or freshly fetched homepage summary payload.
 */
async function get_cached_summary(force_refresh = false) {
  if (!force_refresh && cached_summary && cached_summary.expires_at > Date.now()) {
    return cached_summary.value
  }

  const value = await fetch_summary(await get_cached_summary_paths())
  cached_summary = { expires_at: Date.now() + CACHE_TTL_MS, value }
  return value
}

/**
 * Serve the cached homepage pageview summary payload.
 *
 * Parameters
 * ----------
 * None
 *
 * Returns
 * -------
 * Promise<Response>, shape=(), dtype=Response
 *     JSON response containing homepage or site-wide pageview summary data.
 */
export const GET: APIRoute = async ({ url }) => {
  const scope = url.searchParams.get('scope')
  const force_refresh = url.searchParams.get('fresh') === '1'
  const paths = await get_cached_summary_paths()

  if (scope === 'home') {
    if (!force_refresh && cached_summary && cached_summary.expires_at > Date.now()) {
      return json(
        {
          home: cached_summary.value.home,
          total_paths: cached_summary.value.total_paths,
          received_paths: cached_summary.value.received_paths > 0 ? 1 : 0
        },
        force_refresh
      )
    }

    const counts = await fetch_count_map(['/'])
    return json(
      {
        home: counts.get('/') ?? 0,
        total_paths: paths.length,
        received_paths: counts.has('/') ? 1 : 0
      },
      force_refresh
    )
  }

  if (scope === 'batch') {
    const offset = Number(url.searchParams.get('offset') ?? '0') || 0
    const limit = Number(url.searchParams.get('limit') ?? '16') || 16
    const batch_paths = paths.slice(offset, offset + limit)
    const counts = await fetch_count_map(batch_paths)

    return json(
      {
        total: batch_paths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0),
        home: batch_paths.includes('/') ? (counts.get('/') ?? 0) : null,
        total_paths: paths.length,
        requested_paths: batch_paths.length,
        received_paths: batch_paths.filter((path) => counts.has(path)).length
      },
      force_refresh
    )
  }

  return json(await get_cached_summary(force_refresh), force_refresh)
}
