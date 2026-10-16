import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('disables all companion motion under reduced motion and opts in explicitly', () => {
  const css = readFileSync('src/components/MissionCompanion.css', 'utf8')
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{\s*\.mission-companion \* { animation: none !important;/)
  expect(css).toContain("[data-animated='true'][data-state='idle']")
  expect(css).toContain("[data-motion='paused'] * { animation-play-state: paused !important;")
  expect(css).toContain('max-width: 100%')
})
it('keeps success finite and focus free from breathing or pulses', () => {
  const css = readFileSync('src/components/MissionCompanion.css', 'utf8')
  expect(css).toContain('companion-success 850ms ease-out 1')
  expect(css).toContain('companion-warmth 850ms ease-out 1')
  expect(css.split('\n').filter(line => line.includes("[data-state='success']")).join('')).not.toContain('infinite')
  expect(css.split('\n').filter(line => line.includes("[data-state='focus']")).join('')).not.toMatch(/breathe|warmth/)
})
it('gates the isolated entry before importing preview code', () => {
  const main = readFileSync('src/main.tsx', 'utf8')
  expect(main).toContain('import.meta.env.DEV && isLocalDevelopment(import.meta.env.DEV, window.location.hostname)')
  expect(main).toContain("get('preview') === 'companion'")
  expect(main).toContain("if (companionPreview) {\n  void import('./components/CompanionPreview')")
})
