// Builds the drawing tools used by public/dc/Practice.dc.html into public/dc/draw.js and draw.css.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'public/dc',
    emptyOutDir: false,
    lib: { entry: 'src/dc-draw.jsx', formats: ['iife'], name: 'UfqDrawBundle', fileName: () => 'draw.js', cssFileName: 'draw' },
  },
})
