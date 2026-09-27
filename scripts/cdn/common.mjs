import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { get } from 'node:https'
import { basename, dirname } from 'node:path'
import { gunzipSync } from 'node:zlib'
import OSS from 'ali-oss'

export const manifestFile = 'src/data/cdn-assets.json'
export const cacheDir = '.cdn-cache/objects'
export const origin = 'https://cdn.lyt0112.com'
export const sha256 = (data) => createHash('sha256').update(data).digest('hex')
export const readJSON = async (file) => JSON.parse(await readFile(file, 'utf8'))
export const writeJSON = async (file, data) => {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`)
}
export const objectPath = (id, sha) => `${dirname(id)}/${sha.slice(0, 12)}/${basename(id)}`
export const decoded = (data, encoding) => (encoding === 'gzip' ? gunzipSync(data) : data)
export const verify = (data, asset) => {
  if (data.length !== asset.storedBytes || sha256(data) !== asset.storedSha256) {
    throw new Error(`Stored checksum mismatch: ${asset.path}`)
  }
  const body = decoded(data, asset.encoding)
  if (body.length !== asset.bytes || sha256(body) !== asset.sha256) {
    throw new Error(`Decoded checksum mismatch: ${asset.path}`)
  }
}
export const download = (url) =>
  new Promise((resolve, reject) => {
    const request = get(url, { headers: { 'Accept-Encoding': 'gzip' } }, (response) => {
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`Download failed: HTTP ${response.statusCode}`))
        return
      }
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve({ data: Buffer.concat(chunks), headers: response.headers }))
      response.on('error', reject)
    })
    request.setTimeout(120000, () => request.destroy(new Error('Download timed out')))
    request.on('error', reject)
  })
export const client = () =>
  new OSS({
    region: 'oss-cn-beijing',
    bucket: 'lyt0112-blog-assets',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    timeout: 600000,
    secure: true
  })
export const cacheControl = (path) =>
  path === 'CV-Yutong_Liang.pdf' ? 'public, max-age=300' : 'public, max-age=31536000, immutable'
export const headersFor = (asset, path = asset.path) => ({
  'Content-Type': asset.type,
  'Cache-Control': cacheControl(path),
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  ...(asset.encoding ? { 'Content-Encoding': asset.encoding } : {})
})
export const parallel = async (items, task, concurrency = 6) => {
  let next = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < items.length) await task(items[next++])
    })
  )
}
