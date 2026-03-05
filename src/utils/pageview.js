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
    SITE_SUMMARY_KEY: 'site-pageview-summary-cache',
    SITE_SUMMARY_TIME_KEY: 'site-pageview-summary-cache-time',
    PAGEVIEW_EXPIRY: 10 * 60 * 1000, // 10m
}

// Server configuration
const SERVER_URL = 'https://waline.lyt0112.com'
const SUMMARY_URL = '/api/pageview_summary'
const SUMMARY_TITLE = 'Click to refresh (main pages and blog posts)'

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
        if (this.totalElement.dataset.loading === 'true') return false

        this.isLoading = true
        this.totalElement.dataset.loading = 'true'
        this.totalElement.textContent = '...'
        this.loadingIndicator.classList.add('show')
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
        this.pendingValue = null
        this.updateProgress(100)
        this.totalElement.textContent = formatFullNumber(finalValue)

        // Delay hiding the indicator so users can see completion
        setTimeout(() => {
            this.loadingIndicator.classList.remove('show')
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
        this.loadingIndicator.classList.remove('show')
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

        // Delay hiding the indicator
        setTimeout(() => {
            this.loadingIndicator.classList.remove('show')
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

            if (this.targetProgress >= this.autoProgressCeiling - 0.1) {
                this.stopAutoProgress()
                return
            }

            const remaining = this.autoProgressCeiling - this.targetProgress
            const step = Math.max(0.4, remaining * 0.12)
            const nextTarget = Math.min(this.autoProgressCeiling, this.targetProgress + step)
            this.updateProgress(nextTarget)
        }, 250)
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
     * Fetch the cached homepage summary from the local API route.
     * @returns {Promise<{home: number, total: number}>} Homepage and summary counts.
     */
    static async getSummary() {
        const response = await fetch(SUMMARY_URL, { cache: 'no-store' })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.json()
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

    const cachedSummary = forceRefresh
        ? null
        : CacheManager.get(
            CACHE_CONFIG.SITE_SUMMARY_KEY,
            CACHE_CONFIG.SITE_SUMMARY_TIME_KEY,
            CACHE_CONFIG.PAGEVIEW_EXPIRY
        )

    const showLoading = forceRefresh || !(cachedSummary && typeof cachedSummary.total === 'number')

    if (showLoading) {
        if (!ui.startLoading()) return
        ui.updateProgress(35)
        ui.beginAutoProgress(85)
    } else {
        ui.totalElement.textContent = formatFullNumber(cachedSummary.total)
        ui.totalElement.title = SUMMARY_TITLE
        ui.totalElement.dataset.loading = 'false'
    }

    try {
        const summary = await PageviewAPI.getSummary()
        const totalCount = typeof summary.total === 'number' ? summary.total : 0

        CacheManager.set(CACHE_CONFIG.SITE_SUMMARY_KEY, CACHE_CONFIG.SITE_SUMMARY_TIME_KEY, {
            total: totalCount,
        })

        if (showLoading) {
            ui.stopAutoProgress()
            ui.endLoading(totalCount)
        } else {
            ui.totalElement.textContent = formatFullNumber(totalCount)
            ui.totalElement.title = SUMMARY_TITLE
        }
    } catch (error) {
        if (showLoading) {
            ui.showError()
        }
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
        const { pageviewCount } = await import('@waline/client/pageview')
        pageviewCount({ serverURL: SERVER_URL, path })
        if (includeComment) {
            const { commentCount } = await import('@waline/client/comment')
            commentCount({ serverURL: SERVER_URL, path })
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
    console.log('Summary API =>', SUMMARY_URL)
}

if (typeof process !== 'undefined' && Array.isArray(process.argv)) {
    const directScript = process.argv[1]
    if (typeof directScript === 'string' && directScript.endsWith('pageview.js')) {
        main()
    }
}
