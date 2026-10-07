// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { build } from 'vite'
import { createProductionServer } from './index.mjs'
import { productionConfig, createAiLimiter, securityHeaders } from './production.mjs'
import { assertNoClientSecrets } from './buildSecurity.mjs'
import { handleLearningPlanRequest } from './learningPlanApi.mjs'
const input = { goal: 'SQL JOINs wiederholen', timeBudgetMinutes: 15, energyLevel: 'high', learningBlocker: null }
const secret = 'SYNTHETIC-GROQ-KEY-NEVER-REAL'
let server, root, origin
beforeEach(async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  root = await mkdtemp(join(tmpdir(), 'mission-production-'))
  await mkdir(join(root, 'assets')); await mkdir(join(root, 'icons'))
  await writeFile(join(root, 'index.html'), '<!doctype html><title>Mission</title>')
  await writeFile(join(root, 'assets', 'app.js'), 'safe script')
  await writeFile(join(root, '.env'), secret)
  await writeFile(join(root, 'private.json'), secret)
  await writeFile(join(root, 'sw.js'), 'safe worker')
  server = createProductionServer({ env: { NODE_ENV: 'production', AI_PROVIDER: 'mock' }, root })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  origin = `http://127.0.0.1:${server.address().port}`
})
afterEach(async () => {
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve))
  if (!root.startsWith(join(tmpdir(), 'mission-production-'))) throw new Error('Unexpected test directory')
  await rm(root, { recursive: true, force: true })
  vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers()
})
const post = (body = input, headers = {}) => fetch(`${origin}/api/learning-plan`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })
it('serves frontend and mock API from one production deployment', async () => {
  expect((await fetch(origin)).status).toBe(200)
  const response = await post(); expect(response.status).toBe(200)
  expect((await response.json()).source).toBe('mock')
})
it('health returns only neutral status and never invokes a provider', async () => {
  const response = await fetch(`${origin}/api/health`)
  expect(await response.json()).toEqual({ status: 'ok', aiConfigured: true })
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('access-control-allow-origin')).toBeNull()
})
it.each(['/.env', '/.env.local', '/private.json', '/server/index.mjs', '/assets/.env', '/assets/app.js.map'])('does not expose %s even if the dist tree contains sensitive files', async path => {
  const response = await fetch(`${origin}${path}`)
  expect(response.status).toBe(404); expect(await response.text()).not.toContain(secret)
})
it('blocks oversized bodies before provider invocation', async () => {
  const response = await post({ ...input, goal: 'x'.repeat(17000) })
  expect(response.status).toBe(413); expect((await response.json()).error.category).toBe('invalid_request')
})
it.each([{ ...input, goal: 'x'.repeat(281) }, { ...input, unknown: 'private' }, { ...input, timeBudgetMinutes: '15' }, { ...input, learningContext: { materials: ['bad'] } }])('rejects manipulated server input %j', async body => {
  const response = await post(body); expect(response.status).toBe(400)
  expect((await response.json()).error.diagnosisId).toMatch(/^[0-9a-f-]{36}$/)
})
it('rejects malformed JSON and compressed input without stack traces', async () => {
  const response = await post('{bad'); expect(response.status).toBe(400)
  const text = await response.text(); expect(text).not.toMatch(/SyntaxError|stack|server\//)
  expect((await post('{}', { 'content-encoding': 'gzip' })).status).toBe(415)
})
it('limits a client to ten AI attempts and does not trust forwarded identities', async () => {
  for (let i = 0; i < 10; i++) expect((await post(input, { 'x-forwarded-for': `10.0.0.${i}` })).status).toBe(200)
  const blocked = await post()
  expect(blocked.status).toBe(429); expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
  expect((await blocked.json()).error.message).toContain('warte')
  expect((await fetch(`${origin}/api/health`)).status).toBe(200)
  expect((await fetch(origin)).status).toBe(200)
})
it('bounds global attempts and resets the one-minute windows', () => {
  let time = 0; const limit = createAiLimiter(() => time)
  for (let i = 0; i < 30; i++) expect(limit(`client-${i}`)).toBe(0)
  expect(limit('new-client')).toBe(60)
  time = 60000; expect(limit('new-client')).toBe(0)
})
it('rejects cross-origin requests without enabling CORS', async () => {
  const response = await post(input, { origin: 'https://unrelated.example' })
  expect(response.status).toBe(403); expect(response.headers.get('access-control-allow-origin')).toBeNull()
  expect((await post(input, { origin })).status).toBe(200)
})
it('adds the documented security headers without blocking inline Orb styles', async () => {
  for (const path of ['/', '/api/health', '/api/not-found', '/missing']) {
    const response = await fetch(`${origin}${path}`)
    for (const [key, value] of Object.entries(securityHeaders)) expect(response.headers.get(key)).toBe(value)
  }
  expect(securityHeaders['content-security-policy']).toContain("style-src 'self' 'unsafe-inline'")
  expect(securityHeaders['content-security-policy']).not.toContain("script-src 'unsafe-inline'")
})
it('serves the worker without immutable HTTP caching', async () => {
  const response = await fetch(`${origin}/sw.js`)
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-cache')
  expect((await fetch(origin, { method: 'HEAD' })).headers.get('content-type')).toContain('text/html')
})
it('supports production host binding and validates environment values safely', () => {
  expect(productionConfig({ NODE_ENV: 'production', PORT: '8080' })).toEqual({ port: 8080, host: '0.0.0.0' })
  expect(productionConfig({ NODE_ENV: 'production', HOST: '::', PORT: '3000', PUBLIC_ORIGIN: 'https://mission.example' }).host).toBe('::')
  expect(() => productionConfig({ PORT: 'NaN' })).toThrow('invalid_port')
  expect(() => productionConfig({ PUBLIC_ORIGIN: 'https://mission.example/private' })).toThrow()
})
it('cancels an already disconnected request before making a model call', async () => {
  const controller = new AbortController(); controller.abort(); const fetchImpl = vi.fn()
  const result = await handleLearningPlanRequest(input, { env: { AI_PROVIDER: 'groq', GROQ_MODEL: 'test', GROQ_API_KEY: secret }, fetchImpl, signal: controller.signal })
  expect(fetchImpl).not.toHaveBeenCalled(); expect(result.body.error.category).toBe('client_disconnected')
})
it('aborts the provider promptly when the client disconnects, without leaking inputs', async () => {
  const controller = new AbortController(); let upstreamSignal
  const fetchImpl = vi.fn((_url, options) => { upstreamSignal = options.signal; return new Promise(() => {}) })
  const pending = handleLearningPlanRequest({ ...input, goal: 'PRIVATE-GOAL', learningBlocker: 'other', learningBlockerDetails: 'PRIVATE-BLOCKER' },
    { env: { AI_PROVIDER: 'groq', GROQ_MODEL: 'test', GROQ_API_KEY: secret }, fetchImpl, signal: controller.signal })
  controller.abort(); const result = await pending
  expect(upstreamSignal.aborted).toBe(true); expect(fetchImpl).toHaveBeenCalledOnce()
  const output = JSON.stringify(result) + JSON.stringify(console.warn.mock.calls)
  for (const text of [secret, 'PRIVATE-GOAL', 'PRIVATE-BLOCKER', 'Authorization']) expect(output).not.toContain(text)
})
it('blocks a synthetic secret in every client output type with a redacted error', () => {
  for (const fileName of ['assets/app.js', 'sw.js', 'manifest.webmanifest']) {
    expect(() => assertNoClientSecrets({ test: { type: 'asset', fileName, source: secret } }, { GROQ_API_KEY: secret })).toThrow('Build blocked')
  }
  expect(() => assertNoClientSecrets({}, { VITE_GROQ_API_KEY: secret })).toThrow('forbidden')
})
it('production build contains no server key, env, or private paths, including PWA assets', async () => {
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('GROQ_API_KEY', secret)
  const result = await build({ mode: 'production', logLevel: 'silent', build: { write: false } })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => r.output)
  const text = outputs.map(o => String(o.type === 'chunk' ? o.code : o.source)).join('\n')
  expect(text).not.toContain(secret); expect(text).not.toContain('GROQ_API_KEY')
  expect(outputs.some(o => o.fileName.startsWith('.env'))).toBe(false)
  expect(outputs.some(o => o.fileName === 'sw.js')).toBe(true)
  const ignore = await readFile('.gitignore', 'utf8')
  expect(ignore).toContain('.env.*'); expect(ignore).toContain('!.env.example')
}, 30000)
