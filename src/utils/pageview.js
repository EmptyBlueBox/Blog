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
    MAIN_PAGEVIEW_KEY: 'main-pageview-cache',
    MAIN_PAGEVIEW_TIME_KEY: 'main-pageview-cache-time',
    TOTAL_PAGEVIEW_KEY: 'total-pageview-cache',
    TOTAL_PAGEVIEW_TIME_KEY: 'total-pageview-cache-time',
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
    '/blog/retargeting',
    '/blog/sf_trip',
    '/blog/skewb',
    '/blog/sq1',
    '/blog/this_is_pku',
]

/**
 * Load Waline pageview (homepage only)
 */
export async function loadWalinePageview() {
    if (typeof window !== 'undefined') {
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
        this.updateProgress(0)
        return true
    }

    /**
     * Exit loading state.
     * @param {number} finalValue - Final pageview value to display.
     */
    endLoading(finalValue) {
        if (!this.isValid()) return

        this.totalElement.textContent = finalValue.toString()
        this.totalElement.classList.remove('loading-dots')
        this.updateProgress(100)

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
        this.progressFill.style.width = clampedPercentage + '%'
        this.progressText.textContent = Math.round(clampedPercentage) + '%'

        if (currentValue !== null) {
            this.totalElement.textContent = currentValue.toString() + '...'
        }
    }

    /**
     * Show error UI state.
     */
    showError() {
        if (!this.isValid()) return

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

        this.totalElement.textContent = finalValue.toString() + '*'
        this.totalElement.title = `Partially loaded data (${failedBatches} batches failed). Click to retry.`
        this.totalElement.classList.remove('loading-dots')
        this.updateProgress(100)

        // Delay hiding the indicator
        setTimeout(() => {
            this.loadingIndicator.classList.remove('show')
            this.pageviewCounter.classList.remove('pulse-loading')
            this.isLoading = false
            this.totalElement.dataset.loading = 'false'
        }, 800)
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
     * Get aggregated pageviews for given paths with retry and backoff.
     * @param {string[]} paths - Array of pathname strings, e.g., ['/a', '/b'].
     * @param {number} retries - Number of retries on failure.
     * @returns {Promise<{success: boolean, count: number, error?: Error}>}
     */
    static async getPathsPageviews(paths, retries = 2) {
        if (paths.length === 0) return { success: true, count: 0 }

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
                    const count = result.data.reduce((sum, item) => {
                        return sum + (typeof item.time === 'number' ? item.time : 0)
                    }, 0)
                    console.debug(`Successfully fetched ${count} pageviews for ${paths.length} paths`)
                    return { success: true, count }
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
                    return { success: false, count: 0, error }
                }
            }
        }

        return { success: false, count: 0, error: new Error('Max retries exceeded') }
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

    // 防止重复加载
    if (!ui.startLoading()) return

    try {
        // Step 1: show cached total if available
        if (!forceRefresh) {
            const cachedTotal = CacheManager.get(
                CACHE_CONFIG.TOTAL_PAGEVIEW_KEY,
                CACHE_CONFIG.TOTAL_PAGEVIEW_TIME_KEY,
                CACHE_CONFIG.PAGEVIEW_EXPIRY
            )

            if (typeof cachedTotal === 'number') {
                ui.endLoading(cachedTotal)
                return
            }
        }

        // Step 2: get dynamic blog post paths and merge with main paths
        ui.updateProgress(10)

        const blogPosts = await PageviewAPI.getBlogPostPaths(forceRefresh)
        const allPaths = Array.from(new Set([...MAIN_PATHS, ...blogPosts]))

        if (allPaths.length === 0) {
            // No known paths; treat as zero and cache briefly
            CacheManager.set(
                CACHE_CONFIG.TOTAL_PAGEVIEW_KEY,
                CACHE_CONFIG.TOTAL_PAGEVIEW_TIME_KEY,
                0
            )
            ui.endLoading(0)
            return
        }

        ui.updateProgress(40)

        // Step 3: single Waline REST API call for all paths
        const result = await PageviewAPI.getPathsPageviews(allPaths)

        if (!result.success) {
            console.error('Failed to fetch total pageviews:', result.error)

            // Try stale cache (up to 24h) as a graceful fallback
            const fallbackTotal = CacheManager.get(
                CACHE_CONFIG.TOTAL_PAGEVIEW_KEY,
                CACHE_CONFIG.TOTAL_PAGEVIEW_TIME_KEY,
                24 * 60 * 60 * 1000 // accept stale cache up to 24h
            )

            if (typeof fallbackTotal === 'number') {
                console.warn(`Using fallback total pageviews: ${fallbackTotal}`)
                ui.endLoading(fallbackTotal)
            } else {
                ui.showError()
            }

            return
        }

        const finalTotal = result.count

        CacheManager.set(
            CACHE_CONFIG.TOTAL_PAGEVIEW_KEY,
            CACHE_CONFIG.TOTAL_PAGEVIEW_TIME_KEY,
            finalTotal
        )

        ui.updateProgress(90, finalTotal)
        ui.endLoading(finalTotal)

    } catch (error) {
        console.error('Error fetching total pageview count:', error)
        ui.showError()
    }
}

/**
 * Initialize the homepage pageview counter widgets.
 */
/**
 * Initialize Waline counters for views and comments on single post pages.
 * @param {string} path - Current article path. shape=(), dtype=string.
 * @param {boolean} includeComment - Whether comment counter should be updated. shape=(), dtype=boolean.
 */
export async function initPostWalineCounters(path, includeComment = true) {
    if (typeof window === 'undefined') return

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

export function initPageviewCounter() {
    if (typeof window === 'undefined') return

    // Load homepage pageview via Waline
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
