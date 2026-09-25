import { methods, phases, solves } from '@/data/fingr'

import { setupReplay } from './fingr-replay'

let dispose: (() => void) | undefined

export function initFingr() {
  dispose?.()
  const root = document.getElementById('fingr')
  if (!root) return
  const controller = new AbortController()
  const { signal } = controller
  const select = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!
  const all = <T extends HTMLElement>(selector: string) => [...root.querySelectorAll<T>(selector)]
  const observeVideos = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement
        if (entry.isIntersecting) {
          video.src = video.dataset.src!
          observeVideos.unobserve(video)
        }
      }
    },
    { rootMargin: '300px' }
  )
  all<HTMLVideoElement>('video').forEach((video) => observeVideos.observe(video))
  const pressed = (selector: string, active: HTMLElement) =>
    all<HTMLButtonElement>(selector).forEach((button) =>
      button.setAttribute('aria-pressed', String(button === active))
    )
  let comparison = 'baselines'
  let metric: 'overall' | 'u' | 'l' = 'overall'
  const detail = select<HTMLParagraphElement>('#result-detail')
  const showDetail = (index: number) => {
    const method = methods[index]
    detail.textContent = `${method.name} · ${method[metric].toFixed(1)}% success · ${method.time.toFixed(2)} s per attempt`
  }
  const updateResults = () => {
    select<HTMLElement>('#attempt-count').textContent =
      metric === 'overall'
        ? '300 attempts / method'
        : `150 ${metric.toUpperCase()} attempts / method`
    all<HTMLButtonElement>('[data-result]').forEach((button) => {
      const index = Number(button.dataset.result)
      const method = methods[index]
      button.hidden = comparison === 'baselines' ? index === 3 : index < 2
      button.querySelector<HTMLElement>('.bar-fill')!.style.width = `${method[metric]}%`
      button.querySelector('strong')!.textContent = `${method[metric].toFixed(1)}%`
      button.setAttribute(
        'aria-label',
        `${method.name}, ${method[metric].toFixed(1)} percent success, ${method.time.toFixed(2)} seconds per attempt`
      )
    })
    showDetail(4)
  }
  all<HTMLButtonElement>('[data-result]').forEach((button) => {
    for (const event of ['pointerenter', 'focus', 'click'])
      button.addEventListener(event, () => showDetail(Number(button.dataset.result)), { signal })
  })
  all<HTMLButtonElement>('[data-comparison]').forEach((button) =>
    button.addEventListener(
      'click',
      () => {
        pressed('[data-comparison]', button)
        comparison = button.dataset.comparison!
        updateResults()
      },
      { signal }
    )
  )
  all<HTMLButtonElement>('[data-metric]').forEach((button) =>
    button.addEventListener(
      'click',
      () => {
        pressed('[data-metric]', button)
        metric = button.dataset.metric as typeof metric
        updateResults()
      },
      { signal }
    )
  )
  updateResults()
  const showTiming = (button: HTMLButtonElement) => {
    const index = Number(button.dataset.timing)
    const solve = solves[index]
    pressed('[data-timing]', button)
    select<HTMLElement>('#timing-title').textContent =
      `Solve ${String(index + 1).padStart(2, '0')} · ${solve.seconds.toFixed(2)} s`
    for (const phase of phases)
      select<HTMLElement>(`[data-time-component="${phase.key}"]`).textContent =
        `${solve.timings[phase.key].toFixed(2)} s`
  }
  all<HTMLButtonElement>('[data-timing]').forEach((button) => {
    for (const event of ['pointerenter', 'focus', 'click'])
      button.addEventListener(event, () => showTiming(button), { signal })
  })
  const cleanupReplay = setupReplay(root, signal)
  dispose = () => {
    controller.abort()
    observeVideos.disconnect()
    all<HTMLVideoElement>('video').forEach((video) => video.pause())
    cleanupReplay()
  }
  document.addEventListener('astro:before-swap', dispose, { once: true, signal })
}
