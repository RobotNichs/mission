// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { createTestLocks } from './services/testLocks'
import { MOBILE_QUERY } from './services/useMobileLayout'
function viewport(width: number) { vi.stubGlobal('matchMedia', vi.fn((q: string) => ({ matches: q === MOBILE_QUERY && width <= 768, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }))) }
beforeEach(() => { localStorage.clear(); Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() }); localStorage.setItem('mission.onboarding.v1', '{"version":1,"status":"skipped"}') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
it.each([375, 430, 768, 1024, 1440])('uses one area model and appropriate navigation at %s px', width => {
  viewport(width); render(<App />)
  const nav = screen.getByRole('navigation', { name: width <= 768 ? 'Mobile Hauptnavigation' : 'Desktop Hauptnavigation' })
  expect(screen.queryByRole('navigation', { name: width <= 768 ? 'Desktop Hauptnavigation' : 'Mobile Hauptnavigation' })).toBeNull()
  const before = { ...localStorage }
  for (const name of ['Plan', 'Projekte', 'Bibliothek', 'Fortschritt', 'Home']) {
    fireEvent.click(within(nav).getByRole('button', { name }))
    expect(within(nav).getByRole('button', { name }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('heading', { level: 1, name })).toBe(document.activeElement)
  }
  expect({ ...localStorage }).toEqual(before)
})
it('keeps plan and project drafts mounted across navigation without touching the timer', () => {
  viewport(1024); render(<App />); const nav = within(screen.getByRole('navigation', { name: 'Desktop Hauptnavigation' }))
  fireEvent.click(nav.getByRole('button', { name: 'Plan' })); fireEvent.change(screen.getByLabelText('Was möchtest du lernen?'), { target: { value: 'SQL JOINs' } })
  fireEvent.click(nav.getByRole('button', { name: 'Projekte' })); fireEvent.click(screen.getByRole('button', { name: 'Langzeitprojekt erstellen' })); fireEvent.change(screen.getByLabelText('Projekttitel'), { target: { value: 'Mein Projekt' } })
  const before = { ...localStorage }
  fireEvent.click(nav.getByRole('button', { name: 'Home' })); expect(screen.getByRole('heading', { name: 'Mission Core' })).toBeTruthy()
  fireEvent.click(nav.getByRole('button', { name: 'Plan' })); expect((screen.getByLabelText('Was möchtest du lernen?') as HTMLTextAreaElement).value).toBe('SQL JOINs')
  fireEvent.click(nav.getByRole('button', { name: 'Projekte' })); expect((screen.getByLabelText('Projekttitel') as HTMLInputElement).value).toBe('Mein Projekt')
  expect({ ...localStorage }).toEqual(before)
})
it('keeps info, feedback and tutorial reachable from the sidebar', () => {
  viewport(1440); render(<App />)
  expect(screen.getByRole('link', { name: 'Feedback' }).getAttribute('href')).toBe('https://github.com/RobotNichs/mission/issues/new')
  expect(screen.getByRole('button', { name: 'Mission-Tour starten' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Info, Datenschutz und Daten' })); expect(screen.getByRole('dialog', { name: 'Mission · Info & Daten' })).toBeTruthy()
})
it('shows AI loading and blocks duplicate requests until the existing fallback settles', async () => {
  viewport(1024); let reject!: (e: Error) => void
  const fetch = vi.fn(() => new Promise<Response>((_, r) => { reject = r })); vi.stubGlobal('fetch', fetch)
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Plan' })); fireEvent.change(screen.getByLabelText('Was möchtest du lernen?'), { target: { value: 'SQL JOINs' } })
  fireEvent.click(screen.getByRole('button', { name: 'Mission planen' }))
  expect(screen.getByText('Mission wird vorbereitet …')).toBeTruthy()
  const button = screen.getByRole('button', { name: /Plan wird erstellt/ }) as HTMLButtonElement
  expect(button.disabled).toBe(true); fireEvent.click(button); expect(fetch).toHaveBeenCalledOnce()
  await act(async () => reject(new TypeError('offline')))
  expect(screen.queryByText('Mission wird vorbereitet …')).toBeNull(); expect(screen.getByRole('button', { name: 'Mission aktualisieren' })).toBeTruthy()
})
