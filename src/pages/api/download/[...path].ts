import type { APIRoute } from 'astro'

const BACKEND_BASE = 'http://39.96.200.9:8000'

export const GET: APIRoute = async ({ params }) => {
  const response = await fetch(`${BACKEND_BASE}/api/download/${params.path}`)
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream'
  })
  const contentDisposition = response.headers.get('content-disposition')
  if (contentDisposition) headers.set('Content-Disposition', contentDisposition)

  return new Response(response.body, { headers, status: response.status })
}
