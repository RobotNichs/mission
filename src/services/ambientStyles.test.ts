// @vitest-environment node
import { expect, it } from 'vitest'

const { readFileSync } = await import(/* @vite-ignore */ 'node:' + 'fs')
const css = readFileSync('src/ambient.css', 'utf8')
it('uses one active page layer rather than independent card effects', () => {
  for (const area of ['home', 'plan', 'projects', 'library', 'progress']) expect(css).toContain(`[data-app-area="${area}"]`)
  expect(css).toContain('.app-shell[data-app-area]::before')
  expect(css).not.toMatch(/\.(setup-panel|plan-panel|mission-core-panel|learning-statistics)::before/)
  expect(readFileSync('src/main.tsx', 'utf8')).toContain("import './ambient.css'")
})
it('keeps decoration behind content and bounded without clipping host focus targets', () => {
  expect(css).toContain('pointer-events: none')
  expect(css).toContain('z-index: -1')
  expect(css).toContain('isolation: isolate')
  expect(css).toContain('clip-path: inset(0')
  expect(css).not.toMatch(/overflow:\s*hidden|filter:|url\(/)
})
it('disables new decoration for reduced motion and retains a single mobile layer', () => {
  expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none !important/)
  expect(css).toContain('@media (max-width: 768px)')
  expect(css).toContain('animation-duration: 40s')
  expect(css).not.toMatch(/\.focus-mode\s*\{|\.focus-mode::before/)
  const existing = readFileSync('src/index.css', 'utf8')
  expect(existing).toContain("[data-background-motion='paused']")
  expect(existing).toContain('prefers-reduced-motion: reduce')
})
it('removes different exposed body and shell backgrounds without changing safe areas', () => {
  expect(css).toContain('body { background: var(--ambient-navy); }')
  expect(css).toContain('isolation: isolate; background: transparent')
  expect(css).toContain('position: fixed')
  expect(css).not.toContain('safe-area-inset-bottom:')
})
it('wraps concrete action groups and preserves minimum touch areas', () => {
  expect(css).toContain('.mobile-mission-summary > button { min-height: 44px; }')
  expect(css).toContain('.setup-panel .clarification-skip')
  expect(css).toContain('.focus-controls > button { min-height: 44px; max-width: 100%; }')
  expect(css).toContain('flex-wrap: wrap')
  expect(css).toContain('gap: var(--spacing-sm)')
})
