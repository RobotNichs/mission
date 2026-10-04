// @vitest-environment node
import { build } from 'vite'
import { expect, it, vi } from 'vitest'

it('entfernt die Prestige-Vorschau aus einem echten Produktionsbundle', async () => {
  // In-memory build: no dependency on stale dist files and no API requests.
  // Vitest starts with NODE_ENV=test; a production bundle must use production.
  vi.stubEnv('NODE_ENV', 'production')
  let result
  try {
    result = await build({ mode: 'production', logLevel: 'silent', build: { write: false } })
  } finally { vi.unstubAllEnvs() }
  const outputs = Array.isArray(result) ? result : [result]
  const source = outputs.flatMap(output => 'output' in output ? output.output : [])
    .map(chunk => chunk.type === 'chunk' ? chunk.code : '').join('\n')
  expect(source).toContain('Maximaler Prestige-Rang V')
  for (const marker of ['Prestige-Vorschau', 'prestige-preview', 'Vorschau: Prestige', 'Erreicht (Vorschau)', 'Prestige-Orb-Vorschau', 'Orb-Vorschau zurücksetzen', 'debug-prestige-orb']) {
    expect(source.includes(marker), `Kein Vorschaucode: ${marker}`).toBe(false)
  }
}, 30000)
