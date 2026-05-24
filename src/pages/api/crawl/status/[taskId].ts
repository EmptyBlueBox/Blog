import type { APIRoute } from 'astro'

const BACKEND_BASE = 'http://39.96.200.9:8000'

export const GET: APIRoute = async ({ params }) => {
  const response = await fetch(`${BACKEND_BASE}/api/crawl/status/${params.taskId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
