/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm "rose & terracotta" palette. Contrast checked against cream and ink backgrounds.
        rose: {
          50: '#fff5f5', 100: '#ffe4e4', 200: '#fecdcd', 300: '#fca5a5', 400: '#f27979',
          500: '#e2555a', 600: '#c73b45', 700: '#a52d38', 800: '#862733', 900: '#6f2430',
        },
        cream: { 50: '#fffbf6', 100: '#fdf4ea', 200: '#f8e7d4' },
        ink: { 700: '#3b2a2f', 800: '#2a1e22', 900: '#1c1417', 950: '#140e10' },
        gold: { 400: '#f5b84a', 500: '#e59f22' },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 10px -2px rgba(120, 50, 60, 0.12), 0 1px 3px rgba(120, 50, 60, 0.06)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        'pop': { '0%': { transform: 'scale(.6)', opacity: 0 }, '70%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
        'flip': { '0%': { transform: 'rotateY(90deg)' }, '100%': { transform: 'rotateY(0)' } },
        'heartbeat': { '0%,100%': { transform: 'scale(1)' }, '30%': { transform: 'scale(1.25)' } },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
        'pop': 'pop .45s cubic-bezier(.2,.9,.3,1.3) both',
        'flip': 'flip .5s ease-out both',
        'heartbeat': 'heartbeat .4s ease-out',
      },
    },
  },
  plugins: [],
};
