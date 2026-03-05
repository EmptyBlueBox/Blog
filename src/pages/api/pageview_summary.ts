import type { APIRoute } from 'astro'

import { getCanonicalCollections } from '@/utils/collections'

const CACHE_TTL_MS = 5 * 60 * 1000
const SERVER_URL = 'https://waline.lyt0112.com'
const MAIN_PATHS = [
  '/',
  '/about',
  '/archives',
  '/blog',
  '/links',
  '/projects',
  '/projects/DexterCap',
  '/projects/treehole',
  '/search',
  '/tags'
]

let cached_summary: { expires_at: number; value: { home: number; total: number } } | null = null

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
 *     Unique pathname list covering main pages and canonical blog posts.
 */
async function get_summary_paths() {
  const posts = await getCanonicalCollections()
  return Array.from(new Set([...MAIN_PATHS, ...posts.map((post) => `/blog/${post.slug}`)]))
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
 * Promise<{ home: number; total: number }>, shape=(), dtype=object
 *     Homepage count and aggregated total count for the requested paths.
 */
async function fetch_summary(paths: string[]) {
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

  return {
    home: counts.get('/') ?? 0,
    total: paths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0)
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
 * Promise<{ home: number; total: number }>, shape=(), dtype=object
 *     Cached or freshly fetched homepage summary payload.
 */
async function get_cached_summary() {
  if (cached_summary && cached_summary.expires_at > Date.now()) {
    return cached_summary.value
  }

  const value = await fetch_summary(await get_summary_paths())
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
 *     JSON response containing the homepage count and aggregated total count.
 */
export const GET: APIRoute = async () => {
  const summary = await get_cached_summary()

  return new Response(JSON.stringify(summary), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'
    }
  })
}
