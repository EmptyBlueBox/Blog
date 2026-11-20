import type { Element, ElementContent, Root, Text } from 'hast'
import type { VFile } from 'vfile'

type Parent = Root | Element

const opening = '“（《「『【〔〖'
const closing = '”）》」』】〕〗，。、：；！？'
const inline = new Set([
  'a',
  'abbr',
  'b',
  'cite',
  'del',
  'em',
  'i',
  'mark',
  's',
  'small',
  'span',
  'strong',
  'sup',
  'u'
])
const skipped = new Set(['code', 'kbd', 'pre', 'script', 'style', 'svg'])

export default function rehypePunctuationSqueeze() {
  return (tree: Root, file: VFile) => {
    if (file.data.astro?.frontmatter?.language !== 'zh-CN') return
    const halts = new Map<Text, Set<number>>()
    let prev: { node: Text; index: number; char: string } | undefined

    const halt = (node: Text, index: number) => {
      if (!halts.has(node)) halts.set(node, new Set())
      halts.get(node)!.add(index)
    }

    const walk = (parent: Parent) => {
      for (const child of parent.children) {
        if (child.type === 'text') {
          for (let index = 0; index < child.value.length; index++) {
            const char = child.value[index]
            if (prev && opening.includes(char) && (opening + closing).includes(prev.char)) {
              halt(child, index)
            } else if (prev && closing.includes(char) && closing.includes(prev.char)) {
              halt(prev.node, prev.index)
            }
            prev = { node: child, index, char }
          }
        } else if (child.type === 'element' && inline.has(child.tagName)) {
          walk(child)
        } else {
          prev = undefined
          if ('children' in child && !(child.type === 'element' && skipped.has(child.tagName))) {
            walk(child as Parent)
          }
          prev = undefined
        }
      }
    }

    const split = (parent: Parent) => {
      parent.children = parent.children.flatMap((child): ElementContent[] => {
        if ('children' in child) split(child as Parent)
        if (child.type !== 'text' || !halts.has(child)) return [child as ElementContent]
        const indexes = halts.get(child)!
        const pieces: ElementContent[] = []
        let start = 0
        for (const index of [...indexes].sort((a, b) => a - b)) {
          if (index > start) pieces.push({ type: 'text', value: child.value.slice(start, index) })
          pieces.push({
            type: 'element',
            tagName: 'span',
            properties: { className: ['halt'] },
            children: [{ type: 'text', value: child.value[index] }]
          })
          start = index + 1
        }
        if (start < child.value.length)
          pieces.push({ type: 'text', value: child.value.slice(start) })
        return pieces
      }) as Root['children']
    }

    walk(tree)
    split(tree)
  }
}
