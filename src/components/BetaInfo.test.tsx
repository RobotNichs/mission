// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import BetaInfo from './BetaInfo'
import { exportBackup } from '../services/localBackup'
import { initialGamificationState } from '../types/gamification'
afterEach(cleanup)
beforeEach(() => localStorage.clear())
it('shows beta, privacy and neutral feedback without learning contents', () => {
  render(<BetaInfo enabled onClose={() => {}} />)
  expect(screen.getByText(/Beta · Funktionen/)).toBeTruthy()
  expect(screen.getByText('Datenschutz & lokale Daten')).toBeTruthy()
  const link = screen.getByRole('link', { name: 'Feedback geben' })
  expect(link.getAttribute('href')).toBe('mailto:vorname%40nachname%40gmail.com?subject=Mission%20Beta%20Feedback')
})
it('requires explicit delete confirmation, preserves foreign storage and reloads only after confirmation', () => {
  const reload = vi.fn(); localStorage.setItem('mission.focus-environment.v1', 'liquid'); localStorage.setItem('foreign', 'keep')
  render(<BetaInfo enabled onClose={() => {}} reload={reload} />)
  fireEvent.click(screen.getByRole('button', { name: 'Lokale Daten löschen' })); expect(reload).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Löschen bestätigen' }))
  expect(reload).toHaveBeenCalledOnce(); expect(localStorage.getItem('foreign')).toBe('keep'); expect(localStorage.getItem('mission.focus-environment.v1')).toBeNull()
})
it('disables data actions without writer ownership or with a running timer', () => {
  render(<BetaInfo enabled={false} onClose={() => {}} />)
  expect((screen.getByRole('button', { name: 'Backup herunterladen' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Lokale Daten löschen' }) as HTMLButtonElement).disabled).toBe(true)
})
it('closes via Escape and returns focus to opener', () => {
  const close = vi.fn(); const opener = document.createElement('button'); document.body.append(opener); opener.focus()
  const view = render(<BetaInfo enabled onClose={close} />)
  expect(screen.getByRole('button', { name: 'Schließen' })).toBe(document.activeElement)
  fireEvent.keyDown(document, { key: 'Escape' }); expect(close).toHaveBeenCalledOnce()
  view.unmount(); expect(document.activeElement).toBe(opener); opener.remove()
})
it('validates a file before offering replace and changes no progress until explicit confirmation', async () => {
  localStorage.setItem('mission.gamification.v1', JSON.stringify({ ...initialGamificationState, coins: 17, totalFocusMilliseconds: 120000 }))
  const raw = exportBackup(); const file = new File([raw], 'backup.json', { type: 'application/json' }); Object.defineProperty(file, 'text', { value: async () => raw })
  const reload = vi.fn(); render(<BetaInfo enabled onClose={() => {}} reload={reload} />)
  fireEvent.change(screen.getByLabelText(/Backup importieren/), { target: { files: [file] } })
  await screen.findByRole('button', { name: 'Ersetzen bestätigen' })
  expect(reload).not.toHaveBeenCalled(); expect(JSON.parse(localStorage.getItem('mission.gamification.v1')!).coins).toBe(17)
  fireEvent.click(screen.getByRole('button', { name: 'Ersetzen bestätigen' }))
  expect(reload).toHaveBeenCalledOnce(); expect(JSON.parse(localStorage.getItem('mission.gamification.v1')!).totalFocusMilliseconds).toBe(120000)
})
it('rejects damaged imports without a replace action or reload', async () => {
  const file = new File(['bad'], 'bad.json'); Object.defineProperty(file, 'text', { value: async () => 'bad' })
  const reload = vi.fn(); render(<BetaInfo enabled onClose={() => {}} reload={reload} />)
  fireEvent.change(screen.getByLabelText(/Backup importieren/), { target: { files: [file] } })
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Ungültiges Backup'))
  expect(screen.queryByRole('button', { name: 'Ersetzen bestätigen' })).toBeNull(); expect(reload).not.toHaveBeenCalled()
})
