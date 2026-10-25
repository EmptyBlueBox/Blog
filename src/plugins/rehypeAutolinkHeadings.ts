import { rehypeHeadingIds } from '@astrojs/markdown-remark'
import type { Element, ElementContent, Root } from 'hast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import type { VFile } from 'vfile'

const headingRank = (tag: string) =>
  tag.startsWith('h') && tag.length === 2 && +tag[1] >= 1 && +tag[1] <= 6

export default function rehypeAutolinkHeadings({
  properties = { ariaHidden: 'true', tabIndex: -1 },
  behavior = 'prepend',
  content = { type: 'text', value: '#' } as ElementContent
} = {}): ReturnType<Plugin<[], Root>> {
  const collectHeadings = rehypeHeadingIds() as (tree: Root, file: VFile) => void
  return (tree, file) => {
    const { language, footnotesTitle } = file.data.astro?.frontmatter ?? {}
    visit(tree, 'element', (node) => {
      if (node.properties.id === 'footnote-label') {
        node.properties.className = []
        node.children = [
          {
            type: 'text',
            value: footnotesTitle ?? (language === 'zh-CN' ? '参考资料' : 'References')
          }
        ]
      }
    })
    collectHeadings(tree, file)
    visit(tree, 'element', (node: Element) => {
      if (headingRank(node.tagName) && node.properties?.id) {
        const link: Element = {
          type: 'element',
          tagName: 'a',
          properties: { ...properties, href: `#${node.properties.id}` },
          children: Array.isArray(content) ? content : [content]
        }
        if (behavior === 'wrap') {
          node.children = [link]
        } else if (behavior === 'prepend') {
          node.children.unshift(link)
        } else if (behavior === 'append') {
          node.children.push(link)
        }
      }
    })
  }
}
