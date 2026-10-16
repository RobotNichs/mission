// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, expectTypeOf, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import MissionCompanion, { type CompanionState } from './MissionCompanion'
import CompanionPreview from './CompanionPreview'

const states = ['idle', 'focus', 'success', 'pause', 'error', 'offline', 'levelUp'] as const satisfies readonly CompanionState[]

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it.each(states)('renders %s with accessible description', state => {
  render(<MissionCompanion state={state} label={`Katze ${state}`} />)
  expect(screen.getByRole('img', { name: `Katze ${state}` }).getAttribute('data-state')).toBe(state)
})
it.each([60, 120, 200])('bounds a %s px instance and hides decorative artwork', size => {
  const { container } = render(<MissionCompanion size={size} />)
  expect((container.firstChild as HTMLElement).style.width).toBe(`${size}px`)
  expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  expect(screen.queryByRole('img')).toBeNull()
  expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 200 200')
})
it('explicitly disables animation and renders the actual head contour in silhouette', () => {
  const { container } = render(<MissionCompanion animated={false} silhouette />)
  expect(container.firstElementChild?.getAttribute('data-animated')).toBe('false')
  expect(container.querySelector('.companion-contour')?.getAttribute('fill')).toBe('currentColor')
  expect(container.querySelector('.companion-eyes')).toBeNull()
  expect(container.querySelector('ellipse')).toBeNull()
})
it.each(states)('disables motion independently of silhouette in %s', state => {
  const { container } = render(<MissionCompanion state={state} animated={false} className="inspection" />)
  expect(container.firstElementChild?.getAttribute('data-animated')).toBe('false')
  expect(container.firstElementChild?.classList.contains('inspection')).toBe(true)
  expect(container.querySelector('.companion-eyes')).toBeTruthy()
})
it('gives every instance unique gradient IDs and resolving references', () => {
  const { container } = render(<>{states.map(state => <MissionCompanion key={state} state={state} />)}</>)
  const ids = [...container.querySelectorAll('[id]')].map(el => el.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const el of container.querySelectorAll('[fill^="url("]')) {
    const id = el.getAttribute('fill')!.slice(5, -1)
    expect(ids).toContain(id)
  }
})
it('distinguishes idle and focus eyes while retaining the same head and silhouette', () => {
  const ui = render(<MissionCompanion state="idle" animated={false} />)
  const contour = ui.container.querySelector('.companion-contour')?.getAttribute('d')
  const idleEyes = [...ui.container.querySelectorAll('.companion-eyes path')].map(path => [path.getAttribute('d'), path.getAttribute('transform')])
  ui.rerender(<MissionCompanion state="focus" animated={false} />)
  const focusEyes = [...ui.container.querySelectorAll('.companion-eyes path')].map(path => [path.getAttribute('d'), path.getAttribute('transform')])
  expect(focusEyes).toHaveLength(2)
  expect(focusEyes).not.toEqual(idleEyes)
  expect(ui.container.querySelector('.companion-contour')?.getAttribute('d')).toBe(contour)
  ui.rerender(<MissionCompanion size={60} silhouette />)
  expect(ui.container.querySelector('.companion-contour')?.getAttribute('d')).toBe(contour)
  expect(ui.container.querySelector('.companion-eyes')).toBeNull()
})
it('does not restart success on parent rerenders; re-entry explicitly triggers a new expression', () => {
  const ui = render(<MissionCompanion state="success" />)
  const expression = ui.container.querySelector('.companion-expression')
  ui.rerender(<MissionCompanion state="success" size={200} />)
  expect(ui.container.querySelector('.companion-expression')).toBe(expression)
  ui.rerender(<MissionCompanion state="idle" />)
  ui.rerender(<MissionCompanion state="success" />)
  expect(ui.container.querySelector('.companion-expression')).not.toBe(expression)
})
it('keeps one common contour and equally colored inner ears through all expressions', () => {
  const ui = render(<MissionCompanion />)
  const contour = ui.container.querySelector('.companion-contour')?.getAttribute('d')
  for (const state of ['idle', 'focus', 'success', 'idle'] as const) {
    ui.rerender(<MissionCompanion state={state} />)
    expect(ui.container.querySelector('.companion-contour')?.getAttribute('d')).toBe(contour)
    const ears = [...ui.container.querySelectorAll('.companion-inner-ear')]
    expect(ears).toHaveLength(2)
    expect(ears.map(ear => [ear.getAttribute('fill'), ear.getAttribute('opacity')])).toEqual([
      ['#8A7BE0', '.32'], ['#8A7BE0', '.32'],
    ])
  }
})
it('retains a single mouth during success transitions and puts the diffuse pulse behind the opaque head', () => {
  const ui = render(<MissionCompanion />)
  const mouthShapes = new Map<CompanionState, string | null>()
  for (const state of ['idle', 'success', 'success', 'focus', 'success', 'idle'] as const) {
    ui.rerender(<MissionCompanion state={state} />)
    const mouths = ui.container.querySelectorAll('.companion-mouth')
    expect(mouths).toHaveLength(1)
    if (mouthShapes.has(state)) expect(mouths[0].getAttribute('d')).toBe(mouthShapes.get(state))
    mouthShapes.set(state, mouths[0].getAttribute('d'))
    const pulse = ui.container.querySelector('.companion-warmth')!
    const head = ui.container.querySelector('.companion-contour')!
    // The pulse cannot draw a second curved facial stroke, even at peak opacity.
    expect(pulse.tagName).toBe('ellipse')
    expect(pulse.hasAttribute('stroke')).toBe(false)
    expect(pulse.getAttribute('fill')).toMatch(/^url\(#/)
    expect(pulse.compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(head.hasAttribute('opacity')).toBe(false)
  }
})
it('pauses offscreen and hidden-page animation and cleans observers', () => {
  let notify: IntersectionObserverCallback
  const disconnect = vi.fn()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { notify = callback }
    observe() {} disconnect = disconnect
  })
  const ui = render(<MissionCompanion />)
  act(() => notify([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver))
  expect(ui.container.firstElementChild?.getAttribute('data-motion')).toBe('paused')
  act(() => notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
  expect(ui.container.firstElementChild?.getAttribute('data-motion')).toBe('running')
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  fireEvent(document, new Event('visibilitychange'))
  expect(ui.container.firstElementChild?.getAttribute('data-motion')).toBe('paused')
  ui.unmount(); expect(disconnect).toHaveBeenCalledOnce()
})
it('offers all preview variants without storage writes or network requests', () => {
  const save = vi.spyOn(Storage.prototype, 'setItem')
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  render(<CompanionPreview />)
  expect(screen.getAllByRole('img')).toHaveLength(17)
  for (const state of states) expect(document.querySelector(`.companion-preview [data-state="${state}"]`)).toBeTruthy()
  expect(screen.getByLabelText('Companion: Erfolg').getAttribute('data-animated')).toBe('false')
  expect(screen.getByLabelText('Companion: Level-Up').getAttribute('data-animated')).toBe('false')
  expect(screen.getByLabelText('Companion: fragend').getAttribute('data-animated')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: 'Error auslösen' }))
  expect(screen.getByLabelText('Companion: fragend').getAttribute('data-animated')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Error zurücksetzen' }))
  expect(screen.getByLabelText('Companion: fragend').getAttribute('data-animated')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: 'Erfolg auslösen' }))
  expect(screen.getByLabelText('Companion: Erfolg').getAttribute('data-state')).toBe('success')
  expect(screen.getByLabelText('Companion: Erfolg').getAttribute('data-animated')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Erfolg zurücksetzen' }))
  expect(screen.getByLabelText('Companion: Erfolg').getAttribute('data-animated')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: 'Level-Up auslösen' }))
  expect(screen.getByLabelText('Companion: Level-Up').getAttribute('data-state')).toBe('levelUp')
  fireEvent.click(screen.getByRole('button', { name: 'Level-Up zurücksetzen' }))
  expect(screen.getByLabelText('Companion: Level-Up').getAttribute('data-state')).toBe('levelUp')
  expect(screen.getByLabelText('Companion: Level-Up').getAttribute('data-animated')).toBe('false')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Reduzierte Bewegung simulieren' }))
  expect(screen.getByRole('main').getAttribute('data-reduced-motion')).toBe('true')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Reduzierte Bewegung simulieren' }))
  expect(screen.getByRole('main').getAttribute('data-reduced-motion')).toBe('false')
  for (const state of states) {
    fireEvent.change(screen.getByRole('combobox', { name: 'Kleine Vorschau: Zustand' }), { target: { value: state } })
    expect(screen.getByLabelText('Companion: kleine Darstellung').getAttribute('data-state')).toBe(state)
    expect((screen.getByLabelText('Companion: kleine Darstellung') as HTMLElement).style.width).toBe('60px')
  }
  expect(save).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
})

