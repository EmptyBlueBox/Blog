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

export interface SiteConfig {
  author: string
  title: string
  site: string
  description: string
  lang: string
  ogLocale: string
  date: {
    locale: string | string[] | undefined
    options: Intl.DateTimeFormatOptions
  }

  blog: {
    pageSize: number
  }

  seo: {
    telegramChannel?: string
  }

  content: {
    externalLinkArrow: boolean
  }
}

export interface FooterConfig {
  registration?: {
    url: string
    text: string
  }
  mengICP?: {
    url: string
    text: string
  }
  socialLinks: SocialLink[]
}

export interface IntegrationConfig {
  waline: {
    enable: boolean
    server?: string
    additionalConfigs: Record<string, unknown>
  }
  links: {
    logbook: TimelineEvent[]
    applyTip: {
      name: string
      desc: string
      url: string
      avatar: string
    }
  }
  typography: {
    class: string
  }
  mediumZoom: {
    enable: boolean
    selector: string
    options: Record<string, unknown>
  }
}
