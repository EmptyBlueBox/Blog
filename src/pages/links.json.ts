import { links } from '@/data/links'

export const GET = () =>
  new Response(JSON.stringify(links), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })
