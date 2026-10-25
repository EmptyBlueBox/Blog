import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export { getFormattedDate } from './date'
export { generateToc } from './generateToc'
export type { TocItem } from './generateToc'
export { getTheme, setTheme } from './theme'
export { showToast } from './toast'
