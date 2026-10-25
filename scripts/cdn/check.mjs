import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createMarkdownProcessor, parseFrontmatter } from '@astrojs/markdown-remark'
import { toString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'

import { manifestFile, objectMetadata, objectPath, readJSON } from './common.mjs'

const manifest = await readJSON(manifestFile)
for (const [id, path] of Object.entries(manifest.assets)) {
  const asset = manifest.objects[path]
  assert(asset, `Missing object: ${id}`)
  assert.equal(path, objectPath(id, asset.sha256))
}
for (const [path, metadata] of Object.entries(manifest.objects)) {
  const asset = objectMetadata(path, metadata)
  assert.match(asset.sha256, /^[a-f0-9]{64}$/)
  assert.match(asset.storedSha256, /^[a-f0-9]{64}$/)
  assert(asset.bytes > 0 && asset.storedBytes > 0)
  assert(asset.encoding === undefined || asset.encoding === 'gzip')
  if (asset.width !== undefined) {
    assert(asset.width > 0 && asset.height > 0, `Missing image dimensions: ${path}`)
  }
  for (const variant of asset.variants ?? []) {
    const image = manifest.objects[variant]
    assert(image?.width > 0 && image?.height > 0, `Invalid image variant: ${variant}`)
    assert.equal(image.type, 'image/webp')
  }
}

const processor = await createMarkdownProcessor({
  syntaxHighlight: false,
  remarkPlugins: [
    () => (tree, file) => {
      const definitions = new Set()
      const references = new Set()
      visit(tree, (node) => {
        if (node.type === 'footnoteDefinition') {
          assert(
            !definitions.has(node.identifier),
            `Duplicate footnote: ${file.path} ${node.identifier}`
          )
          definitions.add(node.identifier)
        }
        if (node.type === 'footnoteReference') references.add(node.identifier)
        if (node.type === 'text')
          assert(
            !/\[\^[^\]]+\]/.test(node.value),
            `Unresolved footnote: ${file.path} ${node.value}`
          )
        if (node.type === 'heading')
          assert(
            !/^(References|Citations|参考资料|参考文献)$/i.test(toString(node)),
            `Use Markdown footnotes: ${file.path}`
          )
        if (node.type === 'image')
          assert(
            node.url.startsWith(`${manifest.origin}/`),
            `Image must use CDN: ${file.path} ${node.url}`
          )
      })
      assert.deepEqual(references, definitions, `Unreferenced or missing footnotes: ${file.path}`)
    }
  ]
})
for (const name of (await readdir('src/content/post')).filter((name) => /\.mdx?$/.test(name))) {
  const path = `src/content/post/${name}`
  const { frontmatter, content } = parseFrontmatter(await readFile(path, 'utf8'))
  if (frontmatter.heroImage) {
    const { asset, src, cdn } = frontmatter.heroImage
    assert(!src && !cdn, `Use heroImage.asset: ${path}`)
    assert(manifest.objects[manifest.assets[asset]]?.width > 0, `Missing cover: ${path}`)
  }
  await processor.render(content, { fileURL: new URL(`../../${path}`, import.meta.url) })
}
for (const root of ['src/assets', 'src/content/post', 'public']) {
  for (const file of await readdir(root, { recursive: true })) {
    if (!/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(file)) continue
    assert(
      (root === 'src/assets' && file === 'signature.svg') ||
        (root === 'public' && /^(icons|favicon)\//.test(file)),
      `Content image belongs on CDN: ${root}/${file}`
    )
  }
}
console.log(`Validated ${Object.keys(manifest.objects).length} CDN objects`)
