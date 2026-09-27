import type { APIRoute } from 'astro'

export const prerender = false

const server_url = 'https://waline.lyt0112.com'

export const GET: APIRoute = async ({ url }) => {
  const fresh = url.searchParams.get('fresh') === '1'
  const response = await fetch(`${server_url}/api/pageview_summary${fresh ? '?fresh=1' : ''}`)
  if (!response.ok) throw new Error(`Pageview summary failed: ${response.status}`)

  const summary = await response.json()
  return Response.json(summary, {
    headers: {
      'Cache-Control': fresh
        ? 'no-store'
        : 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'
    }
  })
}
