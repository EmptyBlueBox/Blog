import type { APIRoute } from 'astro'

const DEXTERCAP_RRD_URLS = {
  rubikscube: 'https://cdn.lyt0112.com/Projects/DexterCap/RubiksCube-363-391.rrd',
  cuboid0: 'https://cdn.lyt0112.com/Projects/DexterCap/Cuboid_00-301-306.rrd',
  cuboid1: 'https://cdn.lyt0112.com/Projects/DexterCap/Cuboid_01-551-556.rrd',
  cuboid2: 'https://cdn.lyt0112.com/Projects/DexterCap/Cuboid_02-204-209.rrd'
} as const

/**
 * Proxies DexterCap `.rrd` files through the same origin to avoid browser CORS restrictions.
 *
 * Query parameters:
 * - key (string): One of `rubikscube`, `cuboid0`, `cuboid1`, `cuboid2`.
 *
 * @returns {Promise<Response>} Proxied `.rrd` response. (Type: Promise<Response>, Shape: N/A)
 */
export const GET: APIRoute = async ({ url }): Promise<Response> => {
  const key = url.searchParams.get('key')
  if (!key || !(key in DEXTERCAP_RRD_URLS)) {
    return new Response('Unknown RRD key.', { status: 404 })
  }

  const upstreamUrl = DEXTERCAP_RRD_URLS[key as keyof typeof DEXTERCAP_RRD_URLS]
  const upstreamResponse = await fetch(upstreamUrl)
  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return new Response('Upstream fetch failed.', { status: 502 })
  }

  const headers = new Headers()
  headers.set('content-type', 'application/octet-stream')

  const contentLength = upstreamResponse.headers.get('content-length')
  if (contentLength) headers.set('content-length', contentLength)

  const etag = upstreamResponse.headers.get('etag')
  if (etag) headers.set('etag', etag)

  const lastModified = upstreamResponse.headers.get('last-modified')
  if (lastModified) headers.set('last-modified', lastModified)

  headers.set('cache-control', 'public, max-age=31536000, immutable')

  return new Response(upstreamResponse.body, { status: 200, headers })
}
