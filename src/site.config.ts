import type { CardListData, FooterConfig, IntegrationConfig, MenuLinks, SiteConfig } from '@/types'

export const siteConfig: SiteConfig = {
  author: 'Yutong Liang',
  title: "Yutong's Site",
  site: 'https://www.lyt0112.com/',
  description:
    'Yutong Liang is a robotics researcher at UC San Diego working on dexterous manipulation, human demonstrations, and physics-based learning.',
  lang: 'en-US',
  ogLocale: 'en_US',
  date: {
    locale: 'en-US',
    options: {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
  },

  npmCDN: 'https://cdn.jsdelivr.net/npm',

  blog: {
    pageSize: 8
  },

  seo: {},
  content: {
    externalLinkArrow: true,
    share: ['x']
  }
}

export const footerConfig: FooterConfig = {
  socialLinks: []
}

export const integrationConfig: IntegrationConfig = {
  waline: {
    enable: true,
    server: 'https://waline.lyt0112.com',
    emoji: ['bmoji', 'weibo'],
    additionalConfigs: {
      pageview: true,
      comment: true,
      locale: {
        reaction0: 'Like',
        placeholder: 'Welcome to comment. (Email to receive replies. Login is optional)'
      },
      imageUploader: false
    }
  },
  links: {
    logbook: [
      { date: '2025-08-06', content: "Axi's Blog" },
      { date: '2025-01-25', content: "Arles' Café" },
      { date: '2024-11-30', content: 'CWorld Site' },
      { date: '2024-07-23', content: 'Ethan' },
      { date: '2024-05-13', content: 'Emoairx' },
      { date: '2024-05-01', content: "Arthals' ink" }
    ],
    applyTip: {
      name: siteConfig.title,
      desc: 'My compass is curiosity.',
      url: siteConfig.site,
      avatar: siteConfig.site + 'favicon.ico'
    }
  },
  typography: {
    class: 'prose prose-pure dark:prose-invert dark:prose-pure prose-headings:font-medium'
  },
  mediumZoom: {
    enable: true,
    selector: '.prose .zoomable',
    options: {
      className: 'zoomable'
    }
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
    link: 'https://cdn.lyt0112.com/CV-Yutong_Liang.pdf',
    label: 'CV'
  }
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
