/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        fg: 'var(--text)',
        'fg-dim': 'var(--text-dim)',
        'fg-mute': 'var(--text-mute)',
        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
        'accent-glow': 'var(--accent-glow)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        err: 'var(--err)',
        info: 'var(--info)',

        // Raw ink scale for occasional direct use (traffic lights, etc.)
        'ink-5': '#363B44',
        'ink-6': '#4A505B',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Design-system scale. Defaults kept close to Tailwind for convenience.
        eyebrow: ['11px', { lineHeight: '1', letterSpacing: '0.16em' }],
        mono: ['12px', { lineHeight: '1.4' }],
        caption: ['12px', { lineHeight: '1.5' }],
        body: ['14px', { lineHeight: '1.55' }],
        subhead: ['20px', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        heading: ['32px', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
        'display-sm': ['28px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-md': ['56px', { lineHeight: '1', letterSpacing: '-0.03em' }],
      },
      letterSpacing: {
        tighter: '-0.04em',
        tight: '-0.03em',
        'tight-sm': '-0.01em',
        caps: '0.14em',
        'caps-wide': '0.16em',
      },
      borderRadius: {
        none: '0',
        xs: '2px',
        sm: '2px',
        DEFAULT: '4px',
        md: '4px',
        lg: '8px',
        xl: '16px',
        full: '999px',
      },
      boxShadow: {
        1: '0 1px 0 rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        2: '0 4px 12px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.03) inset',
        3: '0 24px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04) inset',
        glow: '0 0 0 1px var(--accent), 0 0 32px var(--accent-glow)',
        focus: '0 0 0 3px var(--accent-glow)',
      },
      transitionTimingFunction: {
        precise: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        confirm: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        160: '160ms',
        220: '220ms',
        320: '320ms',
        520: '520ms',
      },
      keyframes: {
        ripple: {
          '0%': { transform: 'scale(1)', opacity: 1 },
          '100%': { transform: 'scale(2.5)', opacity: 0 },
        },
        fadein: {
          '0%': { opacity: 0, transform: 'translateY(4px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: 0.35 },
          '50%': { opacity: 1 },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' },
        },
      },
      animation: {
        ripple: 'ripple 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        fadein: 'fadein 160ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