it('preserves the prop contract and excludes unsupported state names at type level', () => {
  expectTypeOf<ComponentProps<typeof MissionCompanion>['state']>().toEqualTypeOf<CompanionState | undefined>()
  expectTypeOf<'sleep'>().not.toMatchTypeOf<CompanionState>()
  expectTypeOf<ComponentProps<typeof MissionCompanion>>().toEqualTypeOf<{
    size?: number; state?: CompanionState; animated?: boolean; className?: string; label?: string; silhouette?: boolean
  }>()
})
it('allows every state transition without duplicate features, changing the body or adding live regions', () => {
  const ui = render(<MissionCompanion />)
  const contour = ui.container.querySelector('.companion-contour')!.getAttribute('d')
  const ids = [...ui.container.querySelectorAll('[id]')].map(node => node.id)
  for (const from of states) for (const to of states) {
    ui.rerender(<MissionCompanion state={from} />)
    ui.rerender(<MissionCompanion state={to} />)
    expect(ui.container.querySelectorAll('.companion-contour')).toHaveLength(1)
    expect(ui.container.querySelector('.companion-contour')!.getAttribute('d')).toBe(contour)
    expect(ui.container.querySelectorAll('.companion-eyes')).toHaveLength(1)
    expect(ui.container.querySelectorAll('.companion-mouth')).toHaveLength(1)
    expect(ui.container.querySelectorAll('.companion-inner-ear')).toHaveLength(2)
    expect([...ui.container.querySelectorAll('[id]')].map(node => node.id)).toEqual(ids)
    expect(ui.container.querySelector('[aria-live], [role="status"]')).toBeNull()
    expect(ui.container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
    const pulse = ui.container.querySelector('.companion-warmth')!
    expect(pulse.tagName).toBe('ellipse')
    expect(pulse.hasAttribute('stroke')).toBe(false)
    expect(pulse.compareDocumentPosition(ui.container.querySelector('.companion-contour')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    ui.rerender(<MissionCompanion state={to} size={60} silhouette />)
    expect(ui.container.querySelector('.companion-contour')!.getAttribute('d')).toBe(contour)
    expect(ui.container.querySelector('.companion-eyes, .companion-mouth, .companion-warmth')).toBeNull()
  }
})
it.each(['success', 'levelUp', 'error'] as const)('does not restart %s for size, label or parent rerenders', state => {
  const ui = render(<MissionCompanion state={state} label="Vorher" />)
  const expression = ui.container.querySelector('.companion-expression')
  ui.rerender(<MissionCompanion state={state} size={200} label="Nachher" className="inspection" />)
  expect(ui.container.querySelector('.companion-expression')).toBe(expression)
  ui.rerender(<MissionCompanion state="focus" />)
  ui.rerender(<MissionCompanion state={state} />)
  expect(ui.container.querySelector('.companion-expression')).not.toBe(expression)
})
it('distinguishes all seven static faces with animation disabled', () => {
  const ui = render(<MissionCompanion />)
  const expressions = new Set<string>()
  for (const state of states) {
    ui.rerender(<MissionCompanion state={state} animated={false} />)
    expressions.add(ui.container.querySelector('.companion-eyes')!.innerHTML + ui.container.querySelector('.companion-mouth')!.outerHTML)
    if (state === 'success' || state === 'offline') {
      expect(ui.container.querySelector('.companion-eyes ellipse')).toBeNull()
    }
    if (state === 'levelUp') {
      expect(ui.container.querySelector('.companion-level-open')?.getAttribute('visibility')).toBe('hidden')
      expect(ui.container.querySelector('.companion-level-open')?.getAttribute('opacity')).toBe('0')
      expect(ui.container.querySelector('.companion-level-pupils')?.getAttribute('visibility')).toBe('hidden')
      expect(ui.container.querySelector('.companion-level-hearts')?.getAttribute('visibility')).toBe('hidden')
      expect(ui.container.querySelector('.companion-level-rest')?.getAttribute('visibility')).toBe('visible')
    }
  }
  expect(expressions.size).toBe(states.length)
})
it('opens error lids more than idle symmetrically, and narrows focus without hiding its pupils', () => {
  const ui = render(<MissionCompanion />)
  const height = (state: CompanionState) => {
    ui.rerender(<MissionCompanion state={state} animated={false} />)
    const lids = ui.container.querySelectorAll('.companion-eye-surface')
    const left = lids[0].getAttribute('transform')!
    expect(lids[1].getAttribute('transform')).toContain(left)
    return Number(left.match(/scale\(1 ([\d.]+)\)/)![1])
  }
  const idle = height('idle')
  expect(height('error')).toBeGreaterThan(idle)
  expect(height('focus')).toBeLessThan(idle)
  expect(height('pause')).toBeGreaterThanOrEqual(idle)
  ui.rerender(<MissionCompanion state="error" />)
  expect(ui.container.querySelectorAll('.companion-gaze ellipse')).toHaveLength(2)
  for (const pupil of ui.container.querySelectorAll('.companion-gaze ellipse')) {
    expect(pupil.hasAttribute('opacity')).toBe(false)
    expect(pupil.hasAttribute('visibility')).toBe(false)
  }
})
it.each([60, 120, 200])('restricts temporary heart details to readable level-up instances at %s px', size => {
  const ui = render(<MissionCompanion size={size} />)
  for (const state of states) {
    ui.rerender(<MissionCompanion size={size} state={state} />)
    const hearts = ui.container.querySelector('.companion-level-hearts')
    if (state !== 'levelUp' || size === 60) expect(hearts).toBeNull()
    else {
      expect(hearts?.getAttribute('visibility')).toBe('hidden')
      expect(hearts?.querySelectorAll('path')).toHaveLength(2)
      expect(hearts?.closest('.companion-level-open')).toBeTruthy()
    }
  }
})
it('keeps the finished eye phase protected from child visibility overrides on size changes', () => {
  const ui = render(<MissionCompanion state="levelUp" size={60} />)
  const expression = ui.container.querySelector('.companion-expression')
  for (const size of [120, 60, 200]) {
    ui.rerender(<MissionCompanion state="levelUp" size={size} />)
    expect(ui.container.querySelector('.companion-expression')).toBe(expression)
    expect(ui.container.querySelector('.companion-level-open')?.getAttribute('opacity')).toBe('0')
    expect(ui.container.querySelector('.companion-level-open')?.getAttribute('visibility')).toBe('hidden')
    expect(ui.container.querySelector('.companion-level-rest')?.getAttribute('visibility')).toBe('visible')
  }
})
it.each(['idle', 'focus', 'pause', 'error'] as const)('uses naturally mirrored lids and isolated pupils in %s', state => {
  const { container } = render(<MissionCompanion state={state} />)
  const lids = container.querySelectorAll('.companion-eyes > path')
  expect(lids).toHaveLength(2)
  expect(lids[0].getAttribute('d')).toBe(lids[1].getAttribute('d'))
  expect(lids[1].getAttribute('transform')).toContain('scale(-1 1)')
  const gaze = container.querySelector('.companion-gaze')!
  expect(gaze.querySelectorAll('ellipse')).toHaveLength(2)
  expect(gaze.querySelectorAll('circle')).toHaveLength(2)
  expect(gaze.querySelector('path, .companion-mouth, .companion-contour, .companion-inner-ear')).toBeNull()
  const twitch = container.querySelector('.companion-inner-ear-left')!
  expect(twitch.tagName).toBe('path')
  expect(twitch.contains(container.querySelector('.companion-contour'))).toBe(false)
})
it.each([60, 120, 200])('keeps all expressions single and bounded at %s px', size => {
  const ui = render(<MissionCompanion size={size} />)
  for (const state of states) {
    ui.rerender(<MissionCompanion size={size} state={state} />)
    expect((ui.container.firstChild as HTMLElement).style.width).toBe(`${size}px`)
    expect(ui.container.querySelectorAll('.companion-mouth')).toHaveLength(1)
    expect(ui.container.querySelectorAll('.companion-eyes')).toHaveLength(1)
  }
})
