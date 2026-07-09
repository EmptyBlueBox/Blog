import type { APIRoute } from 'astro'

export const prerender = false

const X_PROFILE_BASE = 'https://r.jina.ai/https://x.com'
const FOLLOWER_REGEX = /\[(?<count>[^\]]+) Followers\]/i
const multipliers: Record<string, number> = {
  K: 1_000,
  M: 1_000_000,
  B: 1_000_000_000
}
const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600'
}

export const GET: APIRoute = async ({ url }) => {
  const username = url.searchParams.get('username')?.trim()
  const html = await (await fetch(`${X_PROFILE_BASE}/${encodeURIComponent(username!)}`)).text()
  const match = FOLLOWER_REGEX.exec(html)
  if (!match) return new Response('{}', { headers })

  const raw = match.groups!.count.replace(/,/g, '').trim()
  const suffix = raw.at(-1)!.toUpperCase()
  const count = multipliers[suffix]
    ? Math.round(Number.parseFloat(raw.slice(0, -1)) * multipliers[suffix])
    : Math.round(Number.parseFloat(raw))

  return new Response(JSON.stringify({ count }), { headers })
}
