import { media, phases, replayResource, solves } from '@/data/fingr'
import type { WebViewer, WebViewerOptions } from '@rerun-io/web-viewer'

type Step = { move: string; kind: string; start: number; end: number }
type Segment = { start: number; end: number; kind: string; step: number }
type Replay = {
  source: string
  recordingId: string
  duration: number
  steps: Step[]
  sequence: (Step & { step: number })[]
  segments: Segment[]
  frames: { time: number; phase: string; step: number; angle: number | null }[]
}

export function setupReplay(root: HTMLElement, signal: AbortSignal) {
  const select = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-solve]')]
  const host = select<HTMLDivElement>('#rerun-root')
  host.classList.toggle(
    'rerun-macos',
    navigator.userAgent.includes('Mac') && !navigator.userAgent.includes('like Mac')
  )
  const cover = select<HTMLDivElement>('#replay-cover')
  const status = select<HTMLParagraphElement>('#replay-status')
  const progress = select<HTMLProgressElement>('#replay-progress')
  const loadButton = select<HTMLButtonElement>('#load-replay')
  const play = select<HTMLButtonElement>('#replay-play')
  const time = select<HTMLInputElement>('#replay-time')
  const clock = select<HTMLOutputElement>('#replay-clock')
  const reset = select<HTMLButtonElement>('#replay-reset')
  const forces = select<HTMLInputElement>('#show-forces')
  const angle = select<HTMLInputElement>('#show-angle')
  const phaseTrack = select<HTMLDivElement>('#phase-track')
  const markers = select<HTMLDivElement>('#move-markers')
  const phase = select<HTMLSpanElement>('#replay-phase')
  const moves = select<HTMLDivElement>('#replay-moves')
  const feedback = select<HTMLParagraphElement>('#replay-feedback')
  let selected = 0
  let viewer: WebViewer | null = null
  let data: Replay | null = null
  let request: AbortController | null = null
  let generation = 0
  let viewRevision = 0
  let activated = false
  let queue = Promise.resolve()
  let frame = 0
  let playing = false
  let requestedPlaying: boolean | null = null
  let shownTime = -1
  let shownAngle = false
  const compact = window.matchMedia('(max-width: 600px)')
  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  const enable = (value: boolean) => {
    for (const control of [play, time, reset, forces, angle]) control.disabled = !value
  }
  const showTime = (seconds: number) => {
    if (!data || (seconds === shownTime && angle.checked === shownAngle)) return
    shownTime = seconds
    shownAngle = angle.checked
    time.value = String(seconds)
    clock.textContent = `${formatTime(seconds)} / ${formatTime(data.duration)}`
    let low = 0
    let high = data.frames.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (data.frames[middle].time <= seconds) low = middle + 1
      else high = middle
    }
    const current = data.frames[Math.max(0, low - 1)]
    const labels: Record<string, string> = {
      planning: 'Planning',
      movingpregrasp: 'Pregrasp',
      approach: 'Approach',
      grasp: 'Grasp',
      lift: 'Lift',
      rotate: 'Orient cube',
      observing: 'Observe',
      regrasp_movingpregrasp: 'Regrasp · Pregrasp',
      regrasp_approach: 'Regrasp · Approach',
      regrasp_grasp: 'Regrasp · Grasp',
      regrasp_lift: 'Regrasp · Lift',
      regrasp_rotate: 'Regrasp · Orient cube',
      stowing: 'Place · Prepare',
      leveling: 'Place · Level cube',
      lowering: 'Place · Lower cube',
      releasing: 'Release',
      retreating: 'Retreat',
      returning_default: 'Return'
    }
    const segment = data.segments.find((s) => s.start <= seconds && seconds < s.end)
    const kind = segment?.kind
    phase.textContent =
      current.step >= 0
        ? `${kind === 'alignment' ? 'Alignment' : `Move ${current.step + 1}`} · ${data.steps[current.step].move}${angle.checked && current.angle !== null ? ` · ${current.angle.toFixed(1)}° remaining` : ''}`
        : seconds >= data.duration
          ? 'Solved'
          : (labels[current.phase] ?? current.phase.replaceAll('_', ' '))
    for (const button of moves.querySelectorAll<HTMLButtonElement>('button')) {
      const step = data.sequence[Number(button.dataset.sequence)]
      if (step.start <= seconds && seconds < step.end) button.setAttribute('aria-current', 'step')
      else button.removeAttribute('aria-current')
    }
    for (const button of phaseTrack.querySelectorAll<HTMLButtonElement>('button')) {
      if (data.segments[Number(button.dataset.segment)] === segment)
        button.setAttribute('aria-current', 'step')
      else button.removeAttribute('aria-current')
    }
  }
  const seek = (seconds: number) => {
    if (viewer && data) viewer.set_current_time(data.recordingId, 'time', seconds * 1e9)
  }
  const renderTimeline = () => {
    const recording = data!
    const stepTime = (step: number, start: number) =>
      step >= 0 ? recording.frames.find((frame) => frame.step === step)!.time : start
    recording.segments.forEach((segment, i) => {
      const button = document.createElement('button')
      const label = phases.find((p) => p.key === segment.kind)!.label
      button.type = 'button'
      button.className = `phase-${segment.kind}`
      button.dataset.segment = String(i)
      button.style.left = `${(segment.start / recording.duration) * 100}%`
      button.style.width = `${((segment.end - segment.start) / recording.duration) * 100}%`
      const move = segment.step >= 0 ? recording.steps[segment.step].move : ''
      const text = move || label
      button.textContent =
        ((segment.end - segment.start) / recording.duration) * phaseTrack.clientWidth >=
        text.length * 6 + 8
          ? text
          : ''
      button.title = `${label}${move ? ` · ${move}` : ''} · ${segment.start.toFixed(2)}–${segment.end.toFixed(2)} s`
      button.setAttribute('aria-label', `Seek to ${button.title}`)
      button.addEventListener('click', () => seek(stepTime(segment.step, segment.start)), {
        signal
      })
      phaseTrack.append(button)
    })
    recording.sequence.forEach((step, i) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = step.kind === 'alignment' ? `Align ${step.move}` : step.move
      button.className = `step-${step.kind}`
      button.dataset.sequence = String(i)
      button.dataset.step = String(step.step)
      button.title = `${step.kind === 'alignment' ? 'Alignment recovery' : step.kind === 'regrasp' ? 'Table-assisted regrasp' : `Move ${step.step + 1}`} · ${step.start.toFixed(2)} s`
      button.setAttribute('aria-label', `${button.title}, ${step.move}`)
      button.addEventListener('click', () => seek(stepTime(step.step, step.start)), { signal })
      moves.append(button)
      const marker = document.createElement('i')
      marker.style.left = `${(step.start / recording.duration) * 100}%`
      markers.append(marker)
    })
  }

  const showPlayback = (value: boolean) => {
    playing = value
    play.textContent = value ? 'Pause' : 'Play'
  }
  const setPlaying = (value: boolean) => {
    requestedPlaying = value
    showPlayback(value)
    viewer!.set_playing(data!.recordingId, value)
  }
  const tick = () => {
    if (viewer && data) {
      showTime(viewer.get_current_time(data.recordingId, 'time') / 1e9)
      const current = viewer.get_playing(data.recordingId)
      if (current === requestedPlaying) requestedPlaying = null
      if (requestedPlaying === null && current !== playing) showPlayback(current)
    }
    frame = requestAnimationFrame(tick)
  }
  const applyView = async () => {
    if (!viewer) return
    const instance = viewer
    const revision = ++viewRevision
    feedback.textContent = ''
    try {
      const response = await fetch(
        replayResource(
          `replays/view-${Number(compact.matches)}-${Number(forces.checked)}-${Number(angle.checked)}.rbl`
        ),
        { signal: request!.signal }
      )
      if (!response.ok) throw new Error(`View: HTTP ${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (viewer !== instance || revision !== viewRevision) return
      const channel = instance.open_channel('blueprint')
      channel.send_rrd(bytes)
      channel.close()
    } catch (error) {
      if (viewer === instance && revision === viewRevision) throw error
    }
  }
  const load = () => {
    activated = true
    const currentGeneration = ++generation
    const index = selected
    request?.abort()
    viewer?.stop()
    viewer = null
    data = null
    requestedPlaying = null
    shownTime = -1
    showPlayback(false)
    cancelAnimationFrame(frame)
    enable(false)
    moves.replaceChildren()
    phaseTrack.replaceChildren()
    markers.replaceChildren()
    cover.hidden = false
    loadButton.disabled = true
    loadButton.textContent = 'Loading 3D replay…'
    status.textContent = 'Starting the 3D viewer…'
    progress.hidden = false
    progress.removeAttribute('value')
    feedback.textContent = ''
    queue = queue.then(async () => {
      if (signal.aborted || currentGeneration !== generation) return
      const download = new AbortController()
      request = download
      let instance: WebViewer | null = null
      try {
        const { WebViewer } = await import('@rerun-io/web-viewer')
        if (signal.aborted || currentGeneration !== generation) return
        instance = new WebViewer()
        const wasm = new URL(replayResource('runtime/re_viewer_bg.wasm'), location.origin)
        const options: WebViewerOptions & { base_url: string } = {
          width: '100%',
          height: '100%',
          hide_welcome_screen: true,
          theme: 'light',
          base_url: new URL('.', wasm).href,
          render_backend: 'webgl'
        }
        await instance.start(null, host, options)
        if (signal.aborted || currentGeneration !== generation) {
          instance.stop()
          return
        }
        const key = `replays/solve-${String(index + 1).padStart(2, '0')}`
        const metaResponse = await fetch(replayResource(`${key}.json`), { signal: download.signal })
        if (!metaResponse.ok) throw new Error(`Replay metadata: HTTP ${metaResponse.status}`)
        const recording = (await metaResponse.json()) as Replay
        if (recording.source !== solves[index].source)
          throw new Error('Replay source does not match the selected scramble')
        const response = await fetch(replayResource(`${key}.rrd`), { signal: download.signal })
        if (!response.ok) throw new Error(`Replay: HTTP ${response.status}`)
        const reader = response.body!.getReader()
        const chunks: Uint8Array[] = []
        let loaded = 0
        progress.max = media[`${key}.rrd`].bytes
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          loaded += value.length
          chunks.push(value)
          progress.value = loaded
          status.textContent = `Loading scramble ${String(index + 1).padStart(2, '0')} · ${Math.min(100, Math.round((loaded / progress.max) * 100))}%`
        }
        const bytes = new Uint8Array(loaded)
        let offset = 0
        for (const chunk of chunks) {
          bytes.set(chunk, offset)
          offset += chunk.length
        }
        const channel = instance.open_channel('fingr')
        channel.send_rrd(bytes)
        channel.close()
        const start = performance.now()
        while (!instance.get_time_range(recording.recordingId, 'time')) {
          if (download.signal.aborted || signal.aborted || currentGeneration !== generation) {
            instance.stop()
            return
          }
          if (performance.now() - start > 20000) throw new Error('The replay could not be opened')
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
        if (signal.aborted || currentGeneration !== generation) {
          instance.stop()
          return
        }
        viewer = instance
        data = recording
        viewer.set_active_recording_id(data.recordingId)
        viewer.set_active_timeline(data.recordingId, 'time')
        viewer.set_current_time(data.recordingId, 'time', 0)
        setPlaying(false)
        viewer.override_panel_state('top', 'hidden')
        viewer.override_panel_state('blueprint', 'hidden')
        viewer.override_panel_state('selection', 'hidden')
        viewer.override_panel_state('time', 'hidden')
        viewer.toggle_panel_overrides(true)
        time.max = String(data.duration)
        forces.checked = false
        angle.checked = false
        await applyView()
        if (signal.aborted || currentGeneration !== generation) return
        renderTimeline()
        cover.hidden = true
        progress.hidden = true
        enable(true)
        showTime(0)
        frame = requestAnimationFrame(tick)
      } catch (error) {
        instance?.stop()
        if (signal.aborted || currentGeneration !== generation) return
        status.textContent = 'Replay could not load. Please try again.'
        feedback.textContent = error instanceof Error ? error.message : String(error)
        loadButton.textContent = 'Retry 3D replay'
        loadButton.disabled = false
        progress.hidden = true
      }
    })
  }
  const choose = (index: number) => {
    selected = index
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)))
    select<HTMLElement>('#scramble').textContent = solves[index].scramble
    if (activated) load()
  }
  buttons.forEach((button) =>
    button.addEventListener('click', () => choose(Number(button.dataset.solve)), { signal })
  )
  loadButton.addEventListener('click', load, { signal })
  play.addEventListener(
    'click',
    () => {
      if (viewer && data) {
        if (!playing && viewer.get_current_time(data.recordingId, 'time') / 1e9 >= data.duration)
          seek(0)
        setPlaying(!playing)
      }
    },
    { signal }
  )
  time.addEventListener(
    'input',
    () => {
      if (viewer && data)
        viewer.set_current_time(data.recordingId, 'time', Number(time.value) * 1e9)
    },
    { signal }
  )
  const changeView = () => {
    void applyView().catch((error: Error) => {
      if (!request?.signal.aborted) feedback.textContent = error.message
    })
  }
  reset.addEventListener('click', changeView, { signal })
  forces.addEventListener('change', changeView, { signal })
  angle.addEventListener('change', changeView, { signal })
  host.addEventListener('dblclick', changeView, { signal })
  compact.addEventListener('change', changeView, { signal })
  select<HTMLButtonElement>('#replay-fullscreen').addEventListener(
    'click',
    async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen()
        else await root.querySelector<HTMLElement>('.replay-player')!.requestFullscreen()
      } catch {
        feedback.textContent = 'Fullscreen is unavailable in this browser.'
      }
    },
    { signal }
  )
  document.addEventListener(
    'fullscreenchange',
    () => {
      select<HTMLButtonElement>('#replay-fullscreen').textContent = document.fullscreenElement
        ? 'Exit fullscreen'
        : 'Fullscreen'
    },
    { signal }
  )
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden && viewer && data) setPlaying(false)
    },
    { signal }
  )
  return () => {
    generation++
    request?.abort()
    viewer?.stop()
    cancelAnimationFrame(frame)
  }
}
