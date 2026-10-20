// Compilación del PROTOTIPO (datos simulados): excluye la librería de Supabase para que pese menos.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@supabase/supabase-js': fileURLToPath(new URL('./src/lib/supabase-stub.js', import.meta.url)) } },
  build: { outDir: 'dist-demo' },
})
