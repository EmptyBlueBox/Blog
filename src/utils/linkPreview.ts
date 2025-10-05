const HEAD_SLICE_LIMIT = 60000

class LRU<K, V> extends Map<K, V> {
  constructor(private readonly maxSize: number) {
    super()
  }

  override get(key: K): V | undefined {
    const value = super.get(key)
    if (value) this.#touch(key, value)
    return value
  }

  override set(key: K, value: V): this {
    this.#touch(key, value)
    if (this.size > this.maxSize) {
      const firstKey = this.keys().next().value
      if (firstKey !== undefined) this.delete(firstKey)
    }
    return this
  }

  #touch(key: K, value: V): void {
    this.delete(key)
    super.set(key, value)
  }
}

const formatError = (...lines: string[]) => lines.join('\n         ')

interface AttributeMap {
  get(name: string): string | undefined
}

function parseAttributes(tag: string): AttributeMap {
  const attributes = new Map<string, string>()
  const attrRegex = /([a-zA-Z0-9:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  let match: RegExpExecArray | null
  while ((match = attrRegex.exec(tag))) {
    const name = match[1].toLowerCase()
    const raw = match[2] ?? match[3] ?? match[4] ?? ''
    attributes.set(name, raw)
  }
  return {
    get(name: string) {
      return attributes.get(name.toLowerCase())
    }
  }
}

function extractHead(html: string): string {
  const match = html.match(/<head[^>]*>[\s\S]*?<\/head>/i)
  if (match) return match[0]
  return html.slice(0, Math.min(html.length, HEAD_SLICE_LIMIT))
}

function parseMetaTags(html: string) {
  const byProperty = new Map<string, string>()
  const byName = new Map<string, string>()
  const metaRegex = /<meta\b[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = metaRegex.exec(html))) {
    const tag = match[0]
    const attrs = parseAttributes(tag)
    const content = attrs.get('content')
    if (!content) continue
    const property = attrs.get('property')
    if (property) byProperty.set(property.toLowerCase(), content)
    const name = attrs.get('name')
    if (name) byName.set(name.toLowerCase(), content)
  }
  return { byProperty, byName }
}

function extractCanonical(html: string) {
  const linkRegex = /<link\b[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = linkRegex.exec(html))) {
    const attrs = parseAttributes(match[0])
    const rel = attrs.get('rel')
    if (!rel) continue
    if (rel.split(/\s+/).some((value) => value.toLowerCase() === 'canonical')) {
      const href = attrs.get('href')
      if (href) return href
    }
  }
  return null
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? match[1] : undefined
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}

function decodeHtml(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|#\d+|[a-z]+);/gi, (full, entity) => {
    const lower = String(entity).toLowerCase()
    if (lower[0] === '#') {
      const codePoint = lower[1] === 'x' ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : full
    }
    return NAMED_ENTITIES[lower] ?? full
  })
}

function normalizeText(value?: string | null) {
  if (!value) return undefined
  const decoded = decodeHtml(value)
  const collapsed = decoded.replace(/\s+/g, ' ').trim()
  return collapsed.length ? collapsed : undefined
}

function urlOrNull(value: string | null | undefined, base: string) {
  if (!value) return null
  try {
    const resolved = new URL(value, base)
    return resolved.protocol === 'https:' ? resolved.href : null
  } catch {
    return null
  }
}

function makeSafeGetter<T>(
  handleResponse: (res: Response) => T | Promise<T>,
  { cacheSize = 1000 }: { cacheSize?: number } = {}
) {
  const cache = new LRU<string, T>(cacheSize)
  return async function safeGet(url: string): Promise<T | undefined> {
    try {
      const cached = cache.get(url)
      if (cached) return cached
      const response = await fetch(url)
      if (!response.ok)
        throw new Error(
          formatError(`Failed to fetch ${url}`, `Error ${response.status}: ${response.statusText}`)
        )
      const result = await handleResponse(response)
      cache.set(url, result)
      return result
    } catch (e) {
      console.error(formatError(`[error] astro-embed`, (e as Error)?.message ?? e, `URL: ${url}`))
      return undefined
    }
  }
}

const safeGetHead = makeSafeGetter(async (res) => extractHead(await res.text()))
// Keep legacy name for existing imports.
const safeGetDOM = safeGetHead

export async function parseOpenGraph(pageUrl: string) {
  const head = await safeGetHead(pageUrl)
  if (!head) return

  const { byName, byProperty } = parseMetaTags(head)

  const title =
    normalizeText(byProperty.get('og:title')) ??
    normalizeText(byName.get('twitter:title')) ??
    normalizeText(extractTitle(head))

  const description =
    normalizeText(byProperty.get('og:description')) ??
    normalizeText(byName.get('description'))

  const image =
    urlOrNull(byProperty.get('og:image:secure_url'), pageUrl) ??
    urlOrNull(byProperty.get('og:image:url'), pageUrl) ??
    urlOrNull(byProperty.get('og:image'), pageUrl)

  const imageAlt = normalizeText(byProperty.get('og:image:alt'))

  const video =
    urlOrNull(byProperty.get('og:video:secure_url'), pageUrl) ??
    urlOrNull(byProperty.get('og:video:url'), pageUrl) ??
    urlOrNull(byProperty.get('og:video'), pageUrl)

  const videoType = normalizeText(byProperty.get('og:video:type'))

  const canonical = urlOrNull(extractCanonical(head), pageUrl)
  const url = urlOrNull(byProperty.get('og:url'), pageUrl) ?? canonical ?? pageUrl

  return { title, description, image, imageAlt, url, video, videoType }
}

export { safeGetDOM }
