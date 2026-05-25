export const GET = () =>
  new Response(JSON.stringify({ message: 'Service unavailable' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' }
  })
