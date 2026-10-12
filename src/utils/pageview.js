import { pageviewCount } from '@waline/client/pageview'

const server_url = 'https://waline.lyt0112.com'
const summary_key = 'site_pageview_summary_v2'
const summary_expiry = 10 * 60 * 1000
let summary_request
let navigation_abort

export async function load_summary() {
  const element = document.getElementById('total-pageview-count')
  if (!element) return

  const cached = JSON.parse(localStorage.getItem(summary_key) || 'null')
  if (cached && cached.expires_at > Date.now()) {
    element.textContent = String(cached.total)
    return
  }

  element.textContent = '…'
  summary_request ??= fetch('/api/pageview_summary')
    .then((response) => {
      if (!response.ok) throw new Error(`Pageview summary failed: ${response.status}`)
      return response.json()
    })
    .then((summary) => {
      localStorage.setItem(
        summary_key,
        JSON.stringify({ total: summary.total, expires_at: Date.now() + summary_expiry })
      )
      return summary
    })
    .finally(() => {
      summary_request = undefined
    })
  const summary = await summary_request
  element.textContent = String(summary.total)
}

export function init_pageview() {
  navigation_abort?.abort()
  navigation_abort = new AbortController()
  const { signal } = navigation_abort
  const path = document.body.dataset.pageviewPath || window.location.pathname

  const count_pageview = async () => {
    if (document.visibilityState !== 'visible' || signal.aborted) return
    document.removeEventListener('visibilitychange', count_pageview)

    if (!import.meta.env.PROD || window.location.origin !== new URL(import.meta.env.SITE).origin) {
      const stop = pageviewCount({ serverURL: server_url, path, update: false })
      signal.addEventListener('abort', stop, { once: true })
      return
    }

    const response = await fetch(`${server_url}/api/article`, {
      method: 'POST',
      body: new URLSearchParams({ path, type: 'time', action: 'inc' }),
      keepalive: true
    })
    if (!response.ok) throw new Error(`Pageview update failed: ${response.status}`)
    const result = await response.json()
    if (result.errno) throw new Error(`Pageview update failed: ${result.errmsg}`)
    if (signal.aborted) return
    for (const element of document.querySelectorAll('.waline-pageview-count')) {
      if (!element.dataset.path || element.dataset.path === path) {
        element.textContent = String(result.data[0].time)
      }
    }
  }

  document.addEventListener('visibilitychange', count_pageview, { signal })
  count_pageview()

  if (document.querySelector('.waline-comment-count')) {
    import('@waline/client/comment').then(({ commentCount }) => {
      if (signal.aborted) return
      const stop = commentCount({ serverURL: server_url, path })
      signal.addEventListener('abort', stop, { once: true })
    })
  }

  document.addEventListener('astro:before-swap', () => navigation_abort.abort(), {
    once: true,
    signal
  })
}
