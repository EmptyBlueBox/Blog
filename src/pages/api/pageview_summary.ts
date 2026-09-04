import type { APIRoute } from 'astro'

import {
  get_all_posts,
  get_base_slug,
  get_tag_counts,
  group_translations,
  normalize_language
} from '@/utils/collections'
import { siteConfig } from '@/site-config'

export const prerender = false

const static_paths = Object.keys(import.meta.glob('/src/pages/**/*.{astro,md,mdx}'))
  .filter((path) => !path.includes('[') && !path.endsWith('/404.astro'))
  .map(
    (path) =>
      path
        .replace('/src/pages', '')
        .replace(/\.(astro|md|mdx)$/u, '')
        .replace(/\/index$/u, '') || '/'
  )
  .map((path) => path.split('/').map(encodeURIComponent).join('/'))
const server_url = 'https://waline.lyt0112.com'
const cache_ttl = 5 * 60 * 1000
let paths: string[]
let cached_summary: { home: number; total: number; total_paths: number; received_paths: number }
let expires_at = 0

function get_paginated_paths(base: string, count: number) {
  return Array.from({ length: Math.ceil(count / siteConfig.blog.pageSize) }, (_, index) =>
    index ? `${base}/${index + 1}` : base
  )
}

export const GET: APIRoute = async ({ url }) => {
  const fresh = url.searchParams.get('fresh') === '1'
  if (fresh || expires_at <= Date.now()) {
    if (!paths) {
      const posts = await get_all_posts()
      const groups = [...group_translations(posts).values()]
      const canonical_posts = groups.map((group) => group[0])
      paths = [
        ...new Set([
          ...static_paths,
          ...get_paginated_paths('/blog', canonical_posts.length),
          ...['en', 'zh'].flatMap((language) =>
            get_paginated_paths(
              `/blog/${language}`,
              posts.filter((post) => normalize_language(post.data.language) === language).length
            )
          ),
          ...groups.map(
            (group) =>
              `/blog/${encodeURIComponent(
                group.length > 1 ? get_base_slug(group[0].id) : group[0].id
              )}`
          ),
          ...get_tag_counts(canonical_posts).flatMap(([tag, count]) =>
            get_paginated_paths(`/tags/${encodeURIComponent(tag)}`, count)
          )
        ])
      ]
    }
    const response = await fetch(
      `${server_url}/api/article?path=${encodeURIComponent(paths.join(','))}&type=time&lang=en-US`
    )
    const { data } = await response.json()
    const counts = new Map<string, number>(
      data.map((item: { time?: number }, index: number) => [paths[index], item.time ?? 0])
    )
    cached_summary = {
      home: counts.get('/') ?? 0,
      total: paths.reduce((sum, path) => sum + (counts.get(path) ?? 0), 0),
      total_paths: paths.length,
      received_paths: paths.filter((path) => counts.has(path)).length
    }
    expires_at = Date.now() + cache_ttl
  }
  return Response.json(cached_summary, {
    headers: {
      'Cache-Control': fresh
        ? 'no-store'
        : 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'
    }
  })
}
