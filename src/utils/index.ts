export const prod = import.meta.env.PROD

// Tailwind
export { cn } from './tailwind'

// Date
export { getFormattedDate } from './date'

// Generate Toc
export { generateToc } from './generateToc'
export type { TocItem } from './generateToc'

// Theme
export { getTheme, listenThemeChange, setTheme } from './theme'

// Toast
export { showToast } from './toast'
