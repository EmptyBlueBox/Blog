import manifest from './cdn-assets.json'

const paths = manifest.assets as Record<string, string>
const objects = manifest.objects as Record<string, { path: string; bytes: number; sha256: string }>

export const cdnAsset = (id: string) => objects[paths[id]]
export const cdnUrl = (id: string) => `${manifest.origin}/${cdnAsset(id).path}`
