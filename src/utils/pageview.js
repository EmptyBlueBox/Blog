/**
 * Pageview statistics utilities (optimized)
 * Provides homepage pageview and site-wide total pageview aggregation.
 *
 * Optimizations:
 * - Parallel startup of independent work
 * - Layered caching strategy
 * - Reduced number of API calls (batching)
 * - Progressive UI updates with graceful partial results
 */

// Cache configuration
const CACHE_CONFIG = {
    BLOG_POSTS_KEY: 'blog-posts-cache',
    BLOG_POSTS_TIME_KEY: 'blog-posts-cache-time',
    SITE_SUMMARY_KEY: 'site-pageview-summary-cache',
    SITE_SUMMARY_TIME_KEY: 'site-pageview-summary-cache-time',
    BLOG_POSTS_EXPIRY: 24 * 60 * 60 * 1000, // 24h
    PAGEVIEW_EXPIRY: 10 * 60 * 1000, // 10m
}

// Server configuration
const SERVER_URL = 'https://waline.lyt0112.com'
const MAIN_PATHS = ['/', '/about', '/projects', '/projects/DexterCap', '/projects/treehole', '/blog', '/links', '/search', '/tags']
const BLOG_PATHS = [
    '/blog/blindfold-zh',
    '/blog/clock',
    '/blog/compiler_principles_lab_note-zh',
    '/blog/course_review-zh',
    '/blog/crystal-zh',
    '/blog/dw1',
    '/blog/dw2',
    '/blog/dw3',
    '/blog/hello_world',
    '/blog/lalaland_competition',
    '/blog/operating_systems_note_01-zh',
    '/blog/operating_systems_note_02-zh',
    '/blog/operating_systems_note_03-zh',
    '/blog/operating_systems_note_04-zh',
    '/blog/operating_systems_note_05-zh',
    '/blog/operating_systems_note_06-zh',
    '/blog/operating_systems_note_07-zh',
    '/blog/operating_systems_note_08-zh',
    '/blog/operating_systems_note_09-zh',
    '/blog/operating_systems_note_10-zh',
    '/blog/operating_systems_note_11-zh',
    '/blog/real_world_rl',
    '/blog/retargeting',
    '/blog/sf_trip',
    '/blog/skewb',
    '/blog/sq1',
    '/blog/this_is_pku',
]

const DEFAULT_COUNTER_LABELS = {
    comment: 'Comments',
    pageview: 'Views',
}
const WALINE_COUNTER_SELECTOR = '.waline-pageview-count, .waline-comment-count'
const walineElementObservers = new WeakMap()
let walineObserverInitialized = false
let walineObserverPending = false

/**
 * Format numbers with thousands separators for consistent UI.
 * @param {number} value - Input count. shape=(), dtype=number.
 * @returns {string} Formatted string value.
 */
function formatFullNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '0'
    }

    const rounded = Math.round(value)
    return rounded.toString()
}

/**
 * Parse Waline counter text content into an integer.
 * @param {string} text - Raw counter text. shape=(), dtype=string.
 * @returns {number} Parsed integer or NaN when unavailable.
 */
function parseCounterValue(text) {
    if (typeof text !== 'string') return Number.NaN
    const normalized = text.replace(/[^0-9]/g, '')
    if (!normalized) return Number.NaN
    return Number.parseInt(normalized, 10)
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
    if (Number.isFinite(previous) && previous === numericValue && element.dataset.counterReady === 'true') {
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
 * Update a Waline pageview counter by path using the already-loaded formatting helpers.
 * @param {string} path - Counter path. shape=(), dtype=string.
 * @param {number} value - Pageview count. shape=(), dtype=number.
 * @returns {void}
 */
function setWalinePageviewCountByPath(path, value) {
    if (typeof document === 'undefined') return
    if (typeof path !== 'string' || path.length === 0) return
    if (typeof value !== 'number' || !Number.isFinite(value)) return

    const element = document.querySelector(`.waline-pageview-count[data-path="${path}"]`)
    if (!(element instanceof HTMLElement)) return

    element.textContent = formatFullNumber(value)
    enhanceWalineCounterElement(element)
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
    if (walineObserverInitialized) return

    if (!document.body) {
        if (!walineObserverPending) {
            walineObserverPending = true
            window.addEventListener('DOMContentLoaded', () => {
                walineObserverPending = false
                setupWalineCounterObserver()
            }, { once: true })
        }
        return
    }

    walineObserverInitialized = true
    document.querySelectorAll(WALINE_COUNTER_SELECTOR).forEach((element) => attachWalineCounterElement(element))

    const rootObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => handleWalineSubtree(node, attachWalineCounterElement))
            mutation.removedNodes.forEach((node) => handleWalineSubtree(node, releaseWalineCounterElement))
        })
    })

    rootObserver.observe(document.body, { childList: true, subtree: true })
}

