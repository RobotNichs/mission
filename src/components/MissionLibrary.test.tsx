import { screen, within } from '../services/testNavigation'
// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import MissionLibrary from './MissionLibrary'
import App from '../App'
import { createTestLocks } from '../services/testLocks'
import { duplicateTemplate, exampleTemplates, exportTemplate, loadTemplates, missionFromTemplate, saveTemplate, TEMPLATE_STORAGE_KEY } from '../services/missionTemplates'

beforeEach(() => { localStorage.clear(); Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() }) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function setup(saveRequest = null as ReturnType<typeof missionFromTemplate> | null, sessionActive = false, enabled = true) {
  const onUse = vi.fn(), onDismissSave = vi.fn()
  const view = render(<MissionLibrary saveRequest={saveRequest} onUse={onUse} onDismissSave={onDismissSave} enabled={enabled} sessionActive={sessionActive} />)
  const details = document.querySelector('.mission-library') as HTMLDetailsElement
  details.open = true; fireEvent(details, new Event('toggle'))
  return { ...view, onUse, onDismissSave, details }
}
it('ist standardmäßig eingeklappt und zeigt fünf Beispiele nach dem Öffnen', () => {
  render(<MissionLibrary saveRequest={null} onUse={vi.fn()} onDismissSave={vi.fn()} enabled sessionActive={false} />)
  expect((document.querySelector('.mission-library') as HTMLDetailsElement).open).toBe(false)
  expect(document.querySelectorAll('.library-list li')).toHaveLength(5)
})
it('speichert Plan und Metadaten und verhindert doppelte schnelle Speicherung', () => {
  const plan = missionFromTemplate(exampleTemplates[0]); plan.steps[0].done = true
  setup(plan)
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Meine SQL-Mission' } })
  fireEvent.change(screen.getByLabelText('Herkunft'), { target: { value: 'ai' } })
  fireEvent.change(screen.getByLabelText('Tags (Komma getrennt, höchstens 8)'), { target: { value: 'sql, SQL, klausur' } })
  const form = screen.getByRole('form', { name: 'Lernplan bearbeiten' })
  fireEvent.submit(form); fireEvent.submit(form)
  expect(loadTemplates()).toHaveLength(1); expect(loadTemplates()[0].origin).toBe('ai'); expect(loadTemplates()[0].tags).toEqual(['sql', 'klausur'])
  expect(JSON.stringify(loadTemplates())).not.toContain('done')
})
it('bricht die Bearbeitung ab, ohne eine Vorlage anzulegen', () => {
  const { onDismissSave } = setup(missionFromTemplate(exampleTemplates[0]))
  fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' })); expect(loadTemplates()).toEqual([]); expect(onDismissSave).toHaveBeenCalled()
})
it('bearbeitet Beispiele als eigene Kopie und aktualisiert eigene Vorlagen explizit', () => {
  setup()
  const first = document.querySelector('.library-list li') as HTMLElement
  fireEvent.click(within(first).getByRole('button', { name: 'Bearbeiten' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Eigene Variante' } })
  fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }))
  const id = loadTemplates()[0].id
  const own = screen.getByRole('heading', { name: 'Eigene Variante' }).closest('li')!
  fireEvent.click(within(own).getByRole('button', { name: 'Bearbeiten' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Aktualisierte Variante' } })
  fireEvent.click(screen.getByRole('button', { name: 'Vorlage aktualisieren' }))
  expect(loadTemplates()).toHaveLength(1); expect(loadTemplates()[0].id).toBe(id); expect(loadTemplates()[0].title).toBe('Aktualisierte Variante')
})
it('dupliziert und löscht lokale Vorlagen, bietet für Beispiele kein Löschen an', () => {
  setup(); const first = document.querySelector('.library-list li') as HTMLElement
  expect(within(first).queryByRole('button', { name: 'Löschen' })).toBeNull()
  fireEvent.click(within(first).getByRole('button', { name: 'Duplizieren' })); expect(loadTemplates()).toHaveLength(1)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: 'Löschen' })); expect(loadTemplates()).toHaveLength(0)
})
it('filtert und sucht, ohne den aktiven Plan anzufassen', () => {
  const { onUse } = setup()
  fireEvent.change(screen.getByLabelText('Sprachfilter'), { target: { value: 'en' } })
  expect(document.querySelectorAll('.library-list li')).toHaveLength(1)
  fireEvent.change(screen.getByLabelText('Suchen'), { target: { value: 'sql' } })
  expect(document.querySelectorAll('.library-list li')).toHaveLength(0); expect(onUse).not.toHaveBeenCalled()
})
it('übergibt frische Missionen und sperrt die Übernahme für fortsetzbare Sessions', () => {
  const { onUse, unmount } = setup()
  fireEvent.click(screen.getAllByRole('button', { name: 'Mission starten' })[0])
  const a = onUse.mock.calls[0][0]
  fireEvent.click(screen.getAllByRole('button', { name: 'Mission starten' })[0])
  expect(onUse.mock.calls[1][0].id).not.toBe(a.id); expect(a.steps.every((s: { done: boolean }) => !s.done)).toBe(true)
  unmount(); const blocked = setup(null, true)
  expect(screen.getAllByRole('button', { name: 'Mission starten' }).every(b => (b as HTMLButtonElement).disabled)).toBe(true)
  expect(blocked.onUse).not.toHaveBeenCalled()
})
it('beachtet die vorhandene Tab-Schreibsperre', () => {
  setup(null, false, false)
  expect(screen.getAllByRole('button', { name: 'Duplizieren' }).every(b => (b as HTMLButtonElement).disabled)).toBe(true)
  expect(screen.getAllByRole('button', { name: 'Mission starten' }).every(b => (b as HTMLButtonElement).disabled)).toBe(true)
  expect(loadTemplates()).toEqual([])
})
it('zeigt beschädigten Speicher verständlich und überschreibt ihn nicht', () => {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, '{'); setup()
  expect(screen.getByRole('alert').textContent).toContain('beschädigt')
  fireEvent.click(screen.getAllByRole('button', { name: 'Duplizieren' })[0]); expect(localStorage.getItem(TEMPLATE_STORAGE_KEY)).toBe('{')
})
it('übernimmt Änderungen aus anderen Tabs über das Storage-Ereignis', () => {
  setup(); saveTemplate(duplicateTemplate(exampleTemplates[0])); fireEvent(window, new StorageEvent('storage', { key: TEMPLATE_STORAGE_KEY }))
  expect(document.querySelectorAll('.library-list li')).toHaveLength(6)
})
it('importiert Dateien strikt und setzt eine neue lokale ID', async () => {
  setup()
  const input = screen.getByLabelText('JSON-Vorlage importieren')
  fireEvent.change(input, { target: { files: [{ size: 1000, text: async () => exportTemplate(exampleTemplates[0]) }] } })
  await waitFor(() => expect(loadTemplates()).toHaveLength(1))
  expect(loadTemplates()[0].origin).toBe('imported'); expect(loadTemplates()[0].id).not.toBe(exampleTemplates[0].id)
  fireEvent.change(input, { target: { files: [{ size: 1, text: async () => '{' }] } })
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy()); expect(loadTemplates()).toHaveLength(1)
})
it('prüft die Tab-Schreibberechtigung erneut nach dem asynchronen Dateilesen', async () => {
  const props = { saveRequest: null, onUse: vi.fn(), onDismissSave: vi.fn(), sessionActive: false }
  const view = render(<MissionLibrary {...props} enabled />)
  const details = document.querySelector('.mission-library') as HTMLDetailsElement
  details.open = true; fireEvent(details, new Event('toggle'))
  let resolve!: (raw: string) => void
  const text = new Promise<string>(r => { resolve = r })
  fireEvent.change(screen.getByLabelText('JSON-Vorlage importieren'), { target: { files: [{ size: 1000, text: () => text }] } })
  view.rerender(<MissionLibrary {...props} enabled={false} />)
  resolve(exportTemplate(exampleTemplates[0])); await text
  await waitFor(() => expect(loadTemplates()).toHaveLength(0))
})
it('exportiert eine JSON-Datei ohne Fortschrittsfelder', () => {
  const create = vi.fn<(blob: Blob) => string>(() => 'blob:test'), revoke = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  setup(); fireEvent.click(screen.getAllByRole('button', { name: 'Exportieren' })[0])
  expect(create).toHaveBeenCalledWith(expect.any(Blob)); expect(click).toHaveBeenCalledOnce(); expect(create.mock.calls[0][0].type).toBe('application/json')
  expect(localStorage.getItem(TEMPLATE_STORAGE_KEY)).toBeNull()
})
it('öffnet die Bibliothek ohne Änderungen an aktiver Mission oder Gamification und lädt eine frische Mission pausiert', async () => {
  const plan = missionFromTemplate(exampleTemplates[0]); plan.steps[0].done = true
  localStorage.setItem('mission.saved-mission.v1', JSON.stringify({ form: { goal: plan.goal, timeBudgetMinutes: 30, energyLevel: 'medium', learningBlocker: null }, mission: plan, remainingSeconds: 1200, elapsedSeconds: 600 }))
  const view = render(<App />)
  await waitFor(() => expect((document.querySelector('.mission-writer-surface') as HTMLFieldSetElement).disabled).toBe(false))
  const old = localStorage.getItem('mission.saved-mission.v1'), game = localStorage.getItem('mission.gamification.v1')
  const library = document.querySelector('.mission-library') as HTMLDetailsElement
  library.open = true; fireEvent(library, new Event('toggle'))
  expect(localStorage.getItem('mission.saved-mission.v1')).toBe(old); expect(localStorage.getItem('mission.gamification.v1')).toBe(game)
  fireEvent.click(within(library).getAllByRole('button', { name: 'Mission starten' })[0])
  const state = JSON.parse(localStorage.getItem('mission.saved-mission.v1')!)
  expect(state.mission.id).not.toBe(plan.id); expect(state.mission.steps.every((s: { done: boolean }) => !s.done)).toBe(true)
  expect(state.elapsedSeconds).toBe(0); expect(state.activeSession).toBeNull(); expect(state.history).toEqual([])
  expect(localStorage.getItem('mission.gamification.v1')).toBe(game)
  expect(screen.getByRole('button', { name: /Start$/ })).toBeTruthy()
  view.unmount(); render(<App />)
  await waitFor(() => expect((document.querySelector('.mission-writer-surface') as HTMLFieldSetElement).disabled).toBe(false))
  expect(JSON.parse(localStorage.getItem('mission.saved-mission.v1')!).mission.id).toBe(state.mission.id)
  expect(screen.getByRole('button', { name: /Start$/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Start$/ }))
  const started = JSON.parse(localStorage.getItem('mission.saved-mission.v1')!).activeSession
  expect(started.missionId).toBe(state.mission.id); expect(started.id).not.toBe(plan.id); expect(started.focusSeconds).toBe(0)
})
it('erhält eine pausierte Session samt Fokuszeit und Historie beim Öffnen und Speichern', async () => {
  const plan = missionFromTemplate(exampleTemplates[0])
  const active = { id: 'session-existing', missionId: plan.id, startedAt: '2026-01-01T00:00:00.000Z', goal: plan.goal, focusSeconds: 125.5, plannedSeconds: 1800, timeMode: 'automatic', completedSteps: 0, totalSteps: plan.steps.length }
  localStorage.setItem('mission.saved-mission.v1', JSON.stringify({ form: { goal: plan.goal, timeBudgetMinutes: 30, energyLevel: 'medium', learningBlocker: null }, mission: plan, remainingSeconds: 1674.5, elapsedSeconds: 125.5, activeSession: active, history: [] }))
  render(<App />)
  await waitFor(() => expect((document.querySelector('.mission-writer-surface') as HTMLFieldSetElement).disabled).toBe(false))
  const game = localStorage.getItem('mission.gamification.v1')
  fireEvent.click(screen.getByRole('button', { name: 'Als Vorlage speichern' }))
  expect(document.activeElement).toBe(screen.getByLabelText('Name'))
  fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }))
  expect(loadTemplates()).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: 'Mission starten' }).every(b => (b as HTMLButtonElement).disabled)).toBe(true)
  const state = JSON.parse(localStorage.getItem('mission.saved-mission.v1')!)
  expect(state.activeSession).toEqual(active); expect(state.mission.id).toBe(plan.id); expect(state.elapsedSeconds).toBe(125.5)
  expect(state.remainingSeconds).toBe(1674.5); expect(state.history).toEqual([]); expect(localStorage.getItem('mission.gamification.v1')).toBe(game)
})
