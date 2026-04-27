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
        'fg-meta': 'var(--text-meta)',
        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
        'accent-glow': 'var(--accent-glow)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        err: 'var(--err)',
        info: 'var(--info)',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: [
          '"Roboto Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
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
        xs: '4px',
        sm: '8px',
        DEFAULT: '16px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        pill: '1000px',
        full: '999px',
      },
      boxShadow: {
        1: 'var(--shadow-1)',
        2: 'var(--shadow-2)',
        3: 'var(--shadow-3)',
        glow: '0 0 0 1px var(--accent), 0 0 32px var(--accent-glow)',
        focus: '0 0 0 3px var(--accent-glow)',
      },
      transitionTimingFunction: {
        precise: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        confirm: 'cubic-bezier(0.4, 0, 0.2, 1)',
        // Smooth long-tail eases — used by the mount animations below
        // so entries decelerate gently rather than "landing" abruptly.
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
        'smooth-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
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
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        // View cross-fade — longer drift so routes feel like they glide in.
        'view-in': {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        // Landing panel mount — drifts up + softly scales. The travel is
        // intentionally farther than a normal fade so it reads as motion,
        // not a pop.
        'panel-in': {
          '0%': { opacity: 0, transform: 'scale(0.96) translateY(16px)' },
          '100%': { opacity: 1, transform: 'scale(1) translateY(0)' },
        },
        // Stagger-friendly card entry — more travel for the cascade feel.
        'card-in': {
          '0%': { opacity: 0, transform: 'translateY(14px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        // Chrome popover: scale up from anchor edge.
        'popover-in': {
          '0%': { opacity: 0, transform: 'scale(0.95) translateY(-6px)' },
          '100%': { opacity: 1, transform: 'scale(1) translateY(0)' },
        },
        // Ambient float — used by the landing glass panel so it never sits
        // completely still. 6px drift over ~8s reads as "floating", not
        // "broken animation". Uses `top` (not `transform`) so the element
        // doesn't create a stacking context that would isolate
        // `backdrop-filter` from the ancestors painting the background.
        float: {
          '0%, 100%': { top: '0px' },
          '50%': { top: '-6px' },
        },
        // Indeterminate loading strip — a bar that slides across the viewport.
        'progress-strip': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' },
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
        // easeOutQuint — cubic-bezier(0.19, 1, 0.22, 1) — very long tail,
        // nothing ever "lands", it drifts to a stop.
        fadein: 'fadein 320ms cubic-bezier(0.19, 1, 0.22, 1)',
        'view-in': 'view-in 560ms cubic-bezier(0.19, 1, 0.22, 1) both',
        'panel-in': 'panel-in 820ms cubic-bezier(0.19, 1, 0.22, 1) both',
        'card-in': 'card-in 720ms cubic-bezier(0.19, 1, 0.22, 1) both',
        'popover-in': 'popover-in 320ms cubic-bezier(0.19, 1, 0.22, 1)',
        'progress-strip': 'progress-strip 2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        // Infinite idle animation — very slow so it reads as ambient.
        float: 'float 8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