/**
 * Load Waline pageview (homepage only).
 * @returns {Promise<void>} shape=(), dtype=Promise<void>.
 */
export async function loadWalinePageview() {
    if (typeof window !== 'undefined') {
        setupWalineCounterObserver()
        try {
            // Dynamic import for client-side only
            const { pageviewCount } = await import(
                'https://cdn.jsdelivr.net/npm/@waline/client@v3/dist/pageview.js'
            )
            pageviewCount({
                serverURL: SERVER_URL,
                path: '/', // This only counts homepage visits, not site-wide total
            })
        } catch (error) {
            console.error('Failed to load Waline pageview count:', error)
        }
    }
}

/**
 * Cache utilities
 */
class CacheManager {
    /**
     * Read a value from localStorage with TTL.
     * @param {string} key - Storage key.
     * @param {string} timeKey - Storage key that holds the last write timestamp.
     * @param {number} expiry - Max age in milliseconds.
     * @returns {any|null} Parsed value or null when missing/expired/unavailable.
     */
    static get(key, timeKey, expiry) {
        if (typeof window === 'undefined') return null

        try {
            const data = localStorage.getItem(key)
            const time = localStorage.getItem(timeKey)

            if (data && time && Date.now() - parseInt(time) < expiry) {
                return JSON.parse(data)
            }
        } catch (error) {
            console.warn('Cache read error:', error)
        }

        return null
    }

    /**
     * Write a value to localStorage with timestamp.
     * @param {string} key - Storage key.
     * @param {string} timeKey - Storage key that holds the last write timestamp.
     * @param {any} data - Serializable data to store.
     */
    static set(key, timeKey, data) {
        if (typeof window === 'undefined') return

        try {
            localStorage.setItem(key, JSON.stringify(data))
            localStorage.setItem(timeKey, Date.now().toString())
        } catch (error) {
            console.warn('Cache write error:', error)
        }
    }
}

/**
 * Loading UI state manager for the counter cluster on the homepage
 */
class LoadingUI {
    constructor() {
        this.totalElement = document.getElementById('total-pageview-count')
        this.loadingIndicator = document.getElementById('loading-indicator')
        this.pageviewCounter = document.getElementById('pageview-counter')
        this.progressFill = document.getElementById('progress-fill')
        this.progressText = document.getElementById('progress-text')
        this.isLoading = false
        this.currentProgress = 0
        this.targetProgress = 0
        this.pendingValue = null
        this.progressAnimationFrame = null
        this.autoProgressTimer = null
        this.autoProgressCeiling = 85
        const hasRAF = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        const hasCAF = typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
        this.frameRequester = hasRAF
            ? window.requestAnimationFrame.bind(window)
            : (callback) => setTimeout(callback, 16)
        this.frameCanceller = hasCAF
            ? window.cancelAnimationFrame.bind(window)
            : (handle) => clearTimeout(handle)
    }

    /**
     * Check whether all required DOM elements exist.
     * @returns {boolean} True when all required elements exist.
     */
    isValid() {
        return !!(this.totalElement && this.loadingIndicator && this.pageviewCounter &&
            this.progressFill && this.progressText)
    }

