/**
 * 页面访问量统计工具 - 优化版本
 * 包含主页访问量和站点总访问量的统计功能
 * 
 * 优化特性：
 * - 并行加载多个数据源
 * - 分层缓存策略
 * - 减少API调用次数
 * - 渐进式加载体验
 */

// 缓存配置
const CACHE_CONFIG = {
    BLOG_POSTS_KEY: 'blog-posts-cache',
    BLOG_POSTS_TIME_KEY: 'blog-posts-cache-time',
    MAIN_PAGEVIEW_KEY: 'main-pageview-cache',
    MAIN_PAGEVIEW_TIME_KEY: 'main-pageview-cache-time',
    TOTAL_PAGEVIEW_KEY: 'total-pageview-cache',
    TOTAL_PAGEVIEW_TIME_KEY: 'total-pageview-cache-time',
    BLOG_POSTS_EXPIRY: 24 * 60 * 60 * 1000, // 24小时
    PAGEVIEW_EXPIRY: 10 * 60 * 1000, // 10分钟
}

// 服务器配置
const SERVER_URL = 'https://waline.lyt0112.com'
const MAIN_PATHS = ['/', '/about', '/projects', '/projects/DexterCap', '/projects/treehole', '/blog', '/links', '/search', '/tags']

/**
 * 加载Waline页面访问量统计（仅用于首页）
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
                path: '/' // This only counts homepage visits, not site-wide total
            })
        } catch (error) {
            console.error('Failed to load Waline pageview count:', error)
        }
    }
}

/**
 * 缓存工具类
 */
class CacheManager {
    /**
     * 获取缓存数据
     * @param {string} key - 缓存键
     * @param {string} timeKey - 时间键
     * @param {number} expiry - 过期时间（毫秒）
     * @returns {any|null} 缓存的数据或null
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
     * 设置缓存数据
     * @param {string} key - 缓存键
     * @param {string} timeKey - 时间键
     * @param {any} data - 要缓存的数据
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
 * UI状态管理类
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
     * 检查所有必需的DOM元素是否存在
     * @returns {boolean} 元素是否都存在
     */
    isValid() {
        return !!(this.totalElement && this.loadingIndicator && this.pageviewCounter &&
            this.progressFill && this.progressText)
    }

    /**
     * 开始加载状态
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
     * 结束加载状态
     * @param {number} finalValue - 最终的访问量数值
     */
    endLoading(finalValue) {
        if (!this.isValid()) return

        this.totalElement.textContent = finalValue.toString()
        this.totalElement.classList.remove('loading-dots')
        this.updateProgress(100)

        // 延迟隐藏加载指示器，让用户看到完成状态
        setTimeout(() => {
            this.loadingIndicator.classList.remove('show')
            this.pageviewCounter.classList.remove('pulse-loading')
            this.isLoading = false
            this.totalElement.dataset.loading = 'false'
        }, 800)
    }

    /**
     * 更新进度和显示值
     * @param {number} percentage - 进度百分比
     * @param {number} currentValue - 当前值（可选）
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
     * 显示错误状态
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
     * 显示部分加载状态
     * @param {number} finalValue - 最终的访问量数值
     * @param {number} failedBatches - 失败的批次数量
     */
    showPartialLoading(finalValue, failedBatches) {
        if (!this.isValid()) return

        this.totalElement.textContent = finalValue.toString() + '*'
        this.totalElement.title = `Partially loaded data (${failedBatches} batches failed). Click to retry.`
        this.totalElement.classList.remove('loading-dots')
        this.updateProgress(100)

        // 延迟隐藏加载指示器
        setTimeout(() => {
            this.loadingIndicator.classList.remove('show')
            this.pageviewCounter.classList.remove('pulse-loading')
            this.isLoading = false
            this.totalElement.dataset.loading = 'false'
        }, 800)
    }
}

/**
 * API请求管理类
 */
