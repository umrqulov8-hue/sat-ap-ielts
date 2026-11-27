// Builds <ufq-math> (KaTeX question rendering) into public/dc/math.js for the design pages.
import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'public/dc',
    emptyOutDir: false,
    lib: { entry: 'src/dc-math.js', formats: ['iife'], name: 'UfqMathBundle', fileName: () => 'math.js' },
  },
})
