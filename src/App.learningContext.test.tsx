import { screen, within } from './services/testNavigation'
// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { createTestLocks } from './services/testLocks'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'
import type { LearningPlan, LearningPlanRequest } from './types/learningPlan'

const key = 'mission.saved-mission.v1'
const plan: LearningPlan = { id: 'old-mission', goal: 'Statistik lernen', timeMode: 'manual', timeBudgetMinutes: 20, energyLevel: 'low', learningBlocker: 'starting',
  steps: [{ id: 'old-step', title: 'Mittelwert', description: 'Versuche einen ersten Schritt.', minutes: 20, kind: 'practice', done: true }] }
const stored = () => JSON.parse(localStorage.getItem(key)!)
beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, json: async () => ({ error: { category: 'provider_unreachable' } }) } as Response)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
async function ready() {
  await waitFor(() => expect((screen.getByRole('button', { name: /Mission planen|Mission aktualisieren/ }) as HTMLButtonElement).closest('fieldset')!.disabled).toBe(false))
}
function openContext() { fireEvent.click(screen.getByText('Mehr Kontext')) }

it('lädt alte Missionen, IDs, Häkchen und Timer ohne Kontext weiterhin', async () => {
  localStorage.setItem(key, JSON.stringify({ form: { goal: plan.goal, timeBudgetMinutes: 20, energyLevel: 'low', learningBlocker: 'starting' }, mission: plan, remainingSeconds: 345, elapsedSeconds: 855 }))
  render(<App />); await ready()
  expect(stored().mission).toEqual(plan)
  expect(stored().remainingSeconds).toBe(345)
  expect(stored().elapsedSeconds).toBe(855)
  openContext()
  expect((screen.getByLabelText('Lernumgebung') as HTMLSelectElement).value).toBe('')
})

it('speichert Kontext nur im Formularentwurf, stellt ihn wieder her und verändert keinen aktiven Plan', async () => {
  localStorage.setItem(key, JSON.stringify({ form: { goal: plan.goal, timeBudgetMinutes: 20, energyLevel: 'low', learningBlocker: 'starting' }, mission: plan, remainingSeconds: 300, elapsedSeconds: 900 }))
  const view = render(<App />); await ready()
  const game = localStorage.getItem(GAMIFICATION_STORAGE_KEY)
  openContext()
  fireEvent.change(screen.getByLabelText('Lernumgebung'), { target: { value: 'university' } })
  fireEvent.change(screen.getByLabelText('Lernzweck'), { target: { value: 'revision' } })
  fireEvent.click(screen.getByLabelText('Vorlesungsfolien'))
  expect(stored().form.learningContext).toEqual({ environment: 'university', purpose: 'revision', materials: ['slides'] })
  expect(stored().mission).toEqual(plan); expect(stored().remainingSeconds).toBe(300)
  expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(game)
  view.unmount(); render(<App />); await ready(); openContext()
  expect((screen.getByLabelText('Lernumgebung') as HTMLSelectElement).value).toBe('university')
  expect((screen.getByLabelText('Vorlesungsfolien') as HTMLInputElement).checked).toBe(true)
})

it('verwirft beschädigten optionalen Kontext, ohne die gespeicherte Mission zu verwerfen', async () => {
  localStorage.setItem(key, JSON.stringify({ ...plan, learningContext: { materials: ['none', 'book'] }, remainingSeconds: 400 }))
  render(<App />); await ready()
  expect(stored().mission.id).toBe(plan.id)
  expect(stored().mission.steps).toEqual(plan.steps)
  expect(stored().mission.learningContext).toBeUndefined()
  expect(stored().remainingSeconds).toBe(400)
})

it('führt Kontext durch eine Rückfrage und Überspringen, während die aktive Mission erhalten bleibt', async () => {
  localStorage.setItem(key, JSON.stringify({ form: { goal: plan.goal, timeBudgetMinutes: 20, energyLevel: 'low', learningBlocker: 'starting' }, mission: plan, remainingSeconds: 300 }))
  const requests: LearningPlanRequest[] = []
  vi.mocked(globalThis.fetch).mockImplementation(async (_url, init) => {
    const input = JSON.parse(String(init?.body)) as LearningPlanRequest
    requests.push(input)
    return { ok: true, json: async () => ({ source: 'mock', clarifyingQuestion: requests.length === 1 ? 'Welche Materialien hast du?' : null,
      plan: { id: 'new-plan', goal: input.goal, timeBudgetMinutes: input.timeBudgetMinutes, energyLevel: input.energyLevel, learningBlocker: input.learningBlocker, learningContext: input.learningContext,
        steps: [{ id: 'new-step', title: 'Eigene Frage', description: 'Versuche eine eigene Erklärung zu Statistik.', kind: 'learning', minutes: input.timeBudgetMinutes, done: false }] } }) } as Response
  })
  render(<App />); await ready(); openContext()
  fireEvent.click(screen.getByLabelText('Keine Materialien'))
  const game = localStorage.getItem(GAMIFICATION_STORAGE_KEY)
  fireEvent.click(screen.getByRole('button', { name: /Mission aktualisieren/ }))
  await screen.findByRole('heading', { name: 'Welche Materialien hast du?' })
  expect(stored().mission).toEqual(plan); expect(stored().remainingSeconds).toBe(300)
  expect(screen.getByLabelText('Keine Materialien').matches(':disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /Überspringen/ }))
  await waitFor(() => expect(requests).toHaveLength(2))
  await waitFor(() => expect(stored().mission.steps[0].title).toBe('Eigene Frage'))
  expect(requests[1].learningContext).toEqual({ materials: ['none'] })
  expect(requests[1].clarification?.skipped).toBe(true)
  expect(stored().mission.learningContext).toEqual({ materials: ['none'] })
  expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(game)
})

it('übernimmt Kontext beim eigenen Plan und lässt ihn im Editor ändern', async () => {
  render(<App />); await ready(); openContext()
  fireEvent.change(screen.getByLabelText('Was möchtest du lernen?'), { target: { value: 'Statistik lernen' } })
  fireEvent.click(screen.getByLabelText('Buch'))
  fireEvent.click(screen.getByRole('button', { name: 'Eigenen Plan erstellen' }))
  const editor = within(screen.getByRole('form', { name: 'Lernplan bearbeiten' }))
  fireEvent.click(editor.getByText('Mehr Kontext'))
  expect((editor.getByLabelText('Buch') as HTMLInputElement).checked).toBe(true)
  fireEvent.click(editor.getByLabelText('Keine Materialien'))
  fireEvent.change(editor.getByLabelText('Titel'), { target: { value: 'Eine Frage formulieren' } })
  fireEvent.change(editor.getByLabelText('Beschreibung'), { target: { value: 'Versuche eine kleine eigene Erklärung.' } })
  fireEvent.click(editor.getByRole('button', { name: 'Änderungen speichern' }))
  expect(stored().mission.learningContext).toEqual({ materials: ['none'] })
})
