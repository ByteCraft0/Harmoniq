/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090B',
        sidebar: '#0D0D12',
        card: '#14141B',
        'surface-elevated': '#1B1B24',
        'surface-hover': '#242432',
        border: '#272733',
        'border-focus': '#3B3B4E',
        'text-primary': '#F5F3FF',
        'text-secondary': '#A1A1AA',
        'text-muted': '#71717A',
        accent: {
          primary: '#A78BFA',
          secondary: '#7C3AED',
          dark: '#5B21B6',
          light: '#C4B5FD',
          glow: 'rgba(167, 139, 250, 0.15)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-sm': '0 0 15px rgba(167, 139, 250, 0.12)',
        'glow-md': '0 0 25px rgba(167, 139, 250, 0.20)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
};