    /**
     * Enter loading state.
     * @returns {boolean} True if the loading state was entered; false if already loading or invalid.
     */
    startLoading() {
        if (this.isLoading || !this.isValid()) return false

        this.isLoading = true
        this.totalElement.dataset.loading = 'true'
        this.totalElement.textContent = '...'
        this.totalElement.classList.add('loading-dots')
        this.loadingIndicator.classList.add('show')
        this.pageviewCounter.classList.add('pulse-loading')
        this.stopAutoProgress()
        this.cancelProgressAnimation()
        this.currentProgress = 0
        this.targetProgress = 0
        this.pendingValue = null
        this.applyProgress(0)
        return true
    }

    /**
     * Exit loading state.
     * @param {number} finalValue - Final pageview value to display.
     */
    endLoading(finalValue) {
        if (!this.isValid()) return

        this.stopAutoProgress()
        this.cancelProgressAnimation()
        this.pendingValue = null
        this.currentProgress = 100
        this.targetProgress = 100
        this.applyProgress(100)
        this.totalElement.textContent = formatFullNumber(finalValue)
        this.totalElement.classList.remove('loading-dots')

        // Delay hiding the indicator so users can see completion
        setTimeout(() => {
            this.loadingIndicator.classList.remove('show')
            this.pageviewCounter.classList.remove('pulse-loading')
            this.isLoading = false
            this.totalElement.dataset.loading = 'false'
        }, 800)
    }

    /**
     * Update progress bar and optionally the current total value.
     * @param {number} percentage - Progress percentage in [0, 100].
     * @param {number} currentValue - Optional current total value for the UI.
     */
    updateProgress(percentage, currentValue = null) {
        if (!this.isValid()) return

        const clampedPercentage = Math.max(0, Math.min(100, percentage))
        this.targetProgress = clampedPercentage

        if (currentValue !== null) {
            this.pendingValue = currentValue
            this.applyProgress(this.currentProgress, this.pendingValue)
        }

        if (this.progressAnimationFrame === null && this.currentProgress !== this.targetProgress) {
            this.scheduleProgressFrame()
        } else if (this.currentProgress === this.targetProgress) {
            this.applyProgress(this.currentProgress, this.pendingValue)
        }
    }

    /**
     * Show error UI state.
     */
    showError() {
        if (!this.isValid()) return

        this.stopAutoProgress()
        this.cancelProgressAnimation()
        this.pendingValue = null
        this.totalElement.textContent = 'Error'
        this.totalElement.classList.remove('loading-dots')
        this.loadingIndicator.classList.remove('show')
        this.pageviewCounter.classList.remove('pulse-loading')
        this.isLoading = false
        this.totalElement.dataset.loading = 'false'
    }

    /**
     * Show partial-loading state when some batches fail.
     * @param {number} finalValue - Final pageview value that was aggregated.
     * @param {number} failedBatches - Number of failed batches.
     */
    showPartialLoading(finalValue, failedBatches) {
        if (!this.isValid()) return

        this.stopAutoProgress()
        this.cancelProgressAnimation()
        this.pendingValue = null
        this.currentProgress = 100
        this.targetProgress = 100
        this.applyProgress(100)
        this.totalElement.textContent = formatFullNumber(finalValue) + '*'
        this.totalElement.title = `Partially loaded data (${failedBatches} batches failed). Click to retry.`
        this.totalElement.classList.remove('loading-dots')

        // Delay hiding the indicator
        setTimeout(() => {
            this.loadingIndicator.classList.remove('show')
            this.pageviewCounter.classList.remove('pulse-loading')
            this.isLoading = false
            this.totalElement.dataset.loading = 'false'
        }, 800)
    }

    /**
     * Apply the visual progress state to UI widgets.
     * @param {number} value - Percentage to render. shape=(), dtype=number.
     * @param {?number} previewValue - Optional preview total value. shape=(), dtype=number|null.
     * @returns {void}
     */
    applyProgress(value, previewValue = null) {
        if (!this.isValid()) return

        const normalized = Math.max(0, Math.min(100, value))
        this.progressFill.style.width = normalized + '%'
        this.progressText.textContent = Math.round(normalized) + '%'

        if (previewValue !== null) {
            this.totalElement.textContent = formatFullNumber(previewValue) + '...'
        }
    }

