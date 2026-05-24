import type { APIRoute } from 'astro'

const BACKEND_BASE = 'http://39.96.200.9:8000'

export const POST: APIRoute = async ({ request }) => {
  const response = await fetch(`${BACKEND_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: await request.text()
  })

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
