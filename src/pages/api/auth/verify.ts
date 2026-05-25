export const POST = () =>
  new Response(JSON.stringify({ success: false, message: 'Service unavailable' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' }
  })
