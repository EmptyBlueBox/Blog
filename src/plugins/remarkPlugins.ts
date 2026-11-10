import type { Node, Root } from 'mdast'
import { toString } from 'mdast-util-to-string'
import getReadingTime from 'reading-time'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

import { cdnImageFromUrl } from '../data/cdn.ts'

const sizes = 'min(100vw - 2rem, 65ch)'

export const remarkReadingTime: Plugin<[], Root> = function () {
  return function (tree, { data }) {
    const textOnPage = toString(tree)
    const readingTime = getReadingTime(textOnPage)
    const astroData = data as { astro: { frontmatter: { minutesRead: string } } }
    astroData.astro.frontmatter.minutesRead = readingTime.text
  }
}

export const remarkImages: Plugin<[{ zoomable: boolean }], Root> = function ({ zoomable }) {
  return function (tree) {
    visit(tree, (node) => {
      const imageNode = node as Node & {
        name?: string
        url?: string
        data?: { hProperties?: Record<string, string | number> }
        attributes?: { type: string; name: string; value: string }[]
      }

      if (imageNode.type === 'image') {
        const image = cdnImageFromUrl(imageNode.url!)
        imageNode.data = {
          hProperties: {
            ...imageNode.data?.hProperties,
            ...(image && { ...image, sizes }),
            loading: 'lazy',
            decoding: 'async',
            ...(zoomable && { class: 'zoomable' })
          }
        }
      }

      if (
        (imageNode.type === 'mdxJsxFlowElement' || imageNode.type === 'mdxJsxTextElement') &&
        imageNode.name === 'img'
      ) {
        imageNode.attributes ??= []
        const image = cdnImageFromUrl(
          imageNode.attributes.find(({ name }) => name === 'src')!.value
        )
        if (image) {
          imageNode.attributes = [
            ...imageNode.attributes.filter(({ name }) => name !== 'src'),
            ...Object.entries({ ...image, sizes }).map(([name, value]) => ({
              type: 'mdxJsxAttribute',
              name,
              value: String(value)
            }))
          ]
        }
        if (
          !imageNode.attributes.some(
            (attribute) => attribute.type === 'mdxJsxAttribute' && attribute.name === 'loading'
          )
        ) {
          imageNode.attributes.push({ type: 'mdxJsxAttribute', name: 'loading', value: 'lazy' })
        }
        if (
          !imageNode.attributes.some(
            (attribute) => attribute.type === 'mdxJsxAttribute' && attribute.name === 'decoding'
          )
        ) {
          imageNode.attributes.push({ type: 'mdxJsxAttribute', name: 'decoding', value: 'async' })
        }
      }
    })
  }
}
