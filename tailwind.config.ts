import type { Config } from 'tailwindcss'

// Tasarım tokenları (docs/REDESIGN.md, design/redesign/styles.css ile aynı değerler).
// Eski adlar (background, soft-gold, champagne, glow) eski sayfalar taşınana kadar kalır.
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
        champagne: '#F7E7CE',

        // Yüzeyler: elle yazılmış koyu tonların yerine dört ton
        surface: {
          1: '#121318',
          2: '#17191F',
          3: '#1F2129',
        },
        line: {
          DEFAULT: 'rgba(255, 255, 255, 0.07)',
          strong: 'rgba(255, 255, 255, 0.13)',
        },
        // Metin
        ink: {
          DEFAULT: '#F3F1EC',
          muted: '#A3A29E',
          faint: '#6B6B70',
        },
        // Marka vurgusu (yalnızca ana eylem ve gerçekten önemli yer)
        gold: {
          DEFAULT: '#D4AF37',
          hover: '#E2C25A',
          ink: '#17130A',
        },
        // Durum renkleri yalnızca anlam için
        success: '#5BBF8A',
        warning: '#E3A94B',
        danger: '#E26464',
        info: '#7FA6DB',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(212, 175, 55, 0.3)',
        'glow-hover': '0 0 30px rgba(212, 175, 55, 0.5)',
        card: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
        modal: '0 30px 60px -20px rgba(0,0,0,0.8)',
      },
    },
  },
  plugins: [],
}
export default config
