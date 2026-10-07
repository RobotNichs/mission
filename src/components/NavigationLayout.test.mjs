import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('defines desktop spacing, mobile safe areas and reduced-motion loading', () => {
  const css = readFileSync('src/index.css', 'utf8')
  expect(css).toContain('@media (min-width: 769px)'); expect(css).toContain('calc(100% - 236px)')
  expect(css).toContain('env(safe-area-inset-bottom'); expect(css).toContain('.loading-ring { animation: none; }')
  expect(css).toContain('repeat(7, minmax(0, 1fr))'); expect(css).toContain('grid-column: 6 / span 2')
})
