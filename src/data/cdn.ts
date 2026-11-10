import manifest from './cdn-assets.json' with { type: 'json' }

const paths = manifest.assets as Record<string, string>
const objects = manifest.objects as Record<
  string,
  {
    bytes: number
    sha256: string
    width?: number
    height?: number
    variants?: string[]
  }
>

export const cdnAsset = (id: string) => objects[paths[id]]
export const cdnUrl = (id: string) => `${manifest.origin}/${paths[id]}`

const image = (path: string) => {
  const variants = objects[path].variants ?? [path]
  const selected = variants.at(-1)!
  return {
    src: `${manifest.origin}/${selected}`,
    width: objects[selected].width!,
    height: objects[selected].height!,
    srcset: variants
      .map((variant) => `${manifest.origin}/${variant} ${objects[variant].width}w`)
      .join(', ')
  }
}

export const cdnImage = (id: string) => image(paths[id])
export const cdnImageFromUrl = (url: string) => {
  const path = url.slice(manifest.origin.length + 1)
  return objects[path].width ? image(path) : undefined
}
