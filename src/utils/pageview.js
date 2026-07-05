const CACHE_CONFIG = {
  SITE_SUMMARY_KEY: 'site-pageview-summary-cache',
  SITE_SUMMARY_TIME_KEY: 'site-pageview-summary-cache-time',
  PAGEVIEW_EXPIRY: 10 * 60 * 1000
}

const SERVER_URL = 'https://waline.lyt0112.com'
const SUMMARY_URL = '/api/pageview_summary'

const DEFAULT_COUNTER_LABELS = {
  comment: 'Comments',
  pageview: 'Views'
}
const WALINE_COUNTER_SELECTOR = '.waline-pageview-count, .waline-comment-count'
const walineElementObservers = new WeakMap()
let walineRootObserver = null
let walineObservedBody = null

function formatFullNumber(value) {
  return Number.isFinite(value) ? Math.round(value).toString() : '0'
}

function parseCounterValue(text) {
  if (typeof text !== 'string') return Number.NaN
  const normalized = text.replace(/[^0-9]/g, '')
  return normalized ? Number.parseInt(normalized, 10) : Number.NaN
}

function getCounterLabel(element) {
  if (!(element instanceof HTMLElement)) return DEFAULT_COUNTER_LABELS.pageview
  const customLabel = element.dataset.counterLabel
  if (typeof customLabel === 'string' && customLabel.trim().length > 0) {
    return customLabel
  }
  return element.classList.contains('waline-comment-count')
    ? DEFAULT_COUNTER_LABELS.comment
    : DEFAULT_COUNTER_LABELS.pageview
}

function enhanceWalineCounterElement(element) {
  if (!(element instanceof HTMLElement)) return
  const numericValue = parseCounterValue(element.textContent ?? '')
  if (!Number.isFinite(numericValue)) return

  const previous = Number(element.dataset.rawValue)
  if (
    Number.isFinite(previous) &&
    previous === numericValue &&
    element.dataset.counterReady === 'true'
  ) {
    return
  }

  const formatted = formatFullNumber(numericValue)
  const label = getCounterLabel(element)
  element.dataset.rawValue = numericValue.toString()
  element.dataset.counterReady = 'true'
  element.setAttribute('aria-live', 'polite')
  element.title = `${formatted} ${label.toLowerCase()}`
  element.textContent = formatted
  element.classList.add('waline-counter-ready')
  element.classList.remove('waline-counter-placeholder')
}

function attachWalineCounterElement(element) {
  if (!(element instanceof HTMLElement)) return
  if (walineElementObservers.has(element)) {
    enhanceWalineCounterElement(element)
    return
  }

  element.classList.add('waline-counter-placeholder')
  const observer = new MutationObserver(() => {
    enhanceWalineCounterElement(element)
  })

  observer.observe(element, { childList: true, characterData: true, subtree: true })
  walineElementObservers.set(element, observer)
  enhanceWalineCounterElement(element)
}

function releaseWalineCounterElement(element) {
  if (!(element instanceof HTMLElement)) return
  const observer = walineElementObservers.get(element)
  if (observer) {
    observer.disconnect()
    walineElementObservers.delete(element)
  }
}

function handleWalineSubtree(node, handler) {
  if (!(node instanceof HTMLElement)) return
  if (node.matches(WALINE_COUNTER_SELECTOR)) {
    handler(node)
  }
  node.querySelectorAll?.(WALINE_COUNTER_SELECTOR).forEach((el) => handler(el))
}

function setupWalineCounterObserver() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  // The client router swaps <body> on navigation, so re-attach when it changes
  if (document.body === walineObservedBody) return
  walineObservedBody = document.body

  document
    .querySelectorAll(WALINE_COUNTER_SELECTOR)
    .forEach((element) => attachWalineCounterElement(element))

  walineRootObserver?.disconnect()
  walineRootObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => handleWalineSubtree(node, attachWalineCounterElement))
      mutation.removedNodes.forEach((node) =>
        handleWalineSubtree(node, releaseWalineCounterElement)
      )
    })
  })

  walineRootObserver.observe(document.body, { childList: true, subtree: true })
}