    /**
     * Schedule the next animation frame for smooth progress transitions.
     * @returns {void}
     */
    scheduleProgressFrame() {
        this.progressAnimationFrame = this.frameRequester(() => this.stepProgressAnimation())
    }

    /**
     * Execute a single animation step and reschedule until the target is reached.
     * @returns {void}
     */
    stepProgressAnimation() {
        const diff = this.targetProgress - this.currentProgress

        if (Math.abs(diff) <= 0.3) {
            this.currentProgress = this.targetProgress
            this.applyProgress(this.currentProgress, this.pendingValue)
            this.progressAnimationFrame = null
            return
        }

        this.currentProgress += diff * 0.18
        this.applyProgress(this.currentProgress, this.pendingValue)
        this.scheduleProgressFrame()
    }

    /**
     * Cancel any pending animation frames.
     * @returns {void}
     */
    cancelProgressAnimation() {
        if (this.progressAnimationFrame !== null) {
            this.frameCanceller(this.progressAnimationFrame)
            this.progressAnimationFrame = null
        }
    }

    /**
     * Begin auto-progress while waiting for long-running network steps.
     * @param {number} maxPercentage - Ceiling percentage before auto-progress stops. shape=(), dtype=number.
     * @returns {void}
     */
    beginAutoProgress(maxPercentage = 85) {
        if (!this.isLoading || !this.isValid()) return

        this.stopAutoProgress()
        this.autoProgressCeiling = Math.max(0, Math.min(100, maxPercentage))
        const schedulerRoot = typeof window !== 'undefined' ? window : globalThis

        this.autoProgressTimer = schedulerRoot.setInterval(() => {
            if (!this.isLoading) {
                this.stopAutoProgress()
                return
            }

            if (this.targetProgress >= this.autoProgressCeiling - 0.5) {
                this.stopAutoProgress()
                return
            }

            const jitter = 0.5 + Math.random() * 1.4
            const nextTarget = Math.min(this.autoProgressCeiling, this.targetProgress + jitter)
            this.updateProgress(nextTarget)
        }, 700)
    }

    /**
     * Stop the auto-progress interval.
     * @returns {void}
     */
    stopAutoProgress() {
        if (this.autoProgressTimer !== null) {
            const schedulerRoot = typeof window !== 'undefined' ? window : globalThis
            schedulerRoot.clearInterval(this.autoProgressTimer)
            this.autoProgressTimer = null
        }
    }
}

/**
 * Network helpers and API client
 */
