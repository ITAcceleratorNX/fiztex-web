/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand orange (active tab, primary buttons)
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fda55b',
          500: '#fb923c', // Figma primary — active tab, primary buttons
          600: '#f97316',
          700: '#ea580c',
        },
        // Sidebar navy — 700 is the exact brand blue from the Fiztex logo (#274185).
        navy: {
          50: '#eef1f8',
          100: '#dbe2f0',
          400: '#5670a8',
          500: '#3a5490',
          600: '#2e4a89',
          700: '#274185',
          800: '#1f3570',
          900: '#182a5c',
          950: '#101d42',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.08)',
        pop: '0 10px 30px -10px rgba(15, 23, 42, 0.25)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'scale-in': 'scale-in 0.16s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
