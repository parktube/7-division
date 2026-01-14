/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

// Custom plugin for selection.json and sketch.json POST handling
function dataMiddleware() {
  return {
    name: 'data-middleware',
    configureServer(server: { middlewares: { use: (path: string, handler: (req: { method?: string; on: (event: string, cb: (chunk?: string) => void) => void }, res: { statusCode: number; end: (msg: string) => void }, next: () => void) => void) => void } }) {
      // selection.json middleware
      server.middlewares.use('/selection.json', (req, res, next) => {
        const filePath = path.join(__dirname, 'selection.json')

        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', () => {
            try {
              JSON.parse(body)
              fs.writeFileSync(filePath, body, 'utf-8')
              res.statusCode = 200
              res.end('OK')
            } catch {
              res.statusCode = 400
              res.end('Invalid JSON')
            }
          })
        } else {
          next()
        }
      })

      // scene.json middleware (read-only)
      server.middlewares.use('/scene.json', (req, res, next) => {
        const filePath = path.join(__dirname, 'scene.json')

        if (req.method === 'GET') {
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-store')
            res.end(fs.readFileSync(filePath, 'utf-8'))
          } else {
            res.statusCode = 404
            res.end('{"entities":[],"last_operation":null}')
          }
        } else {
          next()
        }
      })

      // sketch.json middleware
      server.middlewares.use('/sketch.json', (req, res, next) => {
        const filePath = path.join(__dirname, 'sketch.json')

        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', () => {
            try {
              JSON.parse(body)
              fs.writeFileSync(filePath, body, 'utf-8')
              res.statusCode = 200
              res.end('OK')
            } catch {
              res.statusCode = 400
              res.end('Invalid JSON')
            }
          })
        } else if (req.method === 'GET') {
          // Serve sketch.json if it exists
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json')
            res.end(fs.readFileSync(filePath, 'utf-8'))
          } else {
            res.statusCode = 404
            res.end('{}')
          }
        } else {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), dataMiddleware()],
  base: './', // Electron file:// protocol support
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
