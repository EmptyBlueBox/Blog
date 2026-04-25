import type { APIRoute } from 'astro'

const BACKEND_BASE = 'http://39.96.200.9:8000'

/**
 * Proxy a crawler backend download and stream the file response.
 *
 * Parameters
 * ----------
 * params : Record<string, string | undefined>, shape=(), dtype=object
 *     Astro route parameters containing the catch-all download path.
 *
 * Returns
 * -------
 * Promise<Response>, shape=(), dtype=Response
 *     Streamed backend download response with selected file headers.
 */
export const GET: APIRoute = async ({ params }) => {
  const response = await fetch(`${BACKEND_BASE}/${params.path}`)
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
