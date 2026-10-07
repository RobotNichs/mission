import { createServer } from 'node:http'
import { readFile, stat, realpath } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequestDiagnosis, handleLearningPlanRequest } from './learningPlanApi.mjs'
import { createAiLimiter, productionConfig, sameOriginRequest, securityHeaders } from './production.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const distributionRoot = resolve(projectRoot, 'dist')
const maxRequestBytes = 16 * 1024
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

function sendJson(response, status, body) {
  if (response.destroyed || response.writableEnded) return
  response.writeHead(status, {
    ...securityHeaders,
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...(status === 413 ? { connection: 'close' } : {}),
  })
  response.end(JSON.stringify(body))
}

async function parseJsonBody(request) {
  if (request.headers['content-length'] && Number(request.headers['content-length']) > maxRequestBytes) {
    const error = new Error('body_too_large'); error.status = 413; throw error
  }
  if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') {
    const error = new Error('content_type'); error.status = 415; throw error
  }
  if (!request.headers['content-type']?.toLowerCase().includes('application/json')) {
    const error = new Error('content_type')
    error.status = 415
    throw error
  }

  const chunks = []
  let size = 0
  for await (const chunk of (request.iterator ? request.iterator({ destroyOnReturn: false }) : request)) {
    size += chunk.length
    if (size > maxRequestBytes) {
      request.resume?.()
      const error = new Error('body_too_large')
      error.status = 413
      throw error
    }
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('invalid_json')
    error.status = 400
    throw error
  }
}

export function createApiMiddleware(handleRequest = handleLearningPlanRequest, { env = process.env } = {}) {
  const limit = createAiLimiter()
  let activeRequests = 0
  return async (request, response, next) => {
    let pathname
    try {
      pathname = new URL(request.url ?? '/', 'http://mission.invalid').pathname
    } catch {
      return sendJson(response, 400, { error: { code: 'invalid_url', message: 'Die Anfrage ist ungültig.' } })
    }
    if (pathname === '/api/health') {
      if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: { code: 'method_not_allowed', message: 'Dieser Endpunkt akzeptiert GET.' } })
      return sendJson(response, 200, { status: 'ok', aiConfigured: (env.AI_PROVIDER ?? 'mock') === 'mock' || (env.AI_PROVIDER === 'groq' && Boolean(env.GROQ_API_KEY && env.GROQ_MODEL)) })
    }
    if (pathname !== '/api/learning-plan') {
      if (pathname.startsWith('/api/')) return sendJson(response, 404, { error: { code: 'not_found', message: 'API-Endpunkt nicht gefunden.' } })
      return next()
    }
    const diagnosis = createRequestDiagnosis()
    const clientAddress = request.socket?.remoteAddress ?? 'local'
    const retryAfter = limit(clientAddress)
    if (retryAfter || activeRequests >= 4) {
      response.setHeader?.('retry-after', String(retryAfter || 1))
      const result = diagnosis.failure(429, 'rate_limited', 'rate_limited')
      return sendJson(response, result.status, result.body)
    }
    if (env.NODE_ENV === 'production' && !sameOriginRequest(request, env)) {
      const result = diagnosis.failure(403, 'invalid_request', 'invalid_request')
      return sendJson(response, result.status, result.body)
    }
    if (request.method !== 'POST') {
      response.setHeader('allow', 'POST')
      const result = diagnosis.failure(405, 'method_not_allowed', 'invalid_request')
      return sendJson(response, result.status, result.body)
    }

    let payload
    try {
      payload = await parseJsonBody(request)
    } catch (error) {
      const expected = ['content_type', 'body_too_large', 'invalid_json'].includes(error.message)
      const result = expected
        ? diagnosis.failure(error.status, 'invalid_request', error.message === 'invalid_json' ? 'invalid_json' : 'invalid_request')
        : diagnosis.failure(500, 'internal_error', 'internal_error')
      return sendJson(response, result.status, result.body)
    }
    const controller = new AbortController()
    const disconnected = () => { if (!response.writableEnded) controller.abort() }
    request.on?.('aborted', disconnected)
    response.on?.('close', disconnected)
    if (request.aborted || response.destroyed) controller.abort()
    activeRequests++
    try {
      const result = await handleRequest(payload, { diagnosis, signal: controller.signal, env })
      return sendJson(response, result.status, result.body)
    } catch {
      const result = diagnosis.failure(500, 'internal_error', 'internal_error')
      return sendJson(response, result.status, result.body)
    } finally {
      activeRequests--
      request.off?.('aborted', disconnected)
      response.off?.('close', disconnected)
    }
  }
}

