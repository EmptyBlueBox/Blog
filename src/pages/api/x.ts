import type { APIRoute } from 'astro'

const X_PROFILE_BASE = 'https://r.jina.ai/https://x.com'
const FOLLOWER_REGEX = /\[(?<count>[^\]]+) Followers\]/i

function parseFollowerCount(raw?: string | null) {
  if (!raw) return null

  const normalized = raw.replace(/,/g, '').trim()
  const suffix = normalized.slice(-1).toUpperCase()
  const hasSuffix = ['K', 'M', 'B'].includes(suffix)

  if (hasSuffix) {
    const value = Number.parseFloat(normalized.slice(0, -1))
    if (Number.isNaN(value)) return null

    const multiplier = suffix === 'K' ? 1_000 : suffix === 'M' ? 1_000_000 : 1_000_000_000
    return Math.round(value * multiplier)
  }

  const value = Number.parseFloat(normalized)
  if (Number.isNaN(value)) return null

  return Math.round(value)
}

export const GET: APIRoute = async ({ url }) => {
  const username = url.searchParams.get('username')?.trim()

  if (!username) {
    return new Response(JSON.stringify({ error: 'username is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  try {
    const response = await fetch(`${X_PROFILE_BASE}/${encodeURIComponent(username)}`)

    if (!response.ok) {
      throw new Error(`X profile responded with status ${response.status}`)
    }

    const html = await response.text()
    const match = FOLLOWER_REGEX.exec(html)

    if (!match) {
      throw new Error('Failed to locate follower count in profile markup')
    }

    const count = parseFollowerCount(match.groups?.count ?? match[1])

    if (count === null) {
      throw new Error('Unable to parse follower count value')
    }

    return new Response(JSON.stringify({ count }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600'
      }
    })
  } catch (error) {
    console.error('Error fetching X follower count:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch X follower count' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}
