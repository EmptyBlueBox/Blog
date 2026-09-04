const server_url = 'https://waline.lyt0112.com'
const summary_key = 'site_pageview_summary'
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
    .then((response) => response.json())
    .then((summary) => {
      localStorage.setItem(
        summary_key,
        JSON.stringify({ total: summary.total, expires_at: Date.now() + summary_expiry })
      )
      summary_request = undefined
      return summary
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
    const { pageviewCount } = await import('@waline/client/pageview')
    if (signal.aborted) return
    const stop = pageviewCount({ serverURL: server_url, path })
    signal.addEventListener('abort', stop, { once: true })
  }

  if (document.visibilityState === 'visible') count_pageview()
  else document.addEventListener('visibilitychange', count_pageview, { once: true, signal })

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