export function apiPlugin() {
  const middleware = createApiMiddleware()
  return {
    name: 'mission-server-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export async function serveStatic(request, response, root = distributionRoot) {
  const pathname = new URL(request.url ?? '/', 'http://mission.invalid').pathname
  let requestedPath
  try {
    requestedPath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname)
  } catch {
    response.writeHead(400).end('Ungültige Adresse')
    return
  }
  const allowed = ['/index.html', '/sw.js', '/manifest.webmanifest'].includes(requestedPath)
    || /^\/(assets|icons)\/[a-zA-Z0-9_-][a-zA-Z0-9._-]*\.(js|css|png|svg|ico|woff|woff2)$/.test(requestedPath)
  if (!allowed || requestedPath.includes('\\') || requestedPath.split('/').some(part => part.startsWith('.'))) {
    response.writeHead(404).end('Datei nicht gefunden'); return
  }
  const filePath = resolve(root, `.${requestedPath}`)
  if (!filePath.startsWith(`${resolve(root)}${sep}`)) {
    response.writeHead(403).end('Verboten')
    return
  }

  try {
    const actualRoot = await realpath(root), actualFile = await realpath(filePath)
    if (!actualFile.startsWith(`${actualRoot}${sep}`)) throw new Error('outside_root')
    const fileInfo = await stat(filePath)
    if (!fileInfo.isFile()) throw new Error('not_a_file')
    const content = await readFile(filePath)
    response.writeHead(200, {
      'cache-control': extname(filePath) === '.html' || filePath === resolve(root, 'sw.js') || extname(filePath) === '.webmanifest' || filePath.startsWith(`${resolve(root, 'icons')}${sep}`)
        ? 'no-cache' : 'public, max-age=31536000, immutable',
      'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
    })
    response.end(request.method === 'HEAD' ? undefined : content)
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Datei nicht gefunden')
  }
}

export function createProductionServer({ env = process.env, handleRequest = handleLearningPlanRequest, root = distributionRoot } = {}) {
  const apiMiddleware = createApiMiddleware(handleRequest, { env })
  const server = createServer((request, response) => {
    for (const [key, value] of Object.entries(securityHeaders)) response.setHeader(key, value)
    void apiMiddleware(request, response, () => {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { allow: 'GET, HEAD' }).end()
        return
      }
      void serveStatic(request, response, root)
    }).catch(() => sendJson(response, 500, { error: { code: 'internal_error', message: 'Die Anfrage konnte nicht verarbeitet werden.' } }))
  })
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000
  server.setTimeout(30000, socket => socket.destroy())
  return server
}
function startProductionServer() {
  process.env.NODE_ENV ??= 'production'
  try {
    const { port, host } = productionConfig()
    const server = createProductionServer()
    server.on('error', () => { console.error('Mission konnte nicht gestartet werden. Prüfe Port und Host-Konfiguration.'); process.exitCode = 1 })
    server.listen(port, host, () => console.log(`Mission-Server gestartet (Port ${port}).`))
  } catch { console.error('Ungültige Produktionskonfiguration. Prüfe PORT und PUBLIC_ORIGIN.'); process.exitCode = 1 }
}

try {
  process.loadEnvFile(resolve(projectRoot, '.env'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startProductionServer()
}
