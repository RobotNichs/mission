export const securityHeaders = {
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
}
export function productionConfig(env = process.env) {
  const port = Number(env.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid_port')
  if (env.PUBLIC_ORIGIN) {
    const url = new URL(env.PUBLIC_ORIGIN)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('invalid_public_origin')
  }
  return { port, host: env.HOST ?? (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1') }
}
export function sameOriginRequest(request, env) {
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  if (!request.headers.origin) return true
  try {
    const origin = new URL(request.headers.origin)
    if (!['http:', 'https:'].includes(origin.protocol)) return false
    return env.PUBLIC_ORIGIN ? origin.origin === new URL(env.PUBLIC_ORIGIN).origin : origin.host === request.headers.host
  } catch { return false }
}
export function createAiLimiter(now = Date.now) {
  const clients = new Map()
  let globalWindow = { start: now(), count: 0 }
  return address => {
    const time = now()
    for (const [key, value] of clients) if (time - value.start >= 60000) clients.delete(key)
    if (time - globalWindow.start >= 60000) globalWindow = { start: time, count: 0 }
    const previous = clients.get(address)
    const retry = Math.max(1, Math.ceil((60000 - (time - (previous?.start ?? globalWindow.start))) / 1000))
    if (globalWindow.count >= 30 || (previous?.count ?? 0) >= 10 || (!previous && clients.size >= 1000)) return retry
    globalWindow.count++
    clients.set(address, { start: previous?.start ?? time, count: (previous?.count ?? 0) + 1 })
    return 0
  }
}
