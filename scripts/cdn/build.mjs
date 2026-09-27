import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import {
  cacheDir,
  client,
  download,
  headersFor,
  manifestFile,
  parallel,
  readJSON,
  verify,
  writeJSON
} from './common.mjs'

const manifest = await readJSON(manifestFile)
const oss = client()
await mkdir(cacheDir, { recursive: true })
await parallel(Object.values(manifest.objects), async (asset) => {
  const cached = `${cacheDir}/${asset.storedSha256}`
  let data
  try {
    data = await readFile(cached)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    data = (await download(oss.signatureUrl(asset.path))).data
    verify(data, asset)
    await writeFile(cached, data)
  }
  verify(data, asset)
})
execFileSync('bun', ['run', 'build'], { stdio: 'inherit' })
const output = '.vercel/output'
const config = await readJSON(`${output}/config.json`)
const escape = (path) => path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const routes = []
for (const asset of Object.values(manifest.objects)) {
  const dest = `${output}/static/${asset.path}`
  await mkdir(dirname(dest), { recursive: true })
  await copyFile(`${cacheDir}/${asset.storedSha256}`, dest)
  routes.push({ src: `^/${escape(asset.path)}$`, headers: headersFor(asset), continue: true })
}
for (const [alias, path] of Object.entries(manifest.aliases)) {
  const asset = manifest.objects[path]
  routes.push({ src: `^/${escape(alias)}$`, dest: `/${path}`, headers: headersFor(asset, alias) })
  if (alias.startsWith('Projects/FINGR/')) {
    routes.push({
      src: `^/fingr-assets/${escape(alias.slice('Projects/FINGR/'.length))}$`,
      dest: `/${path}`,
      headers: headersFor(asset)
    })
  }
}
const dextercap = {
  rubikscube: 'RubiksCube-363-391',
  cuboid0: 'Cuboid_00-301-306',
  cuboid1: 'Cuboid_01-551-556',
  cuboid2: 'Cuboid_02-204-209',
  cylinder: 'Cylinder-351-360',
  plate: 'Plate-204-209',
  prism: 'Prism-564-571',
  ring: 'Ring-485-490'
}
for (const [key, filename] of Object.entries(dextercap)) {
  const path = manifest.aliases[`Projects/DexterCap/${filename}.rrd`]
  routes.push({
    src: '^/api/dextercap-rrd$',
    has: [{ type: 'query', key: 'key', value: key }],
    dest: `/${path}`,
    headers: headersFor(manifest.objects[path])
  })
}
config.routes.unshift(...routes)
await writeJSON(`${output}/config.json`, config)
console.log(
  `Published ${Object.keys(manifest.objects).length} CDN objects and ${Object.keys(manifest.aliases).length} aliases`
)
