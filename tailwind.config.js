/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{tsx,ts,html}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        'paper-2': 'var(--paper-2)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        line: 'var(--line)',
        vermilion: {
          DEFAULT: 'var(--vermilion)',
          2: 'var(--vermilion-2)',
          soft: 'var(--vermilion-soft)',
        },
        seal: {
          DEFAULT: 'var(--seal)',
          soft: 'var(--seal-soft)',
        },
        'red-soft': 'var(--red-soft)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'overlay-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'zoom-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'paper-rise': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'seal-press': {
          from: { transform: 'scale(1)' },
          to: { transform: 'scale(0.97)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'overlay-fade-in': 'overlay-fade-in 200ms ease-out',
        'zoom-in': 'zoom-in 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'paper-rise': 'paper-rise 220ms ease-out',
        'seal-press': 'seal-press 120ms ease-out',
      },
    },
  },
  plugins: [],
}
