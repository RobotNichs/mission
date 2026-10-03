// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LearningPlan } from '../types/learningPlan'
import PlanEditor from './PlanEditor'

const initial: LearningPlan = { id: 'mission', goal: 'Statistik', timeMode: 'automatic', timeBudgetMinutes: 15,
  energyLevel: 'medium', learningBlocker: null, steps: [
    { id: 'one', title: 'Beispiel öffnen', description: 'Statistik-Unterlagen öffnen.', minutes: 5, kind: 'learning', done: true },
    { id: 'two', title: 'Mittelwert üben', description: 'Den ersten Rechenschritt versuchen.', minutes: 10, kind: 'practice', done: false },
  ] }
afterEach(cleanup)
function setup() {
  const onSave = vi.fn(), onCancel = vi.fn()
  render(<PlanEditor initial={initial} onSave={onSave} onCancel={onCancel} disabled={false} />)
  return { onSave, onCancel }
}
describe('kompakter Lernplaneditor', () => {
  it('öffnet jeweils nur einen Schritt und schließt ihn wieder', () => {
    setup()
    const first = screen.getByRole('button', { name: /Schritt 1 bearbeiten:/ })
    const second = screen.getByRole('button', { name: /Schritt 2 bearbeiten:/ })
    expect(screen.queryByLabelText('Titel')).toBeNull()
    fireEvent.click(first)
    expect(first.getAttribute('aria-expanded')).toBe('true')
    expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe('Beispiel öffnen')
    fireEvent.click(second)
    expect(first.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getAllByLabelText('Titel')).toHaveLength(1)
    fireEvent.click(second)
    expect(screen.queryByLabelText('Titel')).toBeNull()
  })
  it('speichert Änderungen an eingeklappten Schritten mit bestehenden IDs und Häkchen', () => {
    const { onSave } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Schritt 1 bearbeiten:/ }))
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Unterlagen ansehen' } })
    fireEvent.change(screen.getByLabelText('Minuten'), { target: { value: '8' } })
    expect(screen.getByText('Bearbeitet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Schritt 2 bearbeiten:/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }))
    expect(onSave).toHaveBeenCalledWith({ ...initial, timeBudgetMinutes: 18, steps: [
      { ...initial.steps[0], title: 'Unterlagen ansehen', minutes: 8 }, initial.steps[1],
    ] })
    expect(initial.steps[0].title).toBe('Beispiel öffnen')
  })
  it('verwirft Entwurfsänderungen beim Abbrechen', () => {
    const { onSave, onCancel } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Schritt 2 nach oben' }))
    fireEvent.click(screen.getByRole('button', { name: 'Schritt 1 löschen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledOnce()
    expect(initial.steps.map(s => s.id)).toEqual(['one', 'two'])
  })
  it('prüft auch ungültige Felder in eingeklappten Schritten', () => {
    const { onSave } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Schritt 1 bearbeiten:/ }))
    fireEvent.change(screen.getByLabelText('Minuten'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /Schritt 2 bearbeiten:/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toMatch(/ganze Minuten/)
  })
  it('bedient das Aufklappen mit Enter, Tab und Leertaste', async () => {
    setup()
    const user = userEvent.setup()
    const toggle = screen.getByRole('button', { name: /Schritt 1 bearbeiten:/ })
    toggle.focus()
    await user.keyboard('{Enter}')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await user.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('Titel'))
    toggle.focus()
    await user.keyboard(' ')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })
})
