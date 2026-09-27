import { readFile } from 'node:fs/promises'

import {
  cacheDir,
  client,
  download,
  headersFor,
  manifestFile,
  parallel,
  readJSON,
  verify
} from './common.mjs'

const manifest = await readJSON(manifestFile)
const oss = client()
await parallel(Object.values(manifest.objects), async (asset) => {
  const data = await readFile(`${cacheDir}/${asset.storedSha256}`)
  verify(data, asset)
  await oss.put(asset.path, data, { headers: headersFor(asset) })
  verify((await download(oss.signatureUrl(asset.path))).data, asset)
  console.log(`Verified ${asset.path}`)
})
await parallel(Object.entries(manifest.aliases), async ([alias, path]) => {
  await oss.copy(alias, path, {
    headers: { ...headersFor(manifest.objects[path], alias), 'x-oss-metadata-directive': 'REPLACE' }
  })
  verify((await download(oss.signatureUrl(alias))).data, manifest.objects[path])
  console.log(`Verified alias ${alias}`)
})
