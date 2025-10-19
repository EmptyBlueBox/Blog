import type { APIRoute } from 'astro'

const ZHIHU_API_BASE = 'https://www.zhihu.com/api/v4/members'

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
    const directResponse = await fetch(
      `${ZHIHU_API_BASE}/${encodeURIComponent(username)}?include=follower_count`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          Referer: 'https://www.zhihu.com/'
        }
      }
    )

    if (directResponse.ok) {
      const data = await directResponse.json()
      return new Response(
        JSON.stringify({
          count: data.follower_count ?? null
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400'
          }
        }
      )
    }

    // Fallback: use jina.ai proxy to bypass Zhihu anti-crawling 403s
    const fallbackResponse = await fetch(
      `https://r.jina.ai/https://www.zhihu.com/api/v4/members/${encodeURIComponent(username)}?include=follower_count`
    )

    if (!fallbackResponse.ok) {
      throw new Error(`Zhihu fallback responded with status ${fallbackResponse.status}`)
    }

    const fallbackText = await fallbackResponse.text()
    const jsonStart = fallbackText.indexOf('{')
    const jsonEnd = fallbackText.lastIndexOf('}')
    let parsed: { follower_count?: number | null } = {}

    if (jsonStart !== -1 && jsonEnd !== -1) {
      try {
        parsed = JSON.parse(fallbackText.slice(jsonStart, jsonEnd + 1))
      } catch (parseError) {
        console.error('Error parsing Zhihu fallback payload:', parseError)
      }
    }

    if (parsed.follower_count === undefined) {
      throw new Error('Zhihu fallback response missing follower_count')
    }

    return new Response(
      JSON.stringify({ count: parsed.follower_count ?? null }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400'
        }
      }
    )
  } catch (error) {
    console.error('Error fetching from Zhihu API:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch from Zhihu API' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}
