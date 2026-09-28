import assert from 'node:assert/strict'

import { manifestFile, objectPath, readJSON } from './common.mjs'

const manifest = await readJSON(manifestFile)
for (const [id, path] of Object.entries(manifest.assets)) {
  const asset = manifest.objects[path]
  assert(asset, `Missing object: ${id}`)
  assert.equal(path, objectPath(id, asset.sha256))
}
for (const [path, asset] of Object.entries(manifest.objects)) {
  assert.equal(path, asset.path)
  assert.match(asset.sha256, /^[a-f0-9]{64}$/)
  assert.match(asset.storedSha256, /^[a-f0-9]{64}$/)
  assert(asset.bytes > 0 && asset.storedBytes > 0)
  assert(asset.encoding === undefined || asset.encoding === 'gzip')
}
console.log(`Validated ${Object.keys(manifest.objects).length} CDN objects`)
