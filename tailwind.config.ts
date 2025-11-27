import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0C0D10',
        'soft-gold': '#D4AF37',
        'champagne': '#F7E7CE',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(212, 175, 55, 0.3)',
        'glow-hover': '0 0 30px rgba(212, 175, 55, 0.5)',
      },
    },
  },
  plugins: [],
}
export default config

