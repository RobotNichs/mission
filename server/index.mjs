import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequestDiagnosis, handleLearningPlanRequest } from './learningPlanApi.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const distributionRoot = resolve(projectRoot, 'dist')
const maxRequestBytes = 16 * 1024
const requestsPerMinute = 30
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
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

async function parseJsonBody(request) {
  if (!request.headers['content-type']?.toLowerCase().includes('application/json')) {
    const error = new Error('content_type')
    error.status = 415
    throw error
  }

  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxRequestBytes) {
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

export function createApiMiddleware(handleRequest = handleLearningPlanRequest) {
  const requestWindows = new Map()
  return async (request, response, next) => {
    let pathname
    try {
      pathname = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname
    } catch {
      return sendJson(response, 400, { error: { code: 'invalid_url', message: 'Die Anfrage ist ungültig.' } })
    }
    if (pathname !== '/api/learning-plan') return next()
    const diagnosis = createRequestDiagnosis()
    const now = Date.now()
    const clientAddress = request.socket?.remoteAddress ?? 'local'
    const windowStart = requestWindows.get(clientAddress)
    if (!windowStart || now - windowStart.startedAt >= 60_000) {
      requestWindows.set(clientAddress, { startedAt: now, count: 1 })
    } else if (windowStart.count >= requestsPerMinute) {
      const result = diagnosis.failure(429, 'rate_limited', 'rate_limited')
      return sendJson(response, result.status, result.body)
    } else {
      windowStart.count += 1
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
    try {
      const result = await handleRequest(payload, { diagnosis })
      return sendJson(response, result.status, result.body)
    } catch {
      const result = diagnosis.failure(500, 'internal_error', 'internal_error')
      return sendJson(response, result.status, result.body)
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

async function serveStatic(request, response) {
  const pathname = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname
  let requestedPath
  try {
    requestedPath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname)
  } catch {
    response.writeHead(400).end('Ungültige Adresse')
    return
  }
  const filePath = resolve(distributionRoot, `.${requestedPath}`)
  if (filePath !== distributionRoot && !filePath.startsWith(`${distributionRoot}${sep}`)) {
    response.writeHead(403).end('Verboten')
    return
  }

  try {
    const fileInfo = await stat(filePath)
    if (!fileInfo.isFile()) throw new Error('not_a_file')
    const content = await readFile(filePath)
    response.writeHead(200, {
      'cache-control': extname(filePath) === '.html' || filePath === resolve(distributionRoot, 'sw.js') || extname(filePath) === '.webmanifest' || filePath.startsWith(`${resolve(distributionRoot, 'icons')}${sep}`)
        ? 'no-cache' : 'public, max-age=31536000, immutable',
      'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
    })
    response.end(content)
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Datei nicht gefunden')
  }
}

function startProductionServer() {
  const apiMiddleware = createApiMiddleware()
  const server = createServer((request, response) => {
    apiMiddleware(request, response, () => {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { allow: 'GET, HEAD' }).end()
        return
      }
      serveStatic(request, response)
    })
  })
  const port = Number(process.env.PORT ?? 3000)
  server.listen(port, process.env.HOST ?? '127.0.0.1', () => {
    console.log(`Mission läuft auf http://localhost:${port} (KI-Modus: ${process.env.AI_PROVIDER ?? 'mock'})`)
  })
}

try {
  process.loadEnvFile(resolve(projectRoot, '.env'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startProductionServer()
}
