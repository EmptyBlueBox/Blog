import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { parseArgs } from 'node:util'
import { gzipSync } from 'node:zlib'

import {
  cacheDir,
  client,
  download,
  headersFor,
  manifestFile,
  objectPath,
  origin,
  readJSON,
  sha256,
  verify,
  writeJSON
} from './common.mjs'

const {
  values: { file, id }
} = parseArgs({ options: { file: { type: 'string' }, id: { type: 'string' } } })
if (
  !file ||
  !id ||
  !/^(?:projects|posts|documents)\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.[a-z0-9]+$/.test(id)
) {
  throw new Error(
    'Usage: bun run cdn:upload --file /path/to/file --id projects/name/videos/demo.mp4'
  )
}
const types = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.rrd': 'application/octet-stream',
  '.rbl': 'application/octet-stream',
  '.wasm': 'application/wasm'
}
const type = types[extname(id)]
if (!type) throw new Error(`Unsupported file type: ${id}`)
const manifest = await readJSON(manifestFile)
const body = await readFile(file)
const sha = sha256(body)
const path = objectPath(id, sha)
const oss = client()
if (manifest.objects[path]) {
  const { data } = await download(oss.signatureUrl(path))
  verify(data, manifest.objects[path])
} else {
  const encoding = ['.rrd', '.wasm'].includes(extname(id)) ? 'gzip' : undefined
  const data = encoding ? gzipSync(body, { level: 9 }) : body
  const asset = {
    path,
    sha256: sha,
    bytes: body.length,
    type,
    ...(encoding ? { encoding } : {}),
    storedSha256: sha256(data),
    storedBytes: data.length
  }
  await oss.put(path, data, { headers: headersFor(asset) })
  verify((await download(oss.signatureUrl(path))).data, asset)
  await mkdir(cacheDir, { recursive: true })
  await writeFile(`${cacheDir}/${asset.storedSha256}`, data)
  manifest.objects[path] = asset
}
manifest.assets[id] = path
const aliases = []
if (id === 'documents/cv-yutong-liang.pdf') aliases.push('CV-Yutong_Liang.pdf')
if (id.endsWith('/runtime/re-viewer-bg.wasm')) {
  aliases.push(path.replace('/re-viewer-bg.wasm', '/re_viewer_bg.wasm'))
}
for (const alias of aliases) {
  await oss.copy(alias, path, {
    headers: {
      ...headersFor(manifest.objects[path], alias),
      'x-oss-metadata-directive': 'REPLACE'
    }
  })
  verify((await download(oss.signatureUrl(alias))).data, manifest.objects[path])
  manifest.aliases[alias] = path
}
await writeJSON(manifestFile, manifest)
console.log(`${origin}/${path}`)
