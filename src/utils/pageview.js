/**
 * 页面访问量统计工具
 * 包含主页访问量和站点总访问量的统计功能
 */

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
                serverURL: 'https://waline.lyt0112.com',
                path: '/' // This only counts homepage visits, not site-wide total
            })
        } catch (error) {
            console.error('Failed to load Waline pageview count:', error)
        }
    }
}

/**
 * 显示加载状态
 * @param {HTMLElement} loadingIndicator - 加载指示器元素
 * @param {HTMLElement} pageviewCounter - 页面访问量计数器元素
 */
function showLoading(loadingIndicator, pageviewCounter) {
    loadingIndicator.classList.add('show')
    pageviewCounter.classList.add('pulse-loading')
}

/**
 * 隐藏加载状态
 * @param {HTMLElement} loadingIndicator - 加载指示器元素
 * @param {HTMLElement} pageviewCounter - 页面访问量计数器元素
 */
function hideLoading(loadingIndicator, pageviewCounter) {
    loadingIndicator.classList.remove('show')
    pageviewCounter.classList.remove('pulse-loading')
}

/**
 * 更新进度条
 * @param {number} percentage - 进度百分比 (0-100)
 * @param {HTMLElement} progressFill - 进度条填充元素
 * @param {HTMLElement} progressText - 进度文本元素
 */
function updateProgress(percentage, progressFill, progressText) {
    const clampedPercentage = Math.max(0, Math.min(100, percentage))
    progressFill.style.width = clampedPercentage + '%'
    progressText.textContent = Math.round(clampedPercentage) + '%'
}

/**
 * 从RSS获取博客文章路径列表
 * @returns {Promise<string[]>} 博客文章路径数组
 */
async function getBlogPostPaths() {
    try {
        const response = await fetch('/rss.xml')
        const xmlText = await response.text()
        const parser = new DOMParser()
        const xml = parser.parseFromString(xmlText, 'application/xml')
        const items = xml.querySelectorAll('item')

        const allPosts = []
        items.forEach((item) => {
            const link = item.querySelector('link')?.textContent
            if (link) {
                const url = new URL(link)
                allPosts.push(url.pathname)
            }
        })

        return allPosts
    } catch (error) {
        console.warn('Failed to fetch blog posts for total count:', error)
        return []
    }
}

/**
 * 获取指定路径的访问量
 * @param {string[]} paths - 路径数组
 * @param {string} serverURL - Waline服务器URL
 * @returns {Promise<number>} 总访问量
 */
async function getPathsPageviews(paths, serverURL) {
    try {
        const apiURL = `${serverURL}/api/article?path=${encodeURIComponent(paths.join(','))}&type=${encodeURIComponent(['time'])}&lang=en-US`
        const response = await fetch(apiURL)
        const result = await response.json()

        if (result.data && Array.isArray(result.data)) {
            return result.data.reduce((sum, item) => {
                return sum + (typeof item.time === 'number' ? item.time : 0)
            }, 0)
        }

        return 0
    } catch (error) {
        console.warn('Failed to fetch pageview count for paths:', paths, error)
        return 0
    }
}

/**
 * 加载站点总访问量统计
 * @param {boolean} forceRefresh - 是否强制刷新缓存
 */
