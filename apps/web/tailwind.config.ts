import type { Config } from 'tailwindcss';

/**
 * MODVerse design system.
 * Colours are driven by CSS custom properties so dark/light/auto theming
 * happens without duplicating a single utility class.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,mdx}'],
  future: { hoverOnlyWhenSupported: true },
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem', xl: '2.5rem' },
      screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1440px' },
    },
    extend: {
      colors: {
        bg: 'rgb(var(--mv-bg) / <alpha-value>)',
        surface: 'rgb(var(--mv-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--mv-surface-2) / <alpha-value>)',
        elevated: 'rgb(var(--mv-elevated) / <alpha-value>)',
        line: 'rgb(var(--mv-line) / <alpha-value>)',
        ink: 'rgb(var(--mv-ink) / <alpha-value>)',
        muted: 'rgb(var(--mv-muted) / <alpha-value>)',
        faint: 'rgb(var(--mv-faint) / <alpha-value>)',
        brand: {
          DEFAULT: 'rgb(var(--mv-brand) / <alpha-value>)',
          soft: 'rgb(var(--mv-brand-soft) / <alpha-value>)',
          ink: 'rgb(var(--mv-brand-ink) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--mv-accent) / <alpha-value>)',
          soft: 'rgb(var(--mv-accent-soft) / <alpha-value>)',
        },
        neon: 'rgb(var(--mv-neon) / <alpha-value>)',
        success: 'rgb(var(--mv-success) / <alpha-value>)',
        warning: 'rgb(var(--mv-warning) / <alpha-value>)',
        danger: 'rgb(var(--mv-danger) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        'display-sm': ['clamp(1.75rem,4vw,2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['clamp(2.25rem,6vw,3.75rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        'display-lg': ['clamp(2.75rem,8vw,5rem)', { lineHeight: '1', letterSpacing: '-0.035em' }],
      },
      borderRadius: { '4xl': '2rem', '5xl': '2.75rem' },
      boxShadow: {
        glass: '0 8px 32px -8px rgb(0 0 0 / 0.36), inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
        'glass-lg': '0 24px 64px -16px rgb(0 0 0 / 0.5), inset 0 1px 0 0 rgb(255 255 255 / 0.08)',
        glow: '0 0 0 1px rgb(var(--mv-brand) / 0.35), 0 0 28px -4px rgb(var(--mv-brand) / 0.45)',
        'glow-accent': '0 0 0 1px rgb(var(--mv-accent) / 0.35), 0 0 32px -4px rgb(var(--mv-accent) / 0.5)',
        card: '0 2px 8px -2px rgb(0 0 0 / 0.12), 0 8px 24px -8px rgb(0 0 0 / 0.18)',
      },
      backgroundImage: {
        'grad-brand': 'linear-gradient(135deg, rgb(var(--mv-brand)) 0%, rgb(var(--mv-accent)) 100%)',
        'grad-neon': 'linear-gradient(135deg, rgb(var(--mv-neon)) 0%, rgb(var(--mv-brand)) 55%, rgb(var(--mv-accent)) 100%)',
        'grad-surface': 'linear-gradient(160deg, rgb(var(--mv-surface) / 0.9), rgb(var(--mv-surface-2) / 0.6))',
        'grad-fade': 'linear-gradient(to top, rgb(var(--mv-bg)) 5%, transparent 60%)',
        'grid-pattern':
          'linear-gradient(rgb(var(--mv-line) / 0.35) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--mv-line) / 0.35) 1px, transparent 1px)',
        noise:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
      },
      backgroundSize: { 'grid-pattern': '48px 48px' },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        'pulse-glow': {
          '0%,100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.95', transform: 'scale(1.04)' },
        },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        'border-flow': { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.8s infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
        marquee: 'marquee 32s linear infinite',
        'spin-slow': 'spin-slow 18s linear infinite',
        'border-flow': 'border-flow 6s ease infinite',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
        snap: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      screens: { xs: '420px' },
      typography: null,
    },
  },
  plugins: [],
};

export default config;
