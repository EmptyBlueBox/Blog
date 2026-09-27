import { cdnAsset, cdnUrl } from './cdn'
import assets from './fingr-assets.json'

export const title = 'FINGR: Learning Dexterous Hand Control for Real-World Rubik’s Cube Solving'

export const media = Object.fromEntries(
  Object.entries(assets).map(([name, id]) => [name, cdnAsset(id)])
)
export const resource = (name: string) => cdnUrl((assets as Record<string, string>)[name])
export const replayResource = resource

export { default as solves } from './fingr-solves.json'

export const phases = [
  { key: 'pickup', label: 'Pickup' },
  { key: 'turn', label: 'Layer turns' },
  { key: 'alignment', label: 'Alignment' },
  { key: 'regrasp', label: 'Regrasp' },
  { key: 'place', label: 'Place / return' },
  { key: 'observe', label: 'Observe' }
] as const

export const methods = [
  { name: 'ACT', overall: 77.7, u: 72, l: 83.3, time: 6.39 },
  { name: 'Diffusion Policy', overall: 78.7, u: 78, l: 79.3, time: 6.06 },
  { name: 'Base Flow', overall: 79.7, u: 82.7, l: 76.7, time: 5.67 },
  { name: 'Base Flow + Local Geometry', overall: 92.7, u: 92.7, l: 92.7, time: 5.24 },
  { name: 'FINGR', overall: 99, u: 99.3, l: 98.7, time: 5.25 }
]
