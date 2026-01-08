/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./screens/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'soft-gold': '#D4AF37',
        'midnight': '#0B0F19',
        'surface': '#151A29',
        'glass-border': 'rgba(255, 255, 255, 0.08)',
      }
    },
  },
  plugins: [],
}
