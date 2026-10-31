/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0F4791', deep: '#0A2E5C', soft: '#E3ECF9', light: '#4C8BEA' },
        bomb: { red: '#D7262E', redlight: '#FF8A8F' },
        ok: '#059669',
        bad: '#dc2626',
        warn: '#C27C0E',
        ink: '#0B1E3A',
        muted: '#5A6B85',
        line: '#DCE3EE',
        canvas: '#F3F6FB',
        xr: { bg: '#040B18', line: '#7FE3FF', hot: '#FF5A5F' },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', '"Arial Narrow"', 'Impact', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
