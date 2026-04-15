export type MenuLinks = { link: string; label: string }[]

export interface PaginationLink {
  url: string
  text?: string
  srLabel?: string
}

export interface SiteMeta {
  title: string
  description?: string
  ogImage?: string | undefined
  canonical?: string | undefined
  publishDate?: string | undefined
  updatedDate?: string | undefined
  lang?: string | undefined
  noindex?: boolean | undefined
  imagePreview?: 'none' | 'standard' | 'large' | undefined
  alternates?:
    | {
        href: string
        hreflang: string
      }[]
    | undefined
  structuredData?: Record<string, unknown> | Record<string, unknown>[] | undefined
}

export interface SocialLink {
  name:
    | 'coolapk'
    | 'telegram'
    | 'github'
    | 'bilibili'
    | 'twitter'
    | 'zhihu'
    | 'steam'
    | 'netease_music'
    | 'mail'
  url: string
}

export type ShareItem = 'weibo' | 'x' | 'bluesky'

export type CardListData = {
  title: string
  list: CardList
}

export type CardList = {
  title: string
  link?: string
  children?: CardList
}[]

export type TimelineEvent = {
  date: string
  content: string
}
