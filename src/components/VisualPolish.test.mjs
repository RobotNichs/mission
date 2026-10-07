import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/index.css', 'utf8')
const polish = css.split('/* Phase 12B:')[1]
describe('dashboard-only visual polish contracts', () => {
  it('uses a bounded spacing scale and shared surfaces', () => {
    for (const token of ['xs', 'sm', 'md', 'lg', 'xl']) expect(polish).toContain(`--spacing-${token}:`)
    expect(polish).toContain('border-radius: var(--radius)')
    expect(polish).toContain('background: var(--paper)')
  })
  it('reserves desktop sidebar space at the existing breakpoint', () => {
    expect(polish).toContain('--sidebar-width: 208px')
    expect(polish).toContain('--content-max: 1280px')
    expect(polish).toContain('@media (min-width: 769px)')
    expect(polish).toContain('calc(100% - var(--sidebar-width) - 64px)')
    expect(polish).toContain('calc(var(--sidebar-width) + 32px)')
  })
  it('keeps narrow layouts bounded without clipping or hiding controls', () => {
    expect(polish).toContain('width: calc(100% - 32px)')
    expect(polish).toContain('width: min(190px, 100%)')
    expect(polish).toContain('flex: 1 1 120px')
    expect(polish).not.toMatch(/overflow:\s*hidden|pointer-events:\s*none|display:\s*none/)
    expect(css).toContain('env(safe-area-inset-bottom')
    expect(css).toContain('repeat(7, minmax(0, 1fr))')
  })
  it('preserves focus visuals, reduced motion and real orb sizing', () => {
    expect(polish).not.toMatch(/\.focus-mode|\.focus-orb|\.orb-art|transform:|animation:/)
    expect(css).toContain('.loading-ring { animation: none; }')
    expect(readFileSync('src/components/GamificationPanel.tsx', 'utf8')).toContain('getOrbSize(effectiveDisplayLevel)')
  })
  it('keeps accessible active markers and legible disabled controls', () => {
    expect(polish).toContain('[aria-pressed="true"]')
    expect(polish).toContain('border-left: 3px solid var(--accent)')
    expect(polish).toContain('opacity: .65; cursor: not-allowed')
    expect(css).toContain('button:focus-visible')
  })
})
