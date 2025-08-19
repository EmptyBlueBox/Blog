// @ts-check

import { rehypeHeadingIds } from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwind from '@astrojs/tailwind'
// Adapter
import vercelServerless from '@astrojs/vercel'
// Integrations
import icon from 'astro-icon'
import { defineConfig } from 'astro/config'
// Rehype & remark packages
import rehypeExternalLinks from 'rehype-external-links'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

// Local rehype & remark plugins
import rehypeAutolinkHeadings from './src/plugins/rehypeAutolinkHeadings.ts'
// Markdown
import {
  remarkAddZoomable,
  remarkArxivCards,
  remarkReadingTime
} from './src/plugins/remarkPlugins.ts'
// Shiki
import {
  addCopyButton,
  addLanguage,
  addTitle,
  transformerNotationDiff,
  transformerNotationHighlight,
  updateStyle
} from './src/plugins/shikiTransformers.ts'
import { integrationConfig, siteConfig } from './src/site.config.ts'

// https://astro.build/config
export default defineConfig({
  // Top-Level Options
  site: siteConfig.site,
  // base: '/docs',
  trailingSlash: 'never',
  output: 'server',

  // Adapter
  // 1. Vercel (serverless)
  adapter: vercelServerless(),
  // 2. Vercel (static)
  // adapter: vercelStatic(),
  // 3. Local (standalone)
  // adapter: node({ mode: 'standalone' }),
  // ---

  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        limitInputPixels: false,
        // Optimize image compression for better performance
        webp: { quality: 85, effort: 6 },
        avif: { quality: 80, effort: 9 },
        jpeg: { quality: 85, progressive: true },
        png: { compressionLevel: 9, progressive: true }
      }
    },
    remotePatterns: []
  },

  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap(),
    mdx(),
    icon({
      iconDir: "src/icons"
    }),
    (await import('@playform/compress')).default({
      SVG: false,
      Exclude: ['index.*.js'],
      Image: true,
      CSS: true,
      HTML: true,
      JavaScript: true
    }),
  ],
  // root: './my-project-directory',

  // Prefetch Options
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'viewport'
  },

  // Vite optimizations for better performance
  vite: {
    server: {
      // Reduce file watching sensitivity for icons
      watch: {
        ignored: ['**/src/icons/**']
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor libraries into separate chunks
            'waline': ['@waline/client'],
            'mermaid': [], // External CDN, no need to bundle
            'search': ['@pagefind/default-ui']
          },
          // Optimize chunk naming for better caching
          chunkFileNames: (chunkInfo) => {
            const { name } = chunkInfo
            if (name?.includes('node_modules')) {
              return 'vendor/[name]-[hash].js'
            }
            return 'chunks/[name]-[hash].js'
          }
        }
      },
      // Enable source maps only in dev
      sourcemap: false,
      // Optimize for production
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info'],
          passes: 2
        }
      }
    },
    optimizeDeps: {
      include: ['@waline/client', '@pagefind/default-ui'],
      exclude: ['mermaid'] // Load from CDN
    }
  },
  // Server Options
  server: {
    host: true
  },
  // Markdown Options
  markdown: {
    remarkPlugins: [
      remarkReadingTime,
      remarkMath,
      remarkArxivCards,
      // @ts-expect-error - Use @ts-expect-error instead of @ts-ignore
      ...(integrationConfig.mediumZoom.enable
        ? [[remarkAddZoomable, integrationConfig.mediumZoom.options]] // Wrap in array to ensure it's iterable
        : [])
    ],
    rehypePlugins: [
      [rehypeKatex, {}],
      [
        rehypeExternalLinks,
        {
          ...(siteConfig.content.externalLinkArrow && { content: { type: 'text', value: ' ↗' } }),
          target: '_blank',
          rel: ['nofollow, noopener, noreferrer']
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
    ],
    // https://docs.astro.build/en/guides/syntax-highlighting/
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
