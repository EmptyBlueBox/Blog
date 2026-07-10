// @ts-check

import { readdirSync } from 'node:fs'

import { rehypeHeadingIds, unified } from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import vercelServerless from '@astrojs/vercel'
import tailwindcss from '@tailwindcss/vite'
import icon from 'astro-icon'
import { defineConfig } from 'astro/config'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

import rehypeAutolinkHeadings from './src/plugins/rehypeAutolinkHeadings.ts'
import {
  remarkAddZoomable,
  remarkLazyLoadImages,
  remarkReadingTime
} from './src/plugins/remarkPlugins.ts'
import {
  addCopyButton,
  addLanguage,
  addTitle,
  transformerNotationDiff,
  transformerNotationHighlight,
  updateStyle
} from './src/plugins/shikiTransformers.ts'
import { integrationConfig, siteConfig } from './src/site.config.ts'

const post_ids = readdirSync(new URL('./src/content/post', import.meta.url))
  .filter((file) => /\.(md|mdx)$/u.test(file))
  .map((file) => file.replace(/\.(md|mdx)$/u, ''))
const redirects = Object.fromEntries(
  [...new Set(post_ids.map((id) => id.replace(/-(en|zh)$/u, '')))]
    .filter((id) => !post_ids.includes(id))
    .map((id) => [`/blog/${id}`, `/blog/${post_ids.includes(`${id}-en`) ? `${id}-en` : `${id}-zh`}`])
)

export default defineConfig({
  site: siteConfig.site,
  trailingSlash: 'never',
  output: 'static',
  redirects,

  adapter: vercelServerless(),

  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        limitInputPixels: false,
        webp: { quality: 85, effort: 6 },
        avif: { quality: 80, effort: 9 },
        jpeg: { quality: 85, progressive: true },
        png: { compressionLevel: 9, progressive: true }
      }
    },
    remotePatterns: []
  },

  integrations: [
    sitemap(),
    mdx(),
    icon({
      iconDir: 'src/icons'
    })
  ],

  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover'
  },

  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        ignored: ['**/src/icons/**']
      }
    },
    build: {
      rollupOptions: {
        output: {
          chunkFileNames: (chunkInfo) => {
            const { name } = chunkInfo
            if (name?.includes('node_modules')) {
              return 'vendor/[name]-[hash].js'
            }
            return 'chunks/[name]-[hash].js'
          }
        }
      }
    },
    optimizeDeps: {
      include: ['@waline/client'],
      exclude: ['mermaid', '@rerun-io/web-viewer']
    }
  },
  server: {
    host: true
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkReadingTime,
        remarkMath,
        remarkLazyLoadImages,
        ...(integrationConfig.mediumZoom.enable ? [remarkAddZoomable] : [])
      ],
      rehypePlugins: [
        [rehypeKatex, {}],
        [
          rehypeExternalLinks,
          {
            ...(siteConfig.content.externalLinkArrow && { content: { type: 'text', value: ' ↗' } }),
            target: '_blank',
            rel: ['nofollow', 'noopener', 'noreferrer']
          }
        ],
        rehypeHeadingIds,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: { className: ['anchor'] },
            content: { type: 'text', value: '#' }
          }
        ]
      ]
    }),
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      },
      transformers: [
        transformerNotationDiff(),
        transformerNotationHighlight(),
        updateStyle(),
        addTitle(),
        addLanguage(),
        addCopyButton(2000)
      ]
    }
  }
})
