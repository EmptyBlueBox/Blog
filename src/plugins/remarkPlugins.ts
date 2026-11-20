import type { Node, Root } from 'mdast'
import type { Plugin } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

import { cdnImageFromUrl } from '../data/cdn.ts'

const sizes = 'min(100vw - 2rem, 65ch)'
const han = /\p{Script=Han}/gu
const skipped = new Set(['code', 'math', 'mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression'])

export const remarkReadingTime: Plugin<[], Root> = function () {
  return function (tree, { data }) {
    let text = ''
    let images = 0
    let seconds = 0
    visit(tree, (node) => {
      if (skipped.has(node.type)) return SKIP
      if (node.type === 'image' || ('name' in node && node.name === 'img')) {
        seconds += Math.max(12 - images++, 3)
      }
      if ('value' in node) text += ` ${node.value}`
    })
    const chars = text.match(han)?.length ?? 0
    const words = text.replace(han, ' ').match(/[\p{L}\p{N}]\S*/gu)?.length ?? 0
    seconds += (words / 230 + chars / 350) * 60
    const astroData = data as { astro: { frontmatter: { minutesRead: string } } }
    astroData.astro.frontmatter.minutesRead = `${Math.max(Math.ceil(seconds / 60), 1)} min read`
  }
}

const hanLatinGap = /(?<=\p{Script=Han})(?=[A-Za-z0-9])|(?<=[A-Za-z0-9])(?=\p{Script=Han})/gu

export const remarkHanLatinSpacing: Plugin<[], Root> = function () {
  return function (tree) {
    visit(tree, (node, index, parent) => {
      if (node.type === 'text') node.value = node.value.replace(hanLatinGap, ' ')
      if (node.type === 'inlineCode') {
        const prev = parent!.children[index! - 1]
        const next = parent!.children[index! + 1]
        if (prev?.type === 'text' && /\p{Script=Han}$/u.test(prev.value)) prev.value += ' '
        if (next?.type === 'text' && /^\p{Script=Han}/u.test(next.value))
          next.value = ` ${next.value}`
      }
    })
  }
}

export const remarkImages: Plugin<[{ zoomable: boolean }], Root> = function ({ zoomable }) {
  return function (tree) {
    visit(tree, (node) => {
      const imageNode = node as Node & {
        name?: string
        url?: string
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
