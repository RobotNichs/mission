// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { initialGamificationState } from './types/gamification'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'
import { createTestLocks } from './services/testLocks'

let now = 0
const game = () => JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!)
const mission = () => JSON.parse(localStorage.getItem('mission.saved-mission.v1')!)
function tick(milliseconds: number) { act(() => { now += milliseconds; vi.advanceTimersByTime(250) }) }
beforeEach(() => {
  localStorage.clear()
  now = 0
  vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ ...initialGamificationState, coins: 10, ownedOrbIds: ['orb-legendary'], equippedOrbId: 'orb-legendary' }))
  localStorage.setItem('mission.saved-mission.v1', JSON.stringify({
    form: { goal: 'SQL-JOINs verstehen', timeBudgetMinutes: 5, energyLevel: 'medium', learningBlocker: null },
    mission: { id: 'mission-preserved', goal: 'SQL-JOINs verstehen', timeBudgetMinutes: 5, energyLevel: 'medium', learningBlocker: null,
      steps: [{ id: 'learn', title: 'JOINs erklären', description: 'Erkläre einen INNER JOIN.', minutes: 2, kind: 'learning', done: false },
        { id: 'practice', title: 'JOINs üben', description: 'Verknüpfe zwei Tabellen.', minutes: 3, kind: 'practice', done: false }] },
    remainingSeconds: 300,
  }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('Minimalistischer Fokusmodus', () => {
  it('animiert denselben Orb zum Ziel, bricht bei Resize/Verlassen ab und vergütet nur laufende Zeit', () => {
    const cancel = vi.fn()
    const animate = vi.fn(() => ({ cancel }))
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return (this.classList.contains('mission-core')
        ? { left: 20, top: 500, width: 76, height: 76 }
        : { left: 300, top: 150, width: 280, height: 280 }) as DOMRect
    })
    try {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: /Start/ }))
      expect(screen.getByRole('main').getAttribute('data-focus-entering')).toBe('true')
      expect(screen.getByRole('img', { name: 'Sternenstaub' }).getAttribute('data-orb-id')).toBe('orb-legendary')
      expect((document.querySelector('.focus-orb-stage') as HTMLElement).style.width).toBe('min(280px, 78vw, 100%)')
      expect(animate.mock.calls[0]).toEqual([
        [{ transform: 'translate(-280px, 350px) scale(0.2714285714285714, 0.2714285714285714)', transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }],
        { duration: 700, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' },
      ])
      fireEvent(window, new Event('resize'))
      expect(screen.getByRole('main').getAttribute('data-focus-entering')).toBe('false')
      expect(cancel).toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Fokusmodus verlassen' }))
      fireEvent.click(screen.getByRole('button', { name: /Start/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Fokusmodus verlassen' }))
      tick(60_000)
      expect(game()).toMatchObject({ coins: 10, totalFocusMilliseconds: 0 })
      expect(mission().history).toEqual([])
      fireEvent.click(screen.getByRole('button', { name: /Start/ }))
      act(() => vi.advanceTimersByTime(900))
      expect(screen.getByRole('main').getAttribute('data-focus-entering')).toBe('false')
      tick(60_000)
      expect(game()).toMatchObject({ coins: 11, totalFocusMilliseconds: 60_000 })
    } finally { delete (Element.prototype as unknown as { animate?: unknown }).animate }
  })

  it('überspringt den Positionsübergang bei reduzierter Bewegung', () => {
    const animate = vi.fn()
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 20, top: 30, width: 76, height: 76 } as DOMRect)
    const original = window.matchMedia
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList)
    try {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: /Start/ }))
      expect(animate).not.toHaveBeenCalled()
      expect(screen.getByRole('main').getAttribute('data-focus-entering')).toBe('false')
      expect(screen.getByRole('timer').textContent).toContain('05:00')
    } finally { window.matchMedia = original; delete (Element.prototype as unknown as { animate?: unknown }).animate }
  })
  it('wählt alle Umgebungen vor und während der Session ohne zusätzliche Vergütung', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Umgebung \u00e4ndern' }))
    fireEvent.change(screen.getByLabelText('Fokus-Umgebung'), { target: { value: 'nebula' } })
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    expect(screen.getByRole('main').classList.contains('environment-nebula')).toBe(true)
    tick(30_000)
    expect(screen.getByRole('main').getAttribute('data-background-motion')).toBe('running')
    fireEvent.click(screen.getByRole('button', { name: 'Umgebung \u00e4ndern' }))
    const beforeGame = localStorage.getItem(GAMIFICATION_STORAGE_KEY)
    const beforeMission = localStorage.getItem('mission.saved-mission.v1')
    for (const id of ['still', 'deep-space', 'nebula', 'liquid']) {
      fireEvent.change(screen.getByLabelText('Fokus-Umgebung'), { target: { value: id } })
      expect(screen.getByRole('main').classList.contains(`environment-${id}`)).toBe(true)
      expect(screen.getByRole('timer').textContent).toContain('04:30')
      expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(beforeGame)
      expect(localStorage.getItem('mission.saved-mission.v1')).toBe(beforeMission)
    }
    fireEvent.keyDown(screen.getByLabelText('Fokus-Umgebung'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('main', { name: 'Fokusmodus' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Umgebung ändern' }))
    tick(30_000)
    expect(game()).toMatchObject({ coins: 11, totalFocusMilliseconds: 60_000 })
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByRole('main').getAttribute('data-background-motion')).toBe('paused')
    fireEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }))
    expect(screen.getByRole('main').getAttribute('data-background-motion')).toBe('running')
  })

  it('stellt die Umgebung nach Reload mit pausiertem Timer wieder her und pausiert versteckte Hintergründe', () => {
    const first = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Umgebung \u00e4ndern' }))
    fireEvent.change(screen.getByLabelText('Fokus-Umgebung'), { target: { value: 'deep-space' } })
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    tick(10_000)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.getByRole('main').getAttribute('data-background-motion')).toBe('paused')
    hidden.mockReturnValue(false)
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.getByRole('main').getAttribute('data-background-motion')).toBe('running')
    first.unmount()
    render(<App />)
    expect(screen.getByText('Deep Space')).toBeTruthy()
    tick(60_000)
    expect(game().totalFocusMilliseconds).toBe(10_000)
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    expect(screen.getByRole('main').classList.contains('environment-deep-space')).toBe(true)
    expect(screen.getByRole('timer').textContent).toContain('04:50')
  })

  it('hält Hintergründe klickdurchlässig, ohne feste Breite und bei reduced motion statisch', async () => {
    const { readFileSync } = await import(/* @vite-ignore */ 'node:' + 'fs')
    const styles: string = readFileSync('src/index.css', 'utf8')
    expect(styles).toMatch(/\.focus-backdrop \{[^}]*inset: 0;[^}]*pointer-events: none/)
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.focus-backdrop[^}]*animation: none !important/)
    expect(styles).toMatch(/\.focus-mode\[data-background-motion='paused'\] \.focus-atmosphere \{ animation-play-state: paused/)
    expect(styles).not.toMatch(/\.environment-still[^}]*animation:/)
  })

  it('bewegt beide Sternen- und Wellenebenen und pausiert beide mit dem Sichtbarkeitszustand', async () => {
    const { readFileSync } = await import(/* @vite-ignore */ 'node:' + 'fs')
    const stylesheet = document.createElement('style')
    stylesheet.textContent = readFileSync('src/index.css', 'utf8')
    document.head.appendChild(stylesheet)
    try {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: /Start/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Umgebung ändern' }))
      for (const environment of ['deep-space', 'liquid']) {
        fireEvent.change(screen.getByLabelText('Fokus-Umgebung'), { target: { value: environment } })
        const layers = [...document.querySelectorAll('.focus-atmosphere, .focus-atmosphere-detail')]
        expect(layers).toHaveLength(2)
        for (const layer of layers) expect(getComputedStyle(layer).animation).toContain('infinite alternate')
        if (environment === 'liquid') expect(document.querySelectorAll('.focus-backdrop svg path')).toHaveLength(10)
        fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
        for (const layer of layers) expect(getComputedStyle(layer).animationPlayState).toBe('paused')
        fireEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }))
        for (const layer of layers) expect(getComputedStyle(layer).animationPlayState).not.toBe('paused')
      }
    } finally { stylesheet.remove() }
  })
  it('öffnet beim Timerstart die Ansicht mit ausgewähltem Orb, Lernziel und Countdown', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    expect(screen.getByRole('main', { name: 'Fokusmodus' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Sternenstaub' })).toBeTruthy()
    expect(document.querySelector('.focus-orb')?.classList.contains('is-animated')).toBe(true)
    expect(screen.getByRole('heading', { name: 'SQL-JOINs verstehen' })).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toContain('05:00')
    expect(screen.queryByRole('heading', { name: 'Orb-Kiste' })).toBeNull()
    expect(screen.queryByText('Deine Orb-Sammlung')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Ein Moment für deinen Fokus.' }))
    tick(60_000)
    expect(screen.getByRole('timer').textContent).toContain('04:00')
    expect(mission().remainingSeconds).toBe(240)
    expect(game()).toMatchObject({ coins: 11, totalFocusMilliseconds: 60_000 })
  })

  it('pausiert und setzt denselben Timer mit erhaltenen Teilminuten fort', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    tick(30_000)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    tick(120_000)
    expect(game().totalFocusMilliseconds).toBe(30_000)
    expect(screen.getByRole('timer').textContent).toContain('04:30')
    fireEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }))
    tick(30_000)
    expect(game()).toMatchObject({ coins: 11, totalFocusMilliseconds: 60_000 })
  })

  it('verlässt mit Escape, rechnet den letzten Zeitabschnitt ab und fokussiert den Startknopf', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    now = 60_500 // The exit must include time since the last scheduled tick.
    fireEvent.keyDown(screen.getByRole('main'), { key: 'Escape' })
    expect(screen.queryByRole('main', { name: 'Fokusmodus' })).toBeNull()
    expect(game()).toMatchObject({ coins: 11, totalFocusMilliseconds: 60_500 })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Start/ }))
    tick(120_000)
    expect(game().totalFocusMilliseconds).toBe(60_500)
    expect(mission().mission.id).toBe('mission-preserved')
  })

  it('speichert abgehakte Schritte ohne Zeit- oder Coinbonus und verlässt per Button pausiert', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /JOINs erklären/ }))
    expect(screen.getByRole('progressbar', { name: 'Lernfortschritt' }).getAttribute('aria-valuenow')).toBe('50')
    expect(game()).toMatchObject({ coins: 10, totalFocusMilliseconds: 0 })
    fireEvent.click(screen.getByRole('checkbox', { name: /JOINs üben/ }))
    expect(game()).toMatchObject({ coins: 10, totalFocusMilliseconds: 0, ownedOrbIds: ['orb-legendary'] })
    fireEvent.click(screen.getByRole('button', { name: 'Weiterlernen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fokusmodus verlassen' }))
    tick(60_000)
    expect(game().coins).toBe(10)
    expect(mission().mission.steps.every((step: { done: boolean }) => step.done)).toBe(true)
  })

  it('lädt die aktive Mission mit pausiertem Timer außerhalb des Fokusmodus', () => {
    const first = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    tick(59_500)
    first.unmount()
    now += 3_600_000
    render(<App />)
    expect(screen.queryByRole('main', { name: 'Fokusmodus' })).toBeNull()
    expect(screen.getByRole('button', { name: /Start/ })).toBeTruthy()
    expect(screen.getByLabelText(/Verbleibende Zeit:/).textContent).toContain('04:01')
    expect(mission().mission.id).toBe('mission-preserved')
    tick(60_000)
    expect(game()).toMatchObject({ coins: 10, totalFocusMilliseconds: 59_500 })
  })

  it('zeigt bei Timer-Ende einen dezenten Abschluss und vergütet danach keine Zeit', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    tick(600_000)
    expect(screen.getByRole('timer').textContent).toContain('00:00')
    expect(screen.getByRole('status').textContent).toContain('Fokuszeit abgeschlossen')
    expect(document.querySelector('.focus-orb-stage')?.classList.contains('is-finished')).toBe(true)
    expect(game()).toMatchObject({ coins: 15, totalFocusMilliseconds: 300_000 })
    tick(60_000)
    expect(game().coins).toBe(15)
  })

  it('enthält mobile Layoutregeln und deaktiviert Fokusanimationen bei reduzierter Bewegung', async () => {
    const { readFileSync } = await import(/* @vite-ignore */ 'node:' + 'fs')
    const styles: string = readFileSync('src/index.css', 'utf8')
    expect(styles).toMatch(/@media \(max-width: 520px\)\s*\{\s*\.focus-mode/)
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.focus-orb-stage[^}]*animation: none/)
  })
})
