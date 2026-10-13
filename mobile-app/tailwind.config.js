/** @type {import('tailwindcss').Config} */
// Renkler web'in "Sakin Premium" tokenlarıyla aynı (design/redesign/styles.css, design/mobile/).
// JS içinde gereken değerler components/ui/theme.js'te; ikisini birlikte güncelle.
// Yazı tipi (Geist / Instrument Serif) components/ui/Text.js ile verilir; font-* sınıfı tanımlanmadı
// (Tailwind'in font-medium gibi kalınlık sınıflarıyla çakışmasın).
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./screens/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Yeni tasarım sistemi
        bg: '#0C0D10',
        s1: '#121318',
        s2: '#17191F',
        s3: '#1F2129',
        line: 'rgba(255, 255, 255, 0.07)',
        'line-strong': 'rgba(255, 255, 255, 0.13)',
        fg: '#F3F1EC',
        fg2: '#A3A29E',
        fg3: '#6B6B70',
        gold: '#D4AF37',
        'gold-ink': '#17130A',
        'gold-soft': 'rgba(212, 175, 55, 0.10)',
        'gold-line': 'rgba(212, 175, 55, 0.32)',
        champagne: '#F7E7CE',
        success: '#5BBF8A',
        'success-soft': 'rgba(91, 191, 138, 0.10)',
        warning: '#E3A94B',
        'warning-soft': 'rgba(227, 169, 75, 0.10)',
        danger: '#E26464',
        'danger-soft': 'rgba(226, 100, 100, 0.10)',
        info: '#7FA6DB',
        'info-soft': 'rgba(127, 166, 219, 0.10)',

        // Eski ekranlar taşınana kadar
        'soft-gold': '#D4AF37',
        'midnight': '#0B0F19',
        'surface': '#151A29',
        'glass-border': 'rgba(255, 255, 255, 0.08)',
      },
    },
  },
  plugins: [],
}
