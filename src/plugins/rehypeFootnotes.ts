import type { Root } from 'hast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

export default function rehypeFootnotes(): ReturnType<Plugin<[], Root>> {
  return (tree, { data }) => {
    const { language, footnotesTitle } = data.astro?.frontmatter ?? {}
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
  }
}
