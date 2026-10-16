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
it('keeps offline static, pause nearly still and every reaction opt-in and finite', () => {
  const css = readFileSync('src/components/MissionCompanion.css', 'utf8')
  expect(css).not.toContain("[data-state='offline']")
  const pauseRules = css.split('\n').filter(line => line.includes("[data-state='pause']") && line.includes('animation:'))
  expect(pauseRules).toHaveLength(2)
  expect(pauseRules.join('')).toContain('companion-blink 23s')
  expect(pauseRules.join('')).toContain('companion-rest-gaze 20s')
  expect(pauseRules.join('')).not.toMatch(/breathe|ear-twitch/)
  for (const state of ['error', 'success', 'levelUp']) {
    const rules = css.split('\n').filter(line => line.includes(`[data-state='${state}']`) && line.includes('animation:'))
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      expect(rule).toContain("[data-animated='true']")
      expect(rule).toMatch(/(?:ease-out|steps\(1, end\)) 1;/)
      expect(rule).not.toContain('infinite')
    }
  }
  expect(css).toContain('companion-level-up 1400ms')
  expect(css).toContain('companion-level-light 1400ms')
})
it('isolates ambient motion and leaves focus with only rare blinking', () => {
  const css = readFileSync('src/components/MissionCompanion.css', 'utf8')
  const rules = css.split('\n').filter(line => line.includes('animation:'))
  const idle = rules.filter(line => line.includes("[data-state='idle']"))
  expect(idle.join('')).toContain('.companion-gaze { animation: companion-curious-gaze 12s')
  expect(idle.join('')).toContain('.companion-inner-ear-left { animation: companion-ear-twitch 15s')
  const focus = rules.filter(line => line.includes("[data-state='focus']"))
  expect(focus).toHaveLength(1)
  expect(focus[0]).toContain('.companion-eyes { animation: companion-blink 17s')
  for (const rule of rules.filter(line => /gaze|ear-twitch/.test(line))) {
    expect(rule).toContain("[data-animated='true']")
    expect(rule).not.toContain('.companion-contour')
    expect(rule).not.toContain('.companion-expression')
  }
  expect(css).toContain('transform-origin: center bottom')
  expect(css).toContain("[data-silhouette='true'] .companion-expression { transform: none; }")
})
it('switches mutually exclusive level-up phases without path interpolation or crossfades', () => {
  const css = readFileSync('src/components/MissionCompanion.css', 'utf8')
  expect(css).not.toMatch(/\bd:\s*path\(|@supports/)
  for (const phase of ['open', 'rest', 'pupils', 'hearts']) {
    expect(css).toContain(`.companion-level-${phase} { animation: companion-level-${phase} 1400ms steps(1, end) 1; }`)
  }
  // Check every boundary of the declared discrete phases, including exact switches.
  // SVG visibility is inherited; explicit child visibility must also be hidden at rest.
  const visibleAt = (name, percent) => {
    const line = css.split('\n').find(line => line.startsWith(`@keyframes companion-level-${name} {`))
    expect(line).toBeTruthy()
    const frames = [...line.matchAll(/([\d%,\s]+)\{\s*visibility:\s*(visible|hidden);(?:\s*opacity:\s*[01];)?\s*}/g)]
      .flatMap(match => match[1].split(',').map(value => ({ at: Number(value.trim().replace('%', '')), visible: match[2] === 'visible' })))
      .sort((a, b) => a.at - b.at)
    return frames.filter(frame => frame.at <= percent).at(-1)?.visible
  }
  expect(css).toContain('0% { visibility: visible; opacity: 1; } 65%, 100% { visibility: hidden; opacity: 0; }')
  for (const percent of [0, 18, 34.999, 35, 35.001, 64.999, 65, 65.001, 99.999, 100]) {
    const open = visibleAt('open', percent), rest = visibleAt('rest', percent)
    const pupils = visibleAt('pupils', percent), hearts = visibleAt('hearts', percent)
    expect(Number(open) + Number(rest)).toBe(1)
    expect(pupils && hearts).toBe(false)
    if (pupils || hearts) expect(open).toBe(true)
    if (open) expect(pupils || hearts).toBe(true)
    expect(visibleAt('small-pupils', percent)).toBe(open)
  }
  expect(css).not.toMatch(/\.companion-contour\s*\{[^}]*animation:/)
})
it('simulates reduced motion in the dev preview without overriding the system preference', () => {
  const css = readFileSync('src/components/CompanionPreview.css', 'utf8')
  expect(css).toContain("[data-reduced-motion='true'] .mission-companion * { animation: none !important; }")
  for (const match of css.matchAll(/animation:\s*([^;]+);/g)) expect(match[1]).toBe('none !important')
})
