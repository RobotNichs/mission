import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('nutzt responsive, umbrechende Intervallfelder mit begrenzten Eingaben', () => {
  // Vitest strips stylesheet imports; inspect the real CSS contract directly.
  const css = readFileSync('src/index.css', 'utf8')
  expect(css).toMatch(/\.strategy-custom[^}]*repeat\(auto-fit, minmax\(min\(100%, 160px\)/)
  expect(css).toMatch(/\.focus-strategy-fields input[^}]*min-width: 0/)
})
