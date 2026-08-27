
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,js,ts}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        darkBg: '#0f172a',
        darkCard: '#1e293b'
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'monospace']
      }
    }
  },
  plugins: []
}
