export const GET = () =>
  new Response(JSON.stringify({ status: 'failed', message: 'Service unavailable' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' }
  })
