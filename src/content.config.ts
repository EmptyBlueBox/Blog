import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const post = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/post' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(100),
      description: z.string().min(10).max(160),
      footnotesTitle: z.string().optional(),
      publishDate: z
        .string()
        .or(z.date())
        .transform((value) => new Date(value)),
      updatedDate: z
        .string()
        .or(z.date())
        .optional()
        .transform((value) => (value ? new Date(value) : undefined)),
      heroImage: z
        .object({
          src: z.union([
            image(),
            z.object({
              src: z.url(),
              width: z.number(),
              height: z.number(),
              format: z.enum(['jpeg', 'jpg', 'png', 'apng', 'tiff', 'webp', 'gif', 'svg', 'avif'])
            })
          ]),
          cdn: z.url().optional(),
          alt: z.string(),
          color: z.string().optional()
        })
        .optional(),
      draft: z.boolean().default(false),
      tags: z
        .array(z.string())
        .default([])
        .transform((tags) => Array.from(new Set(tags))),
      language: z.enum(['en-US', 'zh-CN'])
    })
})

export const collections = { post }
