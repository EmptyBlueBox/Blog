// @ts-check

import { readdirSync } from 'node:fs'
import { unified } from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import vercelServerless from '@astrojs/vercel'
import { transformerNotationDiff, transformerNotationHighlight } from '@shikijs/transformers'
import tailwindcss from '@tailwindcss/vite'
import icon from 'astro-icon'
import { defineConfig } from 'astro/config'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

import rehypeAutolinkHeadings from './src/plugins/rehypeAutolinkHeadings.ts'
import { remarkImages, remarkReadingTime } from './src/plugins/remarkPlugins.ts'
import {
  addCopyButton,
  addLanguage,
  addTitle,
  updateStyle
} from './src/plugins/shikiTransformers.ts'
import { integrationConfig, siteConfig } from './src/site.config.ts'

const post_ids = readdirSync(new URL('./src/content/post', import.meta.url))
  .filter((file) => /\.(md|mdx)$/u.test(file))
  .map((file) => file.replace(/\.(md|mdx)$/u, ''))
const redirects = Object.fromEntries(
  [...new Set(post_ids.map((id) => id.replace(/-(en|zh)$/u, '')))]
    .filter((id) => !post_ids.includes(id))
    .map((id) => [
      `/blog/${id}`,
      `/blog/${post_ids.includes(`${id}-en`) ? `${id}-en` : `${id}-zh`}`
    ])
)

export default defineConfig({
  site: siteConfig.site,
  trailingSlash: 'never',
  output: 'static',
  redirects,

  adapter: vercelServerless(),

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
    plugins: [
      tailwindcss(),
      {
        name: 'rerun-cdn-wasm',
        enforce: 'pre',
        transform(code, id) {
          if (!id.endsWith('/@rerun-io/web-viewer/index.js')) return
          return code.replace(
            /const url = base_url[\s\S]*?;/,
            'const url = new URL("./re_viewer_bg.wasm", base_url);'
          )
        }
      }
    ],
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
      include: ['@waline/client', 'mermaid'],
      exclude: ['@rerun-io/web-viewer']
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
        [remarkImages, { zoomable: integrationConfig.mediumZoom.enable }]
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
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: { className: ['anchor', "after:content-['#']"] },
            content: { type: 'text', value: '' }
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
        transformerNotationDiff({ matchAlgorithm: 'v1' }),
        transformerNotationHighlight({ matchAlgorithm: 'v1' }),
        updateStyle(),
        addTitle(),
        addLanguage(),
        addCopyButton(2000)
      ]
    }
  }
})