class PageviewAPI {
    /**
     * Fetch with an AbortController-based timeout.
     * @param {string} url - Request URL.
     * @param {RequestInit} [options] - Fetch options.
     * @param {number} [timeoutMs=10000] - Timeout in milliseconds.
     * @returns {Promise<Response>} Response promise that rejects on timeout.
     */
    static async fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
        const controller = new AbortController()
        const id = setTimeout(() => controller.abort(), timeoutMs)
        try {
            return await fetch(url, { ...options, signal: controller.signal })
        } finally {
            clearTimeout(id)
        }
    }

    /**
     * Get pageviews for a path list with retry and backoff.
     * @param {string[]} paths - Array of pathname strings, e.g., ['/a', '/b'].
     * @param {number} retries - Number of retries on failure.
     * @returns {Promise<{success: boolean, total: number, byPath: Record<string, number>, error?: Error}>}
     */
    static async getPathsPageviews(paths, retries = 2) {
        if (paths.length === 0) {
            return { success: true, total: 0, byPath: Object.create(null) }
        }

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                // "time" is the field for pageview in Waline REST API
                const apiURL = `${SERVER_URL}/api/article?path=${encodeURIComponent(paths.join(','))}&type=${encodeURIComponent('time')}&lang=en-US`
                console.debug(`Fetching pageviews for ${paths.length} paths (attempt ${attempt + 1}/${retries + 1})`)

                const response = await PageviewAPI.fetchWithTimeout(apiURL, {
                    method: 'GET',
                    cache: 'no-cache',
                }, 10000)

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }

                const result = await response.json()

                if (result.data && Array.isArray(result.data)) {
                    const byPath = Object.create(null)
                    let total = 0

                    for (let index = 0; index < paths.length; index++) {
                        const item = result.data[index]
                        const value = item && typeof item.time === 'number' ? item.time : 0
                        byPath[paths[index]] = value
                        total += value
                    }

                    console.debug(`Successfully fetched ${total} pageviews for ${paths.length} paths`)
                    return { success: true, total, byPath }
                }

                throw new Error('Invalid response data structure')
            } catch (error) {
                console.warn(`Attempt ${attempt + 1} failed for ${paths.length} paths:`, error.message)

                if (attempt < retries) {
                    // Exponential backoff: 1s, 2s, then cap at 5s
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
                    console.debug(`Retrying in ${delay}ms...`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                } else {
                    return { success: false, total: 0, byPath: Object.create(null), error }
                }
            }
        }

        return { success: false, total: 0, byPath: Object.create(null), error: new Error('Max retries exceeded') }
    }

    /**
     * Get blog post paths.
     *
     * Preference order:
     * 1. Dynamic list injected on the homepage via `window.__WALINE_PAGEVIEW_PATHS__`
     * 2. Cached list in localStorage
     * 3. Manually configured fallback `BLOG_PATHS`
     *
     * @param {boolean} forceRefresh - When true, bypass localStorage cache. shape=(), dtype=boolean.
     * @returns {Promise<string[]>} Blog pathname list. shape=(N,), dtype=string[].
     */
    static async getBlogPostPaths(forceRefresh = false) {
        // Step 1: use dynamic paths from the homepage when available
        if (typeof window !== 'undefined') {
            const dynamicPaths = window.__WALINE_PAGEVIEW_PATHS__
            if (Array.isArray(dynamicPaths) && dynamicPaths.length > 0) {
                return dynamicPaths
            }
        }

        // Step 2: fall back to cached paths
        if (!forceRefresh) {
            const cached = CacheManager.get(
                CACHE_CONFIG.BLOG_POSTS_KEY,
                CACHE_CONFIG.BLOG_POSTS_TIME_KEY,
                CACHE_CONFIG.BLOG_POSTS_EXPIRY
            )
            if (cached && Array.isArray(cached)) {
                return cached
            }
        }

        // Step 3: cache and return the manual fallback list
        CacheManager.set(
            CACHE_CONFIG.BLOG_POSTS_KEY,
            CACHE_CONFIG.BLOG_POSTS_TIME_KEY,
            BLOG_PATHS
        )

        return BLOG_PATHS
    }
}

/**
 * Load total site pageviews and update the homepage widgets.
 *
 * Behavior:
 * - Reads cached value and show it immediately when valid
 * - Uses Waline REST API to fetch main pages and all blog posts in a single request
 * - Prefers homepage-injected blog paths to avoid manual maintenance
 *
 * @param {boolean} forceRefresh - When true, bypass caches. shape=(), dtype=boolean.
 * @returns {Promise<void>} shape=(), dtype=Promise<void>.
 */
