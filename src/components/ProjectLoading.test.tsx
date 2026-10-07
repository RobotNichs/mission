// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ProjectSessionForm from './ProjectSessionForm'
import LongTermProjects from './LongTermProjects'
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear() })
it('shows a project mission status, prevents repeated submission and preserves the form after failure', async () => {
  let reject!: (e: Error) => void
  const onCreate = vi.fn(() => new Promise<boolean>((_, r) => { reject = r }))
  render(<ProjectSessionForm enabled onCreate={onCreate} onCancel={() => {}} />)
  fireEvent.submit(screen.getByRole('form', { name: 'Tagesmission planen' }))
  expect(screen.getByText('Heutige Mission wird vorbereitet …')).toBeTruthy()
  expect((screen.getByRole('button', { name: /Tagesmission wird erstellt/ }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.submit(screen.getByRole('form', { name: 'Tagesmission planen' })); expect(onCreate).toHaveBeenCalledOnce()
  await act(async () => reject(new Error('Testfehler')))
  expect(screen.queryByText('Heutige Mission wird vorbereitet …')).toBeNull(); expect(screen.getByRole('alert').textContent).toBe('Testfehler')
})
it('shows roadmap preparation and returns to the editable UI after the local fallback', async () => {
  let reject!: (e: Error) => void
  const fetch = vi.fn(() => new Promise<Response>((_, r) => { reject = r })); vi.stubGlobal('fetch', fetch)
  render(<LongTermProjects enabled />)
  fireEvent.click(screen.getByRole('button', { name: 'Langzeitprojekt erstellen' }))
  fireEvent.change(screen.getByLabelText('Projekttitel'), { target: { value: 'SQL Projekt' } })
  fireEvent.change(screen.getByLabelText('Dein langfristiges Ziel'), { target: { value: 'SQL JOINs lernen' } })
  fireEvent.click(screen.getByRole('button', { name: 'Weiter' })); fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
  fireEvent.click(screen.getByRole('button', { name: 'Roadmap erstellen und speichern' }))
  expect(screen.getByRole('status').textContent).toBe('Roadmap wird erstellt …')
  expect((screen.getByRole('button', { name: /Roadmap wird erstellt/ }) as HTMLButtonElement).disabled).toBe(true)
  await act(async () => reject(new TypeError('offline')))
  expect(screen.queryByText('Roadmap wird erstellt …')).toBeNull(); expect(screen.getByRole('heading', { name: 'SQL Projekt' })).toBeTruthy()
})