export async function loadTotalPageviews(forceRefresh = false) {
    if (typeof window === 'undefined') return

    const totalElement = document.getElementById('total-pageview-count')
    const loadingIndicator = document.getElementById('loading-indicator')
    const pageviewCounter = document.getElementById('pageview-counter')
    const progressFill = document.getElementById('progress-fill')
    const progressText = document.getElementById('progress-text')

    if (!totalElement || !loadingIndicator || !pageviewCounter || !progressFill || !progressText) {
        console.warn('Required elements not found for total pageview count')
        return
    }

    // 防止重复加载
    if (totalElement.dataset.loading === 'true') return
    totalElement.dataset.loading = 'true'

    totalElement.textContent = '...'
    totalElement.classList.add('loading-dots')
    showLoading(loadingIndicator, pageviewCounter)

    try {
        const cacheKey = 'total-pageview-cache'
        const cacheTimeKey = 'total-pageview-cache-time'
        const cacheExpiry = 60 * 60 * 1000 // 1小时

        // 检查缓存
        if (!forceRefresh) {
            const cached = localStorage.getItem(cacheKey)
            const cacheTime = localStorage.getItem(cacheTimeKey)

            if (cached && cacheTime && Date.now() - parseInt(cacheTime) < cacheExpiry) {
                totalElement.textContent = cached
                totalElement.classList.remove('loading-dots')
                hideLoading(loadingIndicator, pageviewCounter)
                totalElement.dataset.loading = 'false'
                return
            }
        }

        const serverURL = 'https://waline.lyt0112.com'

        // 第一步：获取主要页面访问量
        const mainPaths = ['/', '/about', '/projects', '/blog', '/links', '/search', '/tags']
        const mainTotal = await getPathsPageviews(mainPaths, serverURL)

        // 先显示主要页面总数
        totalElement.textContent = mainTotal.toString() + '...'
        updateProgress(20, progressFill, progressText)

        // 第二步：异步获取博客文章访问量
        setTimeout(async () => {
            try {
                const allPosts = await getBlogPostPaths()
                updateProgress(30, progressFill, progressText)

                if (allPosts.length === 0) {
                    totalElement.textContent = mainTotal.toString()
                    totalElement.classList.remove('loading-dots')
                    localStorage.setItem(cacheKey, mainTotal.toString())
                    localStorage.setItem(cacheTimeKey, Date.now().toString())
                    updateProgress(100, progressFill, progressText)
                    setTimeout(() => hideLoading(loadingIndicator, pageviewCounter), 500)
                    totalElement.dataset.loading = 'false'
                    return
                }

                // 分批处理博客文章
                const batchSize = 15
                let blogTotal = 0
                const totalBatches = Math.ceil(allPosts.length / batchSize)
                let processedBatches = 0

                for (let i = 0; i < allPosts.length; i += batchSize) {
                    const batch = allPosts.slice(i, i + batchSize)
                    const batchSum = await getPathsPageviews(batch, serverURL)
                    blogTotal += batchSum

                    processedBatches++
                    const currentTotal = mainTotal + blogTotal

                    // 更新进度 (30% 到 90% 之间按批次分布)
                    const batchProgress = 30 + (processedBatches / totalBatches) * 60
                    updateProgress(batchProgress, progressFill, progressText)
                    totalElement.textContent = currentTotal.toString() + '...'

                    // 添加延迟避免频繁请求
                    if (i + batchSize < allPosts.length) {
                        await new Promise((resolve) => setTimeout(resolve, 300))
                    }
                }

                // 保存最终结果
                const finalTotal = mainTotal + blogTotal
                totalElement.textContent = finalTotal.toString()
                totalElement.classList.remove('loading-dots')
                localStorage.setItem(cacheKey, finalTotal.toString())
                localStorage.setItem(cacheTimeKey, Date.now().toString())
                updateProgress(100, progressFill, progressText)
                setTimeout(() => hideLoading(loadingIndicator, pageviewCounter), 1000)
            } catch (error) {
                console.warn('Error in blog posts loading:', error)
                totalElement.textContent = mainTotal.toString()
                totalElement.classList.remove('loading-dots')
                localStorage.setItem(cacheKey, mainTotal.toString())
                localStorage.setItem(cacheTimeKey, Date.now().toString())
                updateProgress(100, progressFill, progressText)
                setTimeout(() => hideLoading(loadingIndicator, pageviewCounter), 500)
            } finally {
                totalElement.dataset.loading = 'false'
            }
        }, 300)
    } catch (error) {
        console.error('Error fetching main pageview count:', error)
        totalElement.textContent = 'Error'
        totalElement.classList.remove('loading-dots')
        hideLoading(loadingIndicator, pageviewCounter)
        totalElement.dataset.loading = 'false'
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