export async function loadTotalPageviews(forceRefresh = false) {
    if (typeof window === 'undefined') return

    const ui = new LoadingUI()
    if (!ui.isValid()) {
        console.warn('Required elements not found for total pageview count')
        return
    }

    // Prevent duplicate loads.
    if (!ui.startLoading()) return

    try {
        // Step 1: show cached summary if available
        if (!forceRefresh) {
            const cachedSummary = CacheManager.get(
                CACHE_CONFIG.SITE_SUMMARY_KEY,
                CACHE_CONFIG.SITE_SUMMARY_TIME_KEY,
                CACHE_CONFIG.PAGEVIEW_EXPIRY
            )

            if (cachedSummary && typeof cachedSummary.total === 'number') {
                ui.endLoading(cachedSummary.total)
                if (typeof cachedSummary.home === 'number') {
                    setWalinePageviewCountByPath('/', cachedSummary.home)
                }
                return
            }
        }

        // Step 2: get dynamic blog post paths and merge with main paths
        const blogPosts = await PageviewAPI.getBlogPostPaths(forceRefresh)
        ui.updateProgress(30)
        const allPaths = Array.from(new Set([...MAIN_PATHS, ...blogPosts]))

        if (allPaths.length === 0) {
            // No known paths; treat as zero and cache briefly
            CacheManager.set(CACHE_CONFIG.SITE_SUMMARY_KEY, CACHE_CONFIG.SITE_SUMMARY_TIME_KEY, { total: 0, home: 0 })
            ui.endLoading(0)
            setWalinePageviewCountByPath('/', 0)
            return
        }

        ui.updateProgress(55)
        ui.beginAutoProgress(82)

        // Step 3: single Waline REST API call for all paths
        const result = await PageviewAPI.getPathsPageviews(allPaths)
        ui.stopAutoProgress()

        if (!result.success) {
            console.error('Failed to fetch total pageviews:', result.error)

            // Try stale cache (up to 24h) as a graceful fallback
            const fallbackSummary = CacheManager.get(
                CACHE_CONFIG.SITE_SUMMARY_KEY,
                CACHE_CONFIG.SITE_SUMMARY_TIME_KEY,
                24 * 60 * 60 * 1000 // accept stale cache up to 24h
            )

            if (fallbackSummary && typeof fallbackSummary.total === 'number') {
                console.warn(`Using fallback site summary: total=${fallbackSummary.total}`)
                ui.endLoading(fallbackSummary.total)
                if (typeof fallbackSummary.home === 'number') {
                    setWalinePageviewCountByPath('/', fallbackSummary.home)
                }
            } else {
                ui.showError()
            }

            return
        }

        const homeCount = typeof result.byPath['/'] === 'number' ? result.byPath['/'] : 0
        const finalTotal = result.total
        setWalinePageviewCountByPath('/', homeCount)

        CacheManager.set(CACHE_CONFIG.SITE_SUMMARY_KEY, CACHE_CONFIG.SITE_SUMMARY_TIME_KEY, { total: finalTotal, home: homeCount })

        ui.updateProgress(95, finalTotal)
        ui.endLoading(finalTotal)

    } catch (error) {
        console.error('Error fetching total pageview count:', error)
        ui.showError()
    }
}

/**
 * Initialize Waline counters for views and comments on single post pages.
 * @param {string} path - Current article path. shape=(), dtype=string.
 * @param {boolean} includeComment - Whether comment counter should be updated. shape=(), dtype=boolean.
 * @returns {Promise<void>} shape=(), dtype=Promise<void>.
 */
export async function initPostWalineCounters(path, includeComment = true) {
    if (typeof window === 'undefined') return

    setupWalineCounterObserver()
    try {
        const waline = await import('https://cdn.jsdelivr.net/npm/@waline/client@v3/dist/pageview.js')

        if (typeof waline.pageviewCount === 'function') {
            waline.pageviewCount({
                serverURL: SERVER_URL,
                path,
            })
        }

        if (includeComment && typeof waline.commentCount === 'function') {
            waline.commentCount({
                serverURL: SERVER_URL,
                path,
            })
        }
    } catch (error) {
        console.error('Failed to initialize Waline counters:', error)
    }
}

/**
 * Initialize the homepage pageview counter widgets.
 * @returns {void}
 */
export function initPageviewCounter() {
    if (typeof window === 'undefined') return

    setupWalineCounterObserver()

    // Load homepage pageview via Waline (this increments the server-side counter).
    loadWalinePageview()

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

/**
 * Standalone entry point for exercising number-format helpers.
 * @returns {void}
 */
export function main() {
    const samples = [0, 12, 3456, 987654]
    console.log('formatFullNumber samples:')
    samples.forEach((value) => {
        console.log(`  ${value} -> ${formatFullNumber(value)}`)
    })

    console.log('parseCounterValue("1,234") =>', parseCounterValue('1,234'))
    console.log('Known MAIN_PATHS count =>', MAIN_PATHS.length)
    console.log('Known BLOG_PATHS fallback count =>', BLOG_PATHS.length)
}

if (typeof process !== 'undefined' && Array.isArray(process.argv)) {
    const directScript = process.argv[1]
    if (typeof directScript === 'string' && directScript.endsWith('pageview.js')) {
        main()
    }
}
