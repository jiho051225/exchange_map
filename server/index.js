import 'dotenv/config'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname, resolve, sep } from 'node:path'
import { planMiddleware } from './plan.js'
import { placeSearchMiddleware } from './places.js'

const root = resolve('dist')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 4173)

createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  let url
  try { url = new URL(req.url, 'http://localhost') } catch { res.writeHead(400).end(); return }
  if (url.pathname === '/api/plan') return planMiddleware(req, res)
  if (url.pathname === '/api/places') return placeSearchMiddleware(req, res)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end()
    return
  }
  let requested
  try { requested = resolve(root, `.${decodeURIComponent(url.pathname)}`) } catch { res.writeHead(400).end(); return }
  if (requested !== root && !requested.startsWith(root + sep)) {
    res.writeHead(403).end()
    return
  }
  const file = extname(requested) ? requested : join(root, 'index.html')
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': `${mime[extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch {
    res.writeHead(404).end()
  }
}).listen(port, host, () => console.log(`Frankfurt route: http://${host}:${port}`))