function getCachedValue(key, timeKey, expiry) {
  if (typeof window === 'undefined') return null

  const data = localStorage.getItem(key)
  const time = localStorage.getItem(timeKey)
  return data && time && Date.now() - Number.parseInt(time, 10) < expiry ? JSON.parse(data) : null
}

function setCachedValue(key, timeKey, data) {
  if (typeof window === 'undefined') return

  localStorage.setItem(key, JSON.stringify(data))
  localStorage.setItem(timeKey, Date.now().toString())
}

async function getSummary(fresh = false) {
  const url = new URL(SUMMARY_URL, window.location.origin)
  if (fresh) url.searchParams.set('fresh', '1')
  return await (await fetch(url, { cache: 'no-store' })).json()
}

export async function loadTotalPageviews(forceRefresh = false) {
  if (typeof window === 'undefined') return

  const totalElement = document.getElementById('total-pageview-count')
  if (!totalElement) return

  const cachedSummary = forceRefresh
    ? null
    : getCachedValue(
        CACHE_CONFIG.SITE_SUMMARY_KEY,
        CACHE_CONFIG.SITE_SUMMARY_TIME_KEY,
        CACHE_CONFIG.PAGEVIEW_EXPIRY
      )

  const showLoading = forceRefresh || !(cachedSummary && typeof cachedSummary.total === 'number')

  if (showLoading) {
    if (totalElement.dataset.loading === 'true') return
    totalElement.dataset.loading = 'true'
    totalElement.dataset.partial = 'false'
    totalElement.textContent = '...'
  } else {
    totalElement.textContent = formatFullNumber(cachedSummary.total)
    totalElement.dataset.loading = 'false'
  }

  const summary = await getSummary(forceRefresh)

  setCachedValue(CACHE_CONFIG.SITE_SUMMARY_KEY, CACHE_CONFIG.SITE_SUMMARY_TIME_KEY, {
    total: summary.total,
    total_paths: summary.total_paths
  })

  totalElement.textContent = formatFullNumber(summary.total)
  totalElement.dataset.loading = 'false'
}

export async function initCurrentPageview(path = window.location.pathname) {
  if (typeof window === 'undefined') return

  setupWalineCounterObserver()

  if (document.visibilityState === 'visible') {
    const { pageviewCount } = await import('@waline/client/pageview')
    pageviewCount({ serverURL: SERVER_URL, path })
    return
  }

  document.addEventListener(
    'visibilitychange',
    async () => {
      if (document.visibilityState === 'visible') {
        const { pageviewCount } = await import('@waline/client/pageview')
        pageviewCount({ serverURL: SERVER_URL, path })
      }
    },
    { once: true }
  )
}

export async function initPostWalineCounters(
  pageviewPath,
  commentPath = pageviewPath,
  includeComment = true
) {
  if (typeof window === 'undefined') return

  setupWalineCounterObserver()
  const { pageviewCount } = await import('@waline/client/pageview')
  pageviewCount({ serverURL: SERVER_URL, path: pageviewPath, update: false })
  if (includeComment) {
    const { commentCount } = await import('@waline/client/comment')
    commentCount({ serverURL: SERVER_URL, path: commentPath })
  }
}

export function initPageviewCounter() {
  if (typeof window === 'undefined') return

  setupWalineCounterObserver()

  const totalElement = document.getElementById('total-pageview-count')
  if (totalElement) {
    const triggerRefresh = () => {
      if (totalElement.dataset.loading !== 'true') {
        loadTotalPageviews(true)
      }
    }

    totalElement.addEventListener('click', triggerRefresh)
    totalElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        triggerRefresh()
      }
    })
  }

  loadTotalPageviews()
}
