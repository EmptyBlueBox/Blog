import typography from '@tailwindcss/typography'
import { fontFamily } from 'tailwindcss/defaultTheme'

const fg = 'hsl(var(--foreground) / var(--tw-text-opacity, 1))'
const fgMuted = 'hsl(var(--muted-foreground) / var(--tw-text-opacity, 1))'
const bgMuted = 'hsl(var(--muted) / var(--tw-bg-opacity, 1))'

const typographyConfig = ({ theme }) => ({
  pure: {
    css: {
      '--tw-prose-headings': fg,
      '--tw-prose-body': fgMuted,
      '--tw-prose-links': fg,
      '--tw-prose-quotes': fgMuted,
      '--tw-prose-code:': fg,
      '--tw-prose-pre-code': fgMuted,
      '--tw-prose-pre-bg': bgMuted,

      'h2, h3, h4, h5, h6, h7': {
        '& > a': {
          marginInlineStart: '0.75rem',
          color: fgMuted,
          transition: 'opacity 0.2s ease',
          opacity: '0'
        },
        '&:hover > a, &:target > a': {
          opacity: '1'
        }
      },
      img: {
        borderRadius: theme('borderRadius.lg'),
        margin: '0 auto'
      },
      table: {
        display: 'block',
        overflowX: 'scroll'
      },
      blockquote: {
        position: 'relative',
        overflow: 'hidden',
        borderWidth: '0.1rem',
        borderRadius: theme('borderRadius.lg'),
        paddingInlineStart: '1.6rem !important',
        paddingInlineEnd: '1.6rem !important',
        '&::after': {
          position: 'absolute',
          content: '"”"',
          top: '-5.4rem',
          right: '-1.4rem',
          fontSize: '10rem',
          fontFamily:
            '"Trebuchet MS", "Lucida Sans Unicode", "Lucida Grande", "Lucida Sans", Arial, sans-serif',
          transform: 'rotate(-15deg)',
          opacity: '5%'
        },
        p: {
          '&:first-of-type:before, &:first-of-type:after': {
            display: 'none'
          }
        }
      }
    }
  }
})

/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: ['class'],
  safelist: [
    'dark',
    // Aside component colors
    'border-l-blue-500',
    'bg-blue-50',
    'dark:bg-blue-900/20',
    'text-blue-700',
    'dark:text-blue-300',
    'text-blue-500',
    'border-l-green-500',
    'bg-green-50',
    'dark:bg-green-900/20',
    'text-green-700',
    'dark:text-green-300',
    'text-green-500',
    'border-l-yellow-500',
    'bg-yellow-50',
    'dark:bg-yellow-900/20',
    'text-yellow-700',
    'dark:text-yellow-300',
    'text-yellow-500',
    'border-l-red-500',
    'bg-red-50',
    'dark:bg-red-900/20',
    'text-red-700',
    'dark:text-red-300',
    'text-red-500'
  ],
  plugins: [typography()],

  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontFamily: {
        sans: ['Satoshi', ...fontFamily.sans]
      },
      typography: typographyConfig
    }
  }
}

export default config
