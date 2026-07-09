import type { APIRoute } from 'astro'

export const prerender = false

const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400'
}

export const GET: APIRoute = async ({ url }) => {
  const vmid = url.searchParams.get('vmid')
  const response = await fetch(
    `https://api.bilibili.com/x/relation/stat?vmid=${encodeURIComponent(vmid!)}`
  )
  return new Response(JSON.stringify(await response.json()), { headers })
}
