import type { APIRoute } from 'astro'

const sitemapPath = 'sitemap-index.xml'

const robotsTxt = `
User-agent: *
Allow: /

Sitemap: ${new URL(sitemapPath, import.meta.env.SITE).href}
`.trim()

export const GET: APIRoute = () =>
  new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  })
