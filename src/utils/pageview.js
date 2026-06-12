/**
 * Pageview statistics utilities (optimized)
 * Provides site-wide total pageview aggregation.
 *
 * Optimizations:
 * - Layered caching strategy
 * - Progressive aggregation in small batches
 * - Progress percentage reflects received page counts
 */

// Cache configuration
const CACHE_CONFIG = {
  SITE_SUMMARY_KEY: 'site-pageview-summary-cache',
  SITE_SUMMARY_TIME_KEY: 'site-pageview-summary-cache-time',
  PAGEVIEW_EXPIRY: 10 * 60 * 1000 // 10m
}

// Server configuration
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

/**
 * Format numbers with thousands separators for consistent UI.
 * @param {number} value - Input count. shape=(), dtype=number.
 * @returns {string} Formatted string value.
 */
function formatFullNumber(value) {
  return Number.isFinite(value) ? Math.round(value).toString() : '0'
}

/**
 * Parse Waline counter text content into an integer.
 * @param {string} text - Raw counter text. shape=(), dtype=string.
 * @returns {number} Parsed integer or NaN when unavailable.
 */
function parseCounterValue(text) {
  if (typeof text !== 'string') return Number.NaN
  const normalized = text.replace(/[^0-9]/g, '')
  return normalized ? Number.parseInt(normalized, 10) : Number.NaN
}

/**
 * Resolve a friendly label for Waline counters.
 * @param {HTMLElement} element - Target counter element. shape=(), dtype=HTMLElement.
 * @returns {string} Human-readable label.
 */
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

/**
 * Update a Waline counter node with formatted text and accessibility metadata.
 * @param {HTMLElement} element - Target element. shape=(), dtype=HTMLElement.
 * @returns {void}
 */
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

/**
 * Attach per-element observers so that Waline mutations stay formatted.
 * @param {HTMLElement} element - Target counter element. shape=(), dtype=HTMLElement.
 * @returns {void}
 */
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

/**
 * Disconnect MutationObserver for a Waline counter node.
 * @param {HTMLElement} element - Target element. shape=(), dtype=HTMLElement.
 * @returns {void}
 */
function releaseWalineCounterElement(element) {
  if (!(element instanceof HTMLElement)) return
  const observer = walineElementObservers.get(element)
  if (observer) {
    observer.disconnect()
    walineElementObservers.delete(element)
  }
}

/**
 * Traverse the node (and descendants) applying a handler for matching Waline counters.
 * @param {Node} node - Root node to inspect. shape=(), dtype=Node.
 * @param {(element: HTMLElement) => void} handler - Callback used for matching nodes.
 * @returns {void}
 */
function handleWalineSubtree(node, handler) {
  if (!(node instanceof HTMLElement)) return
  if (node.matches(WALINE_COUNTER_SELECTOR)) {
    handler(node)
  }
  node.querySelectorAll?.(WALINE_COUNTER_SELECTOR).forEach((el) => handler(el))
}

/**
 * Bootstrap observers that keep Waline counters formatted after dynamic updates.
 * @returns {void}
 */
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

/**
 * Read a cached JSON value from localStorage when it is still fresh.
 * @param {string} key - Storage key. shape=(), dtype=string.
 * @param {string} timeKey - Storage key that holds the last write timestamp. shape=(), dtype=string.
 * @param {number} expiry - Max age in milliseconds. shape=(), dtype=number.
 * @returns {any|null} Parsed value or null when the cache is missing or expired.
 */
function getCachedValue(key, timeKey, expiry) {
  if (typeof window === 'undefined') return null

  const data = localStorage.getItem(key)
  const time = localStorage.getItem(timeKey)
  return data && time && Date.now() - Number.parseInt(time, 10) < expiry ? JSON.parse(data) : null
}

/**
 * Persist a JSON value and its timestamp in localStorage.
 * @param {string} key - Storage key. shape=(), dtype=string.
 * @param {string} timeKey - Storage key that holds the last write timestamp. shape=(), dtype=string.
 * @param {any} data - Serializable data to store. shape=(), dtype=object.
 * @returns {void}
 */
function setCachedValue(key, timeKey, data) {
  if (typeof window === 'undefined') return

  localStorage.setItem(key, JSON.stringify(data))
  localStorage.setItem(timeKey, Date.now().toString())
}

/**
 * Fetch site pageview summary.
 * @param {boolean} fresh - When true, ask the server to bypass caches. shape=(), dtype=boolean.
 * @returns {Promise<{total: number, home: number, total_paths: number, received_paths: number}>} Summary metadata.
 */
async function getSummary(fresh = false) {
  const url = new URL(SUMMARY_URL, window.location.origin)
  if (fresh) url.searchParams.set('fresh', '1')
  return await (await fetch(url, { cache: 'no-store' })).json()
}

/**
 * Load total site pageviews and update the footer widget.
 *
 * Behavior:
 * - Reads cached value and show it immediately when valid
 * - Aggregates all site pages with one summary request
 *
 * @param {boolean} forceRefresh - When true, bypass caches. shape=(), dtype=boolean.
 * @returns {Promise<void>} shape=(), dtype=Promise<void>.
 */
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

/**
 * Increment the current route pageview once the document becomes visible.
 * @param {string} path - Current route pathname. shape=(), dtype=string.
 * @returns {Promise<void>} shape=(), dtype=Promise<void>.
 */
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

/**
 * Initialize Waline counters for views and comments on a page.
 * @param {string} pageviewPath - View counter path. shape=(), dtype=string.
 * @param {string} commentPath - Comment counter path. shape=(), dtype=string.
 * @param {boolean} includeComment - Whether comment counter should be updated. shape=(), dtype=boolean.
 * @returns {Promise<void>} shape=(), dtype=Promise<void>.
 */
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

/**
 * Initialize the homepage pageview counter widgets.
 * @returns {void}
 */
export function initPageviewCounter() {
  if (typeof window === 'undefined') return

  setupWalineCounterObserver()

  // Add click-to-refresh for total site pageviews
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

  // Initial load for total site pageviews
  loadTotalPageviews()
}
