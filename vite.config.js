import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The premium design lives in public/dc/*.dc.html (served unchanged). This plugin gives
// those pages clean URLs (/dashboard -> /dc/Dashboard.dc.html) and a /dc/config.js
// that hands the public Supabase settings to the pages' bridge script.
const dcRoutes = JSON.parse(readFileSync(new URL('./dc-routes.json', import.meta.url), 'utf8'))

function dcDesign() {
  let env = {}
  const configJs = () => `window.UFQ_CONFIG=${JSON.stringify({
    url: env.VITE_SUPABASE_URL || '',
    key: env.VITE_SUPABASE_ANON_KEY || '',
  })};\n`
  return {
    name: 'ufq-dc-design',
    configResolved(config) {
      env = loadEnv(config.mode, config.root, 'VITE_')
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const [path, query] = (req.url || '').split('?')
        if (path === '/dc/config.js') {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
          res.end(configJs())
          return
        }
        const name = dcRoutes[path.length > 1 ? path.replace(/\/$/, '') : path]
        if (name && req.method === 'GET') req.url = `/dc/${name}.dc.html${query ? `?${query}` : ''}`
        next()
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'dc/config.js', source: configJs() })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dcDesign()],
})
