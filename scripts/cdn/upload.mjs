import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { gzipSync } from 'node:zlib'
import sharp from 'sharp'

import {
  cacheDir,
  client,
  download,
  headersFor,
  manifestFile,
  objectMetadata,
  objectPath,
  origin,
  parallel,
  readJSON,
  sha256,
  verify,
  writeJSON
} from './common.mjs'
import { mirror } from './mirror.mjs'

const types = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.rrd': 'application/octet-stream',
  '.rbl': 'application/octet-stream',
  '.wasm': 'application/wasm'
}

export async function uploadFile(file, id, { widths = [], quality = 80 } = {}) {
  if (!/^(?:site|projects|posts|documents)\/(?:[a-z0-9-]+\/)*[a-z0-9_-]+\.[a-z0-9]+$/.test(id))
    throw new Error(`Invalid asset ID: ${id}`)
  const type = types[extname(id)]
  if (!type) throw new Error(`Unsupported file type: ${id}`)
  const manifest = await readJSON(manifestFile)
  const oss = client()
  await mkdir(cacheDir, { recursive: true })
  const put = async (body, key, contentType, dimensions = {}) => {
    const sha = sha256(body)
    const path = objectPath(key, sha)
    let asset = manifest.objects[path]
    let data
    if (asset) {
      asset = objectMetadata(path, asset)
      data = (await download(oss.signatureUrl(path))).data
      verify(data, asset)
    } else {
      const encoding = ['.rrd', '.wasm'].includes(extname(key)) ? 'gzip' : undefined
      data = encoding ? gzipSync(body, { level: 9 }) : body
      asset = {
        path,
        sha256: sha,
        bytes: body.length,
        type: contentType,
        ...(encoding ? { encoding } : {}),
        storedSha256: sha256(data),
        storedBytes: data.length
      }
      await oss.put(path, data, { headers: headersFor(asset) })
      verify((await download(oss.signatureUrl(path))).data, asset)
    }
    const cached = `${cacheDir}/${asset.storedSha256}`
    await writeFile(cached, data)
    await mirror(asset, cached)
    manifest.objects[path] = {
      type: asset.type,
      sha256: asset.sha256,
      bytes: asset.bytes,
      ...dimensions,
      ...(asset.variants ? { variants: asset.variants } : {}),
      ...(asset.encoding
        ? {
            encoding: asset.encoding,
            storedSha256: asset.storedSha256,
            storedBytes: asset.storedBytes
          }
        : {})
    }
    return path
  }
  const body = await readFile(file)
  const metadata = type.startsWith('image/') ? await sharp(body).metadata() : undefined
  const dimensions = metadata ? { width: metadata.width, height: metadata.height } : {}
  const path = await put(body, id, type, dimensions)
  if (widths.length && metadata && !['svg', 'gif'].includes(metadata.format)) {
    const sizes = [...new Set(widths.map((width) => Math.min(width, metadata.width)))].sort(
      (a, b) => a - b
    )
    const variants = []
    await parallel(sizes, async (width) => {
      const { data, info } = await sharp(body)
        .rotate()
        .resize({ width })
        .webp({ quality })
        .toBuffer({ resolveWithObject: true })
      const key = `${dirname(id)}/${basename(id, extname(id))}-${width}.webp`
      variants.push(await put(data, key, 'image/webp', { width: info.width, height: info.height }))
    })
    manifest.objects[path].variants = variants.sort(
      (a, b) => manifest.objects[a].width - manifest.objects[b].width
    )
  }
  manifest.assets[id] = path
  await writeJSON(manifestFile, manifest)
  console.log(`${origin}/${path}`)
  return path
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {
    values: { file, id, widths, quality }
  } = parseArgs({
    options: {
      file: { type: 'string' },
      id: { type: 'string' },
      widths: { type: 'string' },
      quality: { type: 'string', default: '80' }
    }
  })
  if (!file || !id)
    throw new Error(
      'Usage: bun run cdn:upload --file /path/to/file --id posts/name/images/cover.webp [--widths 320,640,960,1280]'
    )
  await uploadFile(file, id, {
    widths: widths ? widths.split(',').map(Number) : [],
    quality: Number(quality)
  })
}
