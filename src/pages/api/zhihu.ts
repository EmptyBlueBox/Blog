import type { APIRoute } from 'astro'

const ZHIHU_API_BASE = 'https://www.zhihu.com/api/v4/members'

export const GET: APIRoute = async ({ url }) => {
  const username = url.searchParams.get('username')?.trim()
  const response = await fetch(
    `${ZHIHU_API_BASE}/${encodeURIComponent(username!)}?include=follower_count`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://www.zhihu.com/'
      }
    }
  )
  const data = await response.json()

  return new Response(JSON.stringify({ count: data.follower_count }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400'
    }
  })
}
