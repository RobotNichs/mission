import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
export const pwaStaticFiles = ['manifest.webmanifest', 'icons/mission-192.png', 'icons/mission-512.png', 'icons/mission-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.svg']
export function pwaPlugin() {
  return {
    name: 'mission-pwa', apply: 'build',
    configResolved(config) { if (config.base !== '/') throw new Error('Mission PWA requires the existing root deployment (/).') },
    generateBundle: { order: 'post', handler(_options, bundle) {
      const hash = createHash('sha256')
      for (const name of pwaStaticFiles) {
        const source = readFileSync(new URL(`../public/${name}`, import.meta.url))
        this.emitFile({ type: 'asset', fileName: name, source }); hash.update(name).update(source)
      }
      const files = Object.values(bundle).filter(item => item.fileName === 'index.html' || item.type === 'chunk' || item.fileName.endsWith('.css'))
        .sort((a, b) => a.fileName.localeCompare(b.fileName))
      for (const item of files) hash.update(item.fileName).update(item.type === 'chunk' ? item.code : item.source)
      const urls = [...new Set([...files.map(item => `/${item.fileName}`), ...pwaStaticFiles.map(name => `/${name}`)])].sort()
      const worker = readFileSync(new URL('./serviceWorker.js', import.meta.url), 'utf8')
      hash.update(worker)
      const source = worker.replace('__MISSION_CACHE_NAME__', `mission-app-shell-${hash.digest('hex').slice(0, 20)}`)
        .replace('/*__MISSION_PRECACHE__*/ []', JSON.stringify(urls))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    } },
  }
}
