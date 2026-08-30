/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // "Signal" design system -- see docs/design.md for the full rationale.
        // Deep graphite-ink base (not pure black, not blue-black) with a single
        // warm amber "signal" accent standing in for the idea of tuning across
        // channels, plus five distinct, desaturated hues -- one per content
        // domain -- used consistently everywhere a domain needs identifying.
        ink: {
          950: '#0B0C0E',
          900: '#141619',
          800: '#1C1F24',
          700: '#282C33',
          600: '#3A3F47',
        },
        paper: {
          DEFAULT: '#F3F1EA',
          dim: '#C9C6BC',
        },
        signal: {
          DEFAULT: '#E7A33E',
          dim: '#7A5A22',
          bright: '#F4BE6C',
        },
        domain: {
          movie: '#6C93EE',
          video: '#E2735A',
          music: '#A57AE8',
          podcast: '#4FB28C',
          news: '#C9A227',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
