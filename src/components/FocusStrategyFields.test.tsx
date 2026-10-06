// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import PlanEditor from './PlanEditor'
import { exampleTemplates, missionFromTemplate } from '../services/missionTemplates'
afterEach(cleanup)
it('speichert 180 Minuten und benutzerdefinierte Intervalle mit bestehenden Schritt-IDs', () => {
  const initial = { ...missionFromTemplate(exampleTemplates[0]), timeMode: 'manual' as const, timeBudgetMinutes: 180 }
  const save = vi.fn()
  render(<PlanEditor initial={initial} disabled={false} onSave={save} onCancel={() => {}} />)
  fireEvent.change(screen.getByLabelText('Fokusstrategie'), { target: { value: 'custom' } })
  fireEvent.change(screen.getByLabelText('Fokusblock in Minuten'), { target: { value: '60' } })
  fireEvent.change(screen.getByLabelText('Pause in Minuten'), { target: { value: '10' } })
  expect(screen.getByText(/180 Min Fokus · 3 Fokusblöcke · 2 Pausen/).textContent).toContain('200 Min')
  fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }))
  expect(save).toHaveBeenCalledWith({ ...initial, focusStrategy: { mode: 'custom', focusMinutes: 60, breakMinutes: 10 } })
})
it('blockiert ungültige Intervalle und zeigt sie verständlich an', () => {
  const save = vi.fn()
  render(<PlanEditor initial={missionFromTemplate(exampleTemplates[0])} disabled={false} onSave={save} onCancel={() => {}} />)
  fireEvent.change(screen.getByLabelText('Fokusstrategie'), { target: { value: 'custom' } })
  fireEvent.change(screen.getByLabelText('Fokusblock in Minuten'), { target: { value: '0' } })
  fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }))
  expect(save).not.toHaveBeenCalled(); expect(screen.getByRole('alert').textContent).toContain('10 bis 120')
})
it('bietet im Stoppuhrmodus keine Intervallsteuerung an', () => {
  render(<PlanEditor initial={{ ...missionFromTemplate(exampleTemplates[0]), timeMode: 'stopwatch' }} disabled={false} onSave={() => {}} onCancel={() => {}} />)
  expect(screen.queryByLabelText('Fokusstrategie')).toBeNull()
})
