import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Birim testleri: saf iş kuralları (lib/, utils/) ve web ↔ mobil sabit eşitliği. Veritabanı ve ağ yok.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
