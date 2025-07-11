import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ url }) => {
  const vmid = url.searchParams.get('vmid')

  if (!vmid) {
    return new Response(JSON.stringify({ error: 'vmid is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  try {
    const response = await fetch(`https://api.bilibili.com/x/relation/stat?vmid=${vmid}`)
    if (!response.ok) {
      throw new Error(`Bilibili API responded with status ${response.status}`)
    }
    const data = await response.json()

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error(`Error fetching from Bilibili API:`, error)
    return new Response(JSON.stringify({ error: 'Failed to fetch from Bilibili API' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
} 