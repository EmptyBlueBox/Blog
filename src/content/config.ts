import { defineCollection, z } from 'astro:content'

function dedupePreserveCase(array: string[]) {
  if (!array.length) return array
  // Keep original casing as authored in MDX while removing duplicates.
  // Use insertion order to preserve the author's order.
  return Array.from(new Set(array))
}

const post = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string().max(100),
      description: z.string().min(10).max(160),
      publishDate: z
        .string()
        .or(z.date())
        .transform((val) => new Date(val)),
      updatedDate: z
        .string()
        .optional()
        .transform((str) => (str ? new Date(str) : undefined)),
      heroImage: z
        .object({
          src: z.union([image(), z.string()]),
          alt: z.string().optional(),
          color: z.string().optional()
        })
        .optional(),
      draft: z.boolean().default(false),
      tags: z.array(z.string()).default([]).transform(dedupePreserveCase),
      language: z.string().optional()
    })
})

export const collections = { post }
