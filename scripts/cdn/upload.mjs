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
import { mirror } from './mirror.mjs'

const {
  values: { file, id }
} = parseArgs({ options: { file: { type: 'string' }, id: { type: 'string' } } })
if (
  !file ||
  !id ||
  !/^(?:projects|posts|documents)\/(?:[a-z0-9-]+\/)*[a-z0-9_-]+\.[a-z0-9]+$/.test(id)
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
let asset = manifest.objects[path]
let data
if (asset) {
  data = (await download(oss.signatureUrl(path))).data
  verify(data, asset)
} else {
  const encoding = ['.rrd', '.wasm'].includes(extname(id)) ? 'gzip' : undefined
  data = encoding ? gzipSync(body, { level: 9 }) : body
  asset = {
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
}
await mkdir(cacheDir, { recursive: true })
const cached = `${cacheDir}/${asset.storedSha256}`
await writeFile(cached, data)
await mirror(asset, cached)
manifest.objects[path] = asset
manifest.assets[id] = path
await writeJSON(manifestFile, manifest)
console.log(`${origin}/${path}`)
