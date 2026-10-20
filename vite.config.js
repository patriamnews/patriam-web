import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  // La web es una sola aplicación (unos 580 kB sin comprimir, ~170 kB comprimida): límite de aviso ajustado
  build: { chunkSizeWarningLimit: 1000 },
})
