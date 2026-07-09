# Yutong's Site

Personal website and bilingual blog built with Astro and deployed on Vercel.

Visit [www.lyt0112.com](https://www.lyt0112.com/).

## Requirements

- Node.js 22.12.0 or newer
- Bun 1.2.0 or newer

## Local development

```shell
git clone git@github.com:EmptyBlueBox/Blog.git
cd Blog
bun install --frozen-lockfile
bun run dev
```

Run all repository checks with:

```shell
bun run verify
```

The command checks ESLint, Prettier, Astro types, and the production build. Use `bun run fix` to apply ESLint and Prettier changes.

## Writing posts

Create a draft with:

```shell
bun run new-post -- article_name
```

Posts live in `src/content/post`. Use `article_name-en.mdx` and `article_name-zh.mdx` for translated articles. `/blog/article_name` redirects to the English article when it exists and otherwise redirects to the Chinese article. A file named `article_name.mdx` uses `/blog/article_name` directly.

Each published post uses this frontmatter structure:

```yaml
---
title: 'Article title'
description: 'A concise summary between 10 and 160 characters.'
publishDate: 2026-07-09
updatedDate: 2026-07-09
heroImage:
  src: './cover_imgs/article_cover.jpg'
  alt: 'A precise description of the cover image'
  color: '#64574D'
draft: false
tags: ['Tag']
language: 'en-US'
---
```

Valid languages are `en-US` and `zh-CN`. Local cover images are validated and optimized by Astro.

## Deployment

Astro prerenders pages, RSS, robots.txt, and policy documents. The four routes under `src/pages/api` run on demand through the Vercel adapter. Vercel installs dependencies and runs `bun run build` using `vercel.json`.

## License

- Code and templates use the [Apache License 2.0](./LICENSE).
- Original blog content uses the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).
