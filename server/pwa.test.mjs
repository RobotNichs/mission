// @vitest-environment node
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { build } from 'vite'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { pwaStaticFiles } from './pwaBuild.mjs'
const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'))
const html = readFileSync('index.html', 'utf8')
describe('manifest and local branding', () => {
  it('has the correct Mission identity and standalone display', () => {
    expect(manifest.name).toBe('Mission'); expect(manifest.short_name).toBe('Mission'); expect(manifest.display).toBe('standalone')
    expect(manifest.lang).toBe('de'); expect(manifest.start_url).toBe('/'); expect(manifest.scope).toBe('/')
    expect(manifest.orientation).toBeUndefined()
  })
  it('uses dark matching browser and launch backgrounds', () => {
    expect(manifest.theme_color).toBe('#080e18'); expect(manifest.background_color).toBe('#080e18')
    expect(html).toContain('name="theme-color" content="#080e18"')
  })
  it('links manifest, favicon and apple icon without disabling zoom', () => {
    expect(html).toContain('rel="manifest"'); expect(html).toContain('rel="apple-touch-icon"'); expect(html).toContain('viewport-fit=cover')
    expect(html).not.toContain('user-scalable=no')
  })
  it.each(manifest.icons)('provides a valid local PNG $src ($purpose)', icon => {
    const png = readFileSync(`public${icon.src}`)
    expect([...png.subarray(0, 8)]).toEqual([137,80,78,71,13,10,26,10])
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes)
  })
  it('keeps the maskable mark inside the 80% safe circle', () => {
    // Vector stroke bounds, including dot: x128..367, y180..356, centered around512/2.
    for (const [x,y] of [[128,180], [367,180], [128,356], [367,356]]) expect(Math.hypot(x-256,y-256)).toBeLessThan(512*.4)
    expect(manifest.icons.some(icon => icon.purpose === 'maskable')).toBe(true)
  })
})
let outputs, worker
beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production')
  try {
    const result = await build({ mode: 'production', logLevel: 'silent', build: { write: false } })
    outputs = (Array.isArray(result) ? result : [result]).flatMap(r => r.output)
    worker = outputs.find(item => item.fileName === 'sw.js').source.toString()
  } finally { vi.unstubAllEnvs() }
}, 30000)
it('emits a real production worker containing all hashed code/CSS and public PWA assets', () => {
  for (const item of outputs.filter(o => o.type === 'chunk' || o.fileName.endsWith('.css') || pwaStaticFiles.includes(o.fileName))) expect(worker).toContain(`/${item.fileName}`)
  expect(worker).toContain('/index.html'); expect(worker).not.toContain('__MISSION_')
  expect(outputs.some(o => o.fileName === 'manifest.webmanifest')).toBe(true)
})
function harness() {
  const events = new Map(), data = new Map([['/index.html', new Response('offline shell')], ['/assets/test.js', new Response('script')]])
  const cache = { addAll: vi.fn(async () => {}), match: vi.fn(async path => data.get(path)) }
  const caches = { open: vi.fn(async () => cache), keys: vi.fn(async () => ['mission-app-shell-old', 'unrelated-cache']), delete: vi.fn(async () => true) }
  const fetch = vi.fn(async () => new Response('network'))
  class WorkerRequest extends Request { constructor(url, options) { super(new URL(url, 'https://mission.test'), options) } }
  const source = worker.replace(/const PRECACHE = [^\n]+/, 'const PRECACHE = ["/index.html", "/assets/test.js"];')
  const self = { location: { origin: 'https://mission.test' }, addEventListener: (name, handler) => events.set(name, handler), skipWaiting: vi.fn(), clients: { claim: vi.fn() } }
  runInNewContext(source, { self, caches, fetch, Request: WorkerRequest, Response, URL, Set, Promise })
  async function lifecycle(name) { let pending; events.get(name)({ waitUntil: p => { pending = p } }); await pending }
  async function request(path, options = {}) {
    let response
    const request = { url: new URL(path, 'https://mission.test').href, method: 'GET', headers: new Headers(), mode: 'cors', ...options }
    events.get('fetch')({ request, respondWith: p => { response = p } })
    return response ? await response : undefined
  }
  return { cache, caches, fetch, self, lifecycle, request }
}
it('precaches only allowlisted static GET resources with no credentials', async () => {
  const h = harness(); await h.lifecycle('install')
  expect(h.cache.addAll).toHaveBeenCalledOnce()
  for (const r of h.cache.addAll.mock.calls[0][0]) { expect(r.method).toBe('GET'); expect(r.credentials).toBe('omit'); expect(r.cache).toBe('reload') }
  expect(h.self.skipWaiting).not.toHaveBeenCalled()
})
it('deletes only old Mission cache versions during activation', async () => {
  const h = harness(); await h.lifecycle('activate')
  expect(h.caches.delete).toHaveBeenCalledExactlyOnceWith('mission-app-shell-old')
  expect(h.self.clients.claim).not.toHaveBeenCalled()
})
it('fails installation atomically when the app shell cannot be cached', async () => {
  const h = harness(); h.cache.addAll.mockRejectedValue(new Error('offline'))
  await expect(h.lifecycle('install')).rejects.toThrow('offline')
  expect(h.caches.delete.mock.calls[0][0]).toMatch(/^mission-app-shell-/)
})
it.each(['/api/learning-plan', '/api/learning-plan?goal=private', '/api/other', '/.env', '/diagnosis.json', '/private.json', 'https://provider.test/result', '/assets/test.js?token=private'])('never intercepts or caches %s', async path => {
  const h = harness(); expect(await h.request(path)).toBeUndefined()
  expect(h.caches.open).not.toHaveBeenCalled(); expect(h.fetch).not.toHaveBeenCalled()
})
it('never intercepts POST or authorized requests', async () => {
  const h = harness()
  expect(await h.request('/index.html', { method: 'POST' })).toBeUndefined()
  expect(await h.request('/assets/test.js', { headers: new Headers({ authorization: 'test-only' }) })).toBeUndefined()
})
it('opens the offline shell when navigation fails', async () => {
  const h = harness(); h.fetch.mockRejectedValue(new Error('offline'))
  expect(await (await h.request('/', { mode: 'navigate' })).text()).toBe('offline shell')
})
it('loads online HTML without caching a dynamic response', async () => {
  const h = harness()
  expect(await (await h.request('/', { mode: 'navigate' })).text()).toBe('network')
  expect(h.caches.open).not.toHaveBeenCalled()
})
it('serves the allowlisted static script offline', async () => {
  const h = harness(); h.fetch.mockRejectedValue(new Error('offline'))
  expect(await (await h.request('/assets/test.js')).text()).toBe('script')
  expect(h.fetch).not.toHaveBeenCalled()
})
it('does not contain storage mutations, provider messages or automatic reload logic', () => {
  expect(worker).not.toContain('localStorage'); expect(worker).not.toContain('indexedDB')
  expect(worker).not.toContain('skipWaiting('); expect(worker).not.toContain('clients.claim(')
  expect(readFileSync('src/services/pwa.ts', 'utf8')).not.toContain('reload(')
})
it('retains safe areas and the mobile 390px presentation contract in standalone', () => {
  const css = readFileSync('src/index.css', 'utf8')
  expect(css).toContain('@media (display-mode: standalone)')
  expect(css).toContain('env(safe-area-inset-top, 0px)')
  expect(css).toContain('calc(112px + env(safe-area-inset-bottom, 0px))')
  expect(css).toContain('@media (max-width: 768px)')
})
