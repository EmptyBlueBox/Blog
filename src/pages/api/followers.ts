import type { APIRoute } from 'astro'

export const prerender = false

const browser_headers = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
}
const get_json = async (url: string) => (await fetch(url, { headers: browser_headers })).json()

const sources: Record<string, ((id: string) => Promise<number>)[]> = {
  github: [
    async (id) => (await get_json(`https://api.github.com/users/${id}`)).followers,
    async (id) => (await get_json(`https://api.swo.moe/stats/github/${id}`)).count
  ],
  zhihu: [
    async (id) =>
      (await get_json(`https://www.zhihu.com/api/v4/members/${id}?include=follower_count`))
        .follower_count,
    async (id) => (await get_json(`https://api.swo.moe/stats/zhihu/${id}`)).count
  ],
  bilibili: [
    async (id) =>
      (await get_json(`https://api.bilibili.com/x/relation/stat?vmid=${id}`)).data.follower,
    async (id) =>
      (await get_json(`https://api.bilibili.com/x/web-interface/card?mid=${id}`)).data.card.fans
  ]
}

export const GET: APIRoute = async ({ url }) => {
  const id = encodeURIComponent(url.searchParams.get('id')!)
  for (const source of sources[url.searchParams.get('platform')!]) {
    try {
      const count = await source(id)
      if (Number.isFinite(count))
        return Response.json(
          { count },
          { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400' } }
        )
    } catch {
      continue
    }
  }
  return Response.json({}, { headers: { 'Cache-Control': 'public, s-maxage=60' } })
}