class PageviewAPI {
    /**
 * 获取指定路径的访问量（带重试机制）
 * @param {string[]} paths - 路径数组
 * @param {number} retries - 重试次数
 * @returns {Promise<{success: boolean, count: number, error?: Error}>} 请求结果
 */
    static async getPathsPageviews(paths, retries = 2) {
        if (paths.length === 0) return { success: true, count: 0 }

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const apiURL = `${SERVER_URL}/api/article?path=${encodeURIComponent(paths.join(','))}&type=${encodeURIComponent(['time'])}&lang=en-US`
                console.debug(`Fetching pageviews for ${paths.length} paths (attempt ${attempt + 1}/${retries + 1})`)

                const response = await fetch(apiURL, {
                    method: 'GET',
                    cache: 'no-cache',
                    timeout: 10000 // 10秒超时
                })

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
                    // 指数退避：等待时间递增
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
     * 从RSS获取博客文章路径列表（带缓存）
     * @param {boolean} forceRefresh - 是否强制刷新
     * @returns {Promise<string[]>} 博客文章路径数组
     */
    static async getBlogPostPaths(forceRefresh = false) {
        // 先检查缓存
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

        try {
            const response = await fetch('/rss.xml', { cache: 'no-cache' })
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const xmlText = await response.text()
            const parser = new DOMParser()
            const xml = parser.parseFromString(xmlText, 'application/xml')
            const items = xml.querySelectorAll('item')

            const allPosts = []
            items.forEach((item) => {
                const link = item.querySelector('link')?.textContent
                if (link) {
                    try {
                        const url = new URL(link)
                        allPosts.push(url.pathname)
                    } catch (urlError) {
                        console.warn('Invalid URL in RSS:', link, urlError.message)
                    }
                }
            })

            // 缓存结果
            CacheManager.set(
                CACHE_CONFIG.BLOG_POSTS_KEY,
                CACHE_CONFIG.BLOG_POSTS_TIME_KEY,
                allPosts
            )

            return allPosts
        } catch (error) {
            console.warn('Failed to fetch blog posts for total count:', error)
            return []
        }
    }
}

/**
 * 加载站点总访问量统计 - 优化版本
 * @param {boolean} forceRefresh - 是否强制刷新缓存
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
        // 第一步：检查缓存（如果不强制刷新）
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

        // 第二步：并行启动两个任务
        ui.updateProgress(10)

        const [mainPageviewsPromise, blogPostsPromise] = [
            // 任务1：获取主要页面访问量
            (async () => {
                const cached = forceRefresh ? null : CacheManager.get(
                    CACHE_CONFIG.MAIN_PAGEVIEW_KEY,
                    CACHE_CONFIG.MAIN_PAGEVIEW_TIME_KEY,
                    CACHE_CONFIG.PAGEVIEW_EXPIRY
                )

                if (typeof cached === 'number') {
                    return { success: true, count: cached, fromCache: true }
                }

                const result = await PageviewAPI.getPathsPageviews(MAIN_PATHS)
                if (result.success) {
                    CacheManager.set(
                        CACHE_CONFIG.MAIN_PAGEVIEW_KEY,
                        CACHE_CONFIG.MAIN_PAGEVIEW_TIME_KEY,
                        result.count
                    )
                }
                return result
            })(),

            // 任务2：获取博客文章路径列表
            PageviewAPI.getBlogPostPaths(forceRefresh)
        ]

        // 第三步：等待主要页面访问量完成，立即显示
        const mainResult = await mainPageviewsPromise
        let mainTotal = 0
        let mainPagesFailed = false

        if (!mainResult.success) {
            console.error('Failed to fetch main pageviews:', mainResult.error)
            mainPagesFailed = true
            // 尝试从缓存获取旧数据作为降级
            const fallbackCache = CacheManager.get(
                CACHE_CONFIG.MAIN_PAGEVIEW_KEY,
                CACHE_CONFIG.MAIN_PAGEVIEW_TIME_KEY,
                24 * 60 * 60 * 1000 // 24小时的旧缓存也接受
            )
            mainTotal = typeof fallbackCache === 'number' ? fallbackCache : 0
            console.warn(`Using fallback main pageviews: ${mainTotal}`)
        } else {
            mainTotal = mainResult.count
            console.log(`Main pages total: ${mainTotal} (from ${mainResult.fromCache ? 'cache' : 'API'})`)
        }

        ui.updateProgress(30, mainTotal)

        // 第四步：等待博客文章列表，然后获取其访问量
        const blogPosts = await blogPostsPromise
        ui.updateProgress(50, mainTotal)

        if (blogPosts.length === 0) {
            // 没有博客文章，直接返回主要页面访问量
            CacheManager.set(
                CACHE_CONFIG.TOTAL_PAGEVIEW_KEY,
                CACHE_CONFIG.TOTAL_PAGEVIEW_TIME_KEY,
                mainTotal
            )
            ui.endLoading(mainTotal)
            return
        }

        // 第五步：批量获取博客文章访问量
        // 优化：使用更大的批次大小，减少请求次数
        const batchSize = Math.min(30, Math.max(10, Math.ceil(blogPosts.length / 3)))
        let blogTotal = 0
        let successfulBatches = 0
        let failedBatches = 0

        console.log(`Processing ${blogPosts.length} blog posts in batches of ${batchSize}`)

        for (let i = 0; i < blogPosts.length; i += batchSize) {
            const batch = blogPosts.slice(i, i + batchSize)
            const batchIndex = Math.floor(i / batchSize) + 1
            const totalBatches = Math.ceil(blogPosts.length / batchSize)

            console.log(`Processing batch ${batchIndex}/${totalBatches} (${batch.length} posts)`)

            const batchResult = await PageviewAPI.getPathsPageviews(batch)

            if (batchResult.success) {
                blogTotal += batchResult.count
                successfulBatches++
                console.log(`Batch ${batchIndex} successful: +${batchResult.count} views (total blog views: ${blogTotal})`)
            } else {
                failedBatches++
                console.warn(`Batch ${batchIndex} failed:`, batchResult.error?.message || 'Unknown error')
            }

            const currentTotal = mainTotal + blogTotal
            const batchProgress = 50 + ((i / blogPosts.length) * 40) // 50% 到 90%
            ui.updateProgress(batchProgress, currentTotal)

            // 只在非最后一批时添加延迟
            if (i + batchSize < blogPosts.length) {
                await new Promise(resolve => setTimeout(resolve, 150)) // 减少延迟时间
            }
        }

        console.log(`Blog processing complete: ${successfulBatches} successful, ${failedBatches} failed batches. Total blog views: ${blogTotal}`)

        // 第六步：保存最终结果并显示
        const finalTotal = mainTotal + blogTotal
        console.log(`Final total: ${finalTotal} (main: ${mainTotal} + blog: ${blogTotal})`)

        // 只有在所有批次都成功时才缓存结果
        if (failedBatches === 0) {
            CacheManager.set(
                CACHE_CONFIG.TOTAL_PAGEVIEW_KEY,
                CACHE_CONFIG.TOTAL_PAGEVIEW_TIME_KEY,
                finalTotal
            )
            console.log('Result cached successfully')
        } else {
            console.warn(`Not caching result due to ${failedBatches} failed batches`)
        }

        // 根据加载结果显示不同状态
        const hasPartialData = failedBatches > 0 || mainPagesFailed

        if (hasPartialData) {
            const totalFailures = failedBatches + (mainPagesFailed ? 1 : 0)
            ui.showPartialLoading(finalTotal, totalFailures)

            let warningMessage = '⚠️ Partial data loaded:'
            if (mainPagesFailed) warningMessage += ' Main pages failed,'
            if (failedBatches > 0) warningMessage += ` ${failedBatches} blog batches failed.`
            warningMessage += ' The total count may be incomplete.'

            console.warn(warningMessage)
        } else {
            ui.endLoading(finalTotal)
        }

    } catch (error) {
        console.error('Error fetching total pageview count:', error)
        ui.showError()
    }
}

/**
 * 初始化页面访问量统计功能
 */
export function initPageviewCounter() {
    if (typeof window === 'undefined') return

    // 加载主页访问量统计
    loadWalinePageview()

    // 设置总访问量点击刷新功能
    const totalElement = document.getElementById('total-pageview-count')
    if (totalElement) {
        totalElement.addEventListener('click', () => {
            if (totalElement.dataset.loading !== 'true') {
                loadTotalPageviews(true)
            }
        })
    }

    // 初次加载总访问量
    loadTotalPageviews()
} 