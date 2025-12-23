import type { CardListData, FooterConfig, IntegrationConfig, MenuLinks, SiteConfig } from '@/types'

export const siteConfig: SiteConfig = {
  // === Required meta properties ===
  // Used as both a meta property (src/components/BaseHead.astro L:31 + L:49) & the generated satori png (src/pages/og-image/[slug].png.ts)
  author: 'Yutong Liang',
  // Meta property used to construct the meta title property, found in src/components/BaseHead.astro L:11
  title: 'Yutong\'s Site',
  // Meta property used to generate your sitemap and canonical URLs in your final build
  site: 'https://www.lyt0112.com/',
  // Meta property used as the default description meta property
  description: 'My compass is curiosity.',
  // HTML lang property, found in src/layouts/Base.astro L:18
  lang: 'en-US',
  // Meta property, found in src/components/BaseHead.astro L:42
  ogLocale: 'en_US',
  // Date.prototype.toLocaleDateString() parameters, found in src/utils/date.ts.
  date: {
    locale: 'en-US',
    options: {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
  },

  // Mirror (remove ending trailing slash)
  npmCDN: 'https://cdn.jsdelivr.net/npm',
  // Recommend:
  // - https://cdn.jsdelivr.net/npm
  // - https://cdn.smartcis.cn/npm
  // - https://unkpg.com
  // - https://cdn.cbd.int
  // - https://esm.sh

  // === Customize options ===
  blog: {
    pageSize: 8 // blog page size for pagination
  },

  seo: {
    // Telegram channel (Only to link with telegram instant view.
    // If you don't know what it is, you can ignore it)
    // telegramChannel: '@cworld0_cn'
  },
  content: {
    externalLinkArrow: true, // show external link arrow
    // Currently support weibo, x, bluesky
    share: ['x']
  }
}

// Footer configuration, which contains the registration and social links
// and will be used in Footer.astro
export const footerConfig: FooterConfig = {
  // Registration information for ICP (optional)
  // registration: {
  //   url: 'https://beian.miit.gov.cn/',
  //   text: '京ICP备2024065688号-1'
  // },
  // mengICP: {
  // url: 'https://icp.gov.moe/?keyword=20240125',
  // text: '萌ICP备20240125号'
  // },
  socialLinks: [
    {
      name: 'mail',
      url: 'mailto:lyt0112@outlook.com'
    },
    // {
    //   name: 'github',
    //   url: 'https://github.com/EmptyBlueBox'
    // }
  ]
}

export const integrationConfig: IntegrationConfig = {
  // Comment system
  waline: {
    enable: true,
    // Server service link
    server: 'https://waline.lyt0112.com',
    // Refer https://waline.js.org/en/guide/features/emoji.html
    emoji: ['bmoji', 'weibo'],
    // Refer https://waline.js.org/en/reference/client/props.html
    additionalConfigs: {
      // search: false,
      pageview: true,
      comment: true,
      locale: {
        reaction0: 'Like',
        placeholder: 'Welcome to comment. (Email to receive replies. Login is unnecessary)'
      },
      imageUploader: false
    }
  },
  links: {
    // Friend logbook
    logbook: [
        { date: '2025-08-06', content: 'Axi\'s Blog' },
        { date: '2025-01-25', content: 'Arles\' Café' },
        { date: '2024-11-30', content: 'CWorld Site' },
        { date: '2024-07-23', content: 'Ethan' },
        { date: '2024-05-13', content: 'Emoairx' },
        { date: '2024-05-01', content: 'Arthals\' ink' },
    ],
    // Yourself link info
    applyTip: {
      name: siteConfig.title,
      desc: siteConfig.description,
      url: siteConfig.site,
      avatar: siteConfig.site + 'favicon.ico'
    }
  },
  // Tailwindcss typography
  typography: {
    // https://github.com/tailwindlabs/tailwindcss-typography
    class: 'prose prose-pure dark:prose-invert dark:prose-pure prose-headings:font-medium'
  },
  // A lightbox library that can add zoom effect
  mediumZoom: {
    enable: true, // disable it will not load the whole library
    selector: '.prose .zoomable',
    options: {
      className: 'zoomable'
    }
  },
  // Add a random quote to the footer (default on homepage footer)
  quote: {
    // https://developer.hitokoto.cn/sentence/#%E8%AF%B7%E6%B1%82%E5%9C%B0%E5%9D%80
    // server: 'https://v1.hitokoto.cn/?c=i',
    // target: (data) => (data as { hitokoto: string }).hitokoto || 'Error'
    // https://github.com/lukePeavey/quotable
    server: 'https://api.quotable.io/quotes/random?maxLength=60',
    target: (data) => (data as { content: string }[])[0].content || 'Error'
  }
}

export const menuLinks: MenuLinks = [
  {
    link: '/about',
    label: 'About'
  },
  {
    link: '/projects',
    label: 'Projects'
  },
  {
    link: '/blog',
    label: 'Blog'
  },
  {
    link: '/links',
    label: 'Links'
  },
  // Docs menu
  // {
  //   link: '/docs/list',
  //   label: 'Docs'
  // }
]

export const terms: CardListData = {
  title: 'Terms of Service',
  list: [
    {
      title: 'Licensing Information',
      link: '/terms/license_info'
    },
    {
      title: 'Privacy Policy',
      link: '/terms/privacy_policy'
    },
    {
      title: 'Terms and Conditions',
      link: '/terms/terms_and_conditions'
    },
    {
      title: 'Disclaimer',
      link: '/terms/disclaimer'
    }
  ]
}
