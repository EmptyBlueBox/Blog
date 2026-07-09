import { writeFileSync } from 'node:fs'

const name = process.argv[2].replace(/\.(md|mdx)$/u, '')
const date = new Date().toISOString().slice(0, 10)

writeFileSync(
  `src/content/post/${name}.mdx`,
  `---
title: '${name.replaceAll('_', ' ')}'
description: 'Add a concise article summary.'
publishDate: ${date}
draft: true
tags: []
language: 'en-US'
---
`
)
