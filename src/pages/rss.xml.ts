import type { AstroGlobal } from 'astro'
import mdx_renderer from '@astrojs/mdx/server.js'
import rss from '@astrojs/rss'
import { render, type CollectionEntry } from 'astro:content'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'

import { getCanonicalCollections, sortMDByDate } from '@/utils/collections'
import socialCard from '@/assets/og/social_card.jpg'
import { siteConfig } from '@/site-config'

const container = await AstroContainer.create()
container.addServerRenderer({ renderer: mdx_renderer })

const render_content = async (post: CollectionEntry<'post'>, site: URL) => {
  const url = new URL(`/blog/${post.id}`, site)
  return (
    await container.renderToString((await render(post)).Content, {
      request: new Request(url)
    })
  )
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gu, '')
    .replace(
      /<github-card\b[^>]*data-repo="([^"]+)"[^>]*>[\s\S]*?<\/github-card>/gu,
      (_, repo) => `<p><a href="https://github.com/${repo}">${repo}</a></p>`
    )
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gu, '')
    .replace(/<span class="language[^"]*"[^>]*>[\s\S]*?<\/span>/gu, '')
    .replace(/<pre\b[\s\S]*?<\/pre>/gu, (code) =>
      code.replace(/<\/?span\b[^>]*>/gu, '').replace(/\s(?:class|style|data-[\w-]+)="[^"]*"/gu, '')
    )
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gu, '')
    .replace(/\son[a-z]+="[^"]*"/gu, '')
    .replace(
      /\b(src|href)="(?!https?:|data:|mailto:|#)([^"]+)"/gu,
      (_, name, path) => `${name}="${new URL(path, url).href}"`
    )
}

const GET = async (context: AstroGlobal) => {
  const allPostsByDate = sortMDByDate(await getCanonicalCollections())
  const siteUrl = context.site ?? new URL(import.meta.env.SITE)

  return rss({
    trailingSlash: false,
    xmlns: { h: 'http://www.w3.org/TR/html4/' },
    stylesheet: '/scripts/pretty-feed-v3.xsl',

    title: siteConfig.title,
    description: siteConfig.description,
    site: import.meta.env.SITE,
    items: await Promise.all(
      allPostsByDate.map(async (post) => {
        const image = new URL(post.data.heroImage?.src.src ?? socialCard.src, siteUrl).href
        return {
          pubDate: post.data.publishDate,
          link: `/blog/${post.id}`,
          customData: `<h:img src="${image}" />`,
          content: await render_content(post, siteUrl),
          ...post.data
        }
      })
    )
  })
}

export { GET }
