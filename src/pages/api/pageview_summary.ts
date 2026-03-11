import type { APIRoute } from 'astro'

import { siteConfig } from '@/site-config'
import {
  getAllCollections,
  getBaseSlugFromSlug,
  getCanonicalCollections,
  getUniqueTags
} from '@/utils/collections'

const CACHE_TTL_MS = 5 * 60 * 1000
const SERVER_URL = 'https://waline.lyt0112.com'
const STATIC_PAGE_FILES = Object.keys(import.meta.glob('/src/pages/**/*.{astro,md,mdx}'))
const CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'
const get_json_headers = (force_refresh: boolean) => ({
  'Content-Type': 'application/json',
  'Cache-Control': force_refresh ? 'no-store' : CACHE_CONTROL
})

let cached_paths: { expires_at: number; value: string[] } | null = null
let cached_summary: {
  expires_at: number
  value: { home: number; total: number; total_paths: number; received_paths: number }
} | null = null

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
  const relative_path = file_path
    .replace('/src/pages', '')
    .replace(/\.(astro|md|mdx)$/u, '')
  const route_segments = relative_path.split('/').filter(Boolean)

  if (!route_segments.length) return '/'
  if (route_segments.some((segment) => segment.startsWith('['))) return null
  if (route_segments[0] === '404') return null

  const normalized_segments = route_segments.at(-1) === 'index'
    ? route_segments.slice(0, -1)
    : route_segments

  if (!normalized_segments.length) return '/'
  return `/${normalized_segments.map((segment) => encodeURIComponent(segment)).join('/')}`
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
  return STATIC_PAGE_FILES.map((file_path) => get_static_page_path(file_path)).filter(
    (path): path is string => path !== null
  )
}

/**
 * Build pathname list for every blog post counter, merging translated routes into a shared base slug path.
 *
 * Parameters
 * ----------
 * None
 *
 * Returns
 * -------
 * Promise<string[]>, shape=(N,), dtype=string
 *     Public pathname list for blog post counters, using a shared base slug when multiple translations exist.
 */
async function get_blog_post_paths() {
  const posts = await getAllCollections()
  const group_sizes = new Map<string, number>()

  posts.forEach((post) => {
    const base_slug = getBaseSlugFromSlug(post.slug)
    group_sizes.set(base_slug, (group_sizes.get(base_slug) ?? 0) + 1)
  })

  return Array.from(new Set(posts.map((post) => {
    const base_slug = getBaseSlugFromSlug(post.slug)
    const slug = (group_sizes.get(base_slug) ?? 0) > 1 ? base_slug : post.slug
    return `/blog/${encodeURIComponent(slug)}`
  })))
}

/**
 * Build pathname list for blog pagination routes.
 *
 * Parameters
 * ----------
 * None
 *
 * Returns
 * -------
 * Promise<string[]>, shape=(N,), dtype=string
 *     Public pathname list for the blog index and every paginated blog listing page.
 */
async function get_blog_pagination_paths() {
  const posts = await getCanonicalCollections()
  const page_count = Math.ceil(posts.length / siteConfig.blog.pageSize)
  return Array.from({ length: page_count }, (_, index) => (index === 0 ? '/blog' : `/blog/${index + 1}`))
}

/**
 * Build pathname list for every generated tag page, including pagination.
 *
 * Parameters
 * ----------
 * None
 *
 * Returns
 * -------
 * Promise<string[]>, shape=(N,), dtype=string
 *     Public pathname list for tag landing pages and paginated tag archives.
 */
async function get_tag_page_paths() {
  const posts = await getCanonicalCollections()
  const tags = getUniqueTags(posts)

  return tags.flatMap((tag) => {
    const tagged_post_count = posts.filter((post) => post.data.tags.includes(tag)).length
    const page_count = Math.ceil(tagged_post_count / siteConfig.blog.pageSize)
    const tag_path = `/tags/${encodeURIComponent(tag)}`
    return Array.from(
      { length: page_count },
      (_, index) => (index === 0 ? tag_path : `${tag_path}/${index + 1}`)
    )
  })
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
  const [blog_pagination_paths, blog_post_paths, tag_page_paths] = await Promise.all([
    get_blog_pagination_paths(),
    get_blog_post_paths(),
    get_tag_page_paths()
  ])

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
  if (cached_paths && cached_paths.expires_at > Date.now()) {
    return cached_paths.value
  }

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
    `${SERVER_URL}/api/article?path=${encodeURIComponent(paths.join(','))}&type=${encodeURIComponent('time')}&lang=en-US`
  )
  const payload = await response.json()
  const counts = new Map<string, number>()

  if (Array.isArray(payload.data)) {
    payload.data.forEach((item: { path?: string; time?: number }, index: number) => {
      const path = item.path ?? paths[index]
      counts.set(path, typeof item.time === 'number' ? item.time : 0)
    })
  }

  return counts
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
 * Promise<{ home: number; total: number; total_paths: number; received_paths: number }>, shape=(), dtype=object
 *     Homepage count, site total, page count, and number of paths returned by Waline.
 */
async function fetch_summary(paths: string[]) {
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
 * None
 *
 * Returns
 * -------
 * Promise<{ home: number; total: number; total_paths: number; received_paths: number }>, shape=(), dtype=object
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
      return new Response(JSON.stringify({
        home: cached_summary.value.home,
        total_paths: cached_summary.value.total_paths,
        received_paths: cached_summary.value.received_paths > 0 ? 1 : 0
      }), { headers: get_json_headers(force_refresh) })
    }

    const counts = await fetch_count_map(['/'])
    return new Response(JSON.stringify({
      home: counts.get('/') ?? 0,
      total_paths: paths.length,
      received_paths: counts.has('/') ? 1 : 0
    }), { headers: get_json_headers(force_refresh) })
  }

  if (scope === 'batch') {
    const offset = Number(url.searchParams.get('offset') ?? '0') || 0
    const limit = Number(url.searchParams.get('limit') ?? '16') || 16
    const batch_paths = paths.slice(offset, offset + limit)
    const counts = await fetch_count_map(batch_paths)

    return new Response(JSON.stringify({
      total: batch_paths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0),
      home: batch_paths.includes('/') ? (counts.get('/') ?? 0) : null,
      total_paths: paths.length,
      requested_paths: batch_paths.length,
      received_paths: batch_paths.filter((path) => counts.has(path)).length
    }), { headers: get_json_headers(force_refresh) })
  }

  const summary = await get_cached_summary(force_refresh)

  return new Response(JSON.stringify(summary), {
    headers: get_json_headers(force_refresh)
  })
}
