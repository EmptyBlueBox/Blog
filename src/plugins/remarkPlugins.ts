import type {
  Blockquote,
  FootnoteDefinition,
  Html,
  Link,
  ListItem,
  Node,
  Paragraph,
  Root
} from 'mdast'
import getReadingTime from 'reading-time'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

import toString from './mdastUtilToString'

export const remarkReadingTime: Plugin<[], Root> = function () {
  return function (tree, { data }) {
    const textOnPage = toString(tree)
    const readingTime = getReadingTime(textOnPage)
    // readingTime.text will give us minutes read as a friendly string,
    // i.e. "3 min read"
    const astroData = data as { astro: { frontmatter: { minutesRead: string } } }
    astroData.astro.frontmatter.minutesRead = readingTime.text
  }
}

export const remarkAddZoomable: Plugin<[{ className?: string }], Root> = function ({
  className = 'zoomable'
}) {
  return function (tree) {
    visit(tree, 'image', (node: Node) => {
      const imageNode = node as Node & { data?: { hProperties?: Record<string, string> } }
      imageNode.data = {
        hProperties: {
          ...imageNode.data?.hProperties,
          class: className
        }
      }
    })
  }
}

export const remarkLazyLoadImages: Plugin<[], Root> = function () {
  return function (tree) {
    visit(tree, (node) => {
      const imageNode = node as Node & {
        name?: string
        data?: { hProperties?: Record<string, string> }
        attributes?: { type: string; name: string; value: string }[]
      }

      if (imageNode.type === 'image') {
        imageNode.data = {
          hProperties: {
            ...imageNode.data?.hProperties,
            loading: 'lazy',
            decoding: 'async'
          }
        }
      }

      if ((imageNode.type === 'mdxJsxFlowElement' || imageNode.type === 'mdxJsxTextElement') && imageNode.name === 'img') {
        imageNode.attributes ??= []
        if (!imageNode.attributes.some((attribute) => attribute.type === 'mdxJsxAttribute' && attribute.name === 'loading')) {
          imageNode.attributes.push({ type: 'mdxJsxAttribute', name: 'loading', value: 'lazy' })
        }
        if (!imageNode.attributes.some((attribute) => attribute.type === 'mdxJsxAttribute' && attribute.name === 'decoding')) {
          imageNode.attributes.push({ type: 'mdxJsxAttribute', name: 'decoding', value: 'async' })
        }
      }
    })
  }
}

interface ArxivArticleInfo {
  title: string
  authors: string
  id: string
  url: string
}

export async function fetchArxivApi(id: string): Promise<ArxivArticleInfo> {
  const response = await fetch(`https://export.arxiv.org/api/query?id_list=${id}`)
  if (!response.ok) {
    throw new Error(
      `Arxiv API request failed: ${response.statusText}, https://export.arxiv.org/api/query?id_list=${id}`
    )
  }
  const text = await response.text()
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(text, 'application/xml')

  const entry = xmlDoc.getElementsByTagName('entry')[0]
  const title = entry.getElementsByTagName('title')[0].textContent || ''
  const authors = Array.from(entry.getElementsByTagName('author'))
    .map((author: Element) => author.getElementsByTagName('name')[0].textContent || '')
    .join(', ')

  return {
    title,
    authors,
    id,
    url: `https://arxiv.org/abs/${id}`
  }
}
const initArxivCard = async (
  node: Paragraph,
  index?: number,
  parent?: Root | Blockquote | FootnoteDefinition | ListItem
) => {
  if (
    node.type === 'paragraph' &&
    node.children.length === 1 &&
    node.children[0].type === 'link' &&
    index &&
    parent &&
    parent.type === 'root'
  ) {
    const link = node.children[0] as Link
    const match = link.url.match(/https:\/\/arxiv\.org\/(abs|pdf)\/(\d{4}\.\d+(?:v\d+)?)/)

    if (match) {
      const [, , id] = match
      try {
        const data = await fetchArxivApi(id)

        const newNode: Html = {
          type: 'html',
          value: `
  <a href="${data.url}" target="_blank" class="not-prose block my-4">
            <div
    class="arxiv-card flex flex-col items-center justify-center rounded-2xl bg-muted p-4 sm:flex-row sm:items-center [&_*]:!no-underline"
  >
    <div class="flex-grow">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h3
          class="mt-0 mb-1 text-center text-lg font-bold text-foreground sm:text-left"
        >
          ${data.title}
        </h3>
        <div class="flex items-center mt-2 sm:mt-0 mx-auto sm:mx-0">
          <span class="text-yellow-500 flex items-center">
            <svg class="w-4 h-4 mr-1">
              <use href="/icons/ui.svg#mingcute-paper-line"></use>
            </svg>
            ${data.id}
          </span>
        </div>
      </div>
      <p class="mt-2 text-sm text-muted-foreground">
         ${data.authors}
      </p>
    </div>
</div>
  </a>
          `
        }
        parent.children[index] = newNode
      } catch (err) {
        console.error('Error fetching Arxiv data:', err)
      }
    }
  }
}
export function remarkArxivCards() {
  return async function transformer(tree: Root) {
    const promises: Promise<void>[] = []
    visit(tree, 'paragraph', (node, index, parent) => {
      promises.push(initArxivCard(node, index, parent))
    })
    await Promise.all(promises)
    return tree
  }
}
