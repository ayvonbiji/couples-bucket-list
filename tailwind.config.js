/** @type {import('tailwindcss').Config} */
// Design system: calm neutrals + one muted rose accent, used sparingly.
//   background #FAF9F7 · text #252326 · secondary #858087 · accent #C65D70 · blush #F6E9EC · borders #EAE6E5
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Accent scale built around #C65D70. 600 is used for filled buttons (≈4.8:1 with white text).
        rose: {
          50: '#FBF4F6', 100: '#F6E9EC', 200: '#EFD5DB', 300: '#E2B2BC', 400: '#D4899A',
          500: '#C65D70', 600: '#B04C60', 700: '#933E4F', 800: '#763342', 900: '#5C2934',
        },
        // Warm neutrals (backgrounds, borders)
        cream: { 50: '#FAF9F7', 100: '#F3F1EE', 200: '#EAE6E5', 300: '#DCD7D5' },
        // Charcoal (text in light mode, surfaces in dark mode)
        ink: { 500: '#858087', 600: '#6B666D', 700: '#4A464B', 800: '#252326', 900: '#1C1A1D', 950: '#141215' },
        line: { DEFAULT: '#EAE6E5', dark: '#2E2B2F' },
        gold: { 400: '#D9A441', 500: '#C8922F' },
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(37, 35, 38, 0.04)',
        float: '0 8px 30px -12px rgba(37, 35, 38, 0.25)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } },
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'sheet-up': { '0%': { transform: 'translateY(24px)', opacity: 0 }, '100%': { transform: 'none', opacity: 1 } },
        'pop': { '0%': { transform: 'scale(.96)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
        'flip': { '0%': { transform: 'rotateY(80deg)', opacity: 0 }, '100%': { transform: 'rotateY(0)', opacity: 1 } },
        'heartbeat': { '0%,100%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.15)' } },
      },
      animation: {
        'fade-up': 'fade-up .3s cubic-bezier(.2,.8,.2,1) both',
        'fade-in': 'fade-in .2s ease-out both',
        'sheet-up': 'sheet-up .28s cubic-bezier(.2,.8,.2,1) both',
        'pop': 'pop .3s cubic-bezier(.2,.8,.2,1) both',
        'flip': 'flip .5s cubic-bezier(.2,.8,.2,1) both',
        'heartbeat': 'heartbeat .35s ease-out',
      },
    },
  },
  plugins: [],
};
