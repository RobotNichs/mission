// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LearningContextFields from './LearningContextFields'
import PlanEditor from './PlanEditor'
import type { LearningContext } from '../../shared/learningContext.mjs'
import type { LearningPlan } from '../types/learningPlan'

afterEach(cleanup)
function Harness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState<LearningContext>()
  return <><LearningContextFields value={value} onChange={setValue} disabled={disabled} /><output>{JSON.stringify(value)}</output></>
}
const initial: LearningPlan = { id: 'existing', goal: 'Statistik', timeMode: 'automatic', timeBudgetMinutes: 5, energyLevel: 'low', learningBlocker: 'starting', learningContext: { materials: ['book'] },
  steps: [{ id: 'step-existing', title: 'Eine Stelle', description: 'Eine eigene Frage formulieren.', minutes: 5, kind: 'learning', done: true }] }

describe('kompakter optionaler Lernkontext', () => {
  it('ist geschlossen und verändert beim Öffnen/Schließen keine Angaben', () => {
    render(<Harness />)
    expect(screen.queryByLabelText('Lernumgebung')).toBeNull()
    fireEvent.click(screen.getByText('Mehr Kontext'))
    expect(screen.getByLabelText('Lernumgebung')).toBeTruthy()
    fireEvent.click(screen.getByText('Mehr Kontext'))
    expect(screen.queryByLabelText('Lernumgebung')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('')
  })
  it('kann mit Tastatur geöffnet und bedient werden', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.tab()
    expect(document.activeElement).toBe(screen.getByText('Mehr Kontext'))
    await user.keyboard('{Enter}')
    await user.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('Lernumgebung'))
    await user.selectOptions(screen.getByLabelText('Lernumgebung'), 'university')
    expect(screen.getByRole('status').textContent).toContain('university')
  })
  it('macht Keine Materialien exklusiv und löscht nicht mehr passende Freitexte', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Mehr Kontext'))
    fireEvent.click(screen.getByLabelText('Vorlesungsfolien'))
    fireEvent.click(screen.getByLabelText('Sonstige Materialien'))
    fireEvent.change(screen.getByLabelText('Sonstige Materialien beschreiben'), { target: { value: 'Karten' } })
    fireEvent.click(screen.getByLabelText('Keine Materialien'))
    expect((screen.getByLabelText('Vorlesungsfolien') as HTMLInputElement).checked).toBe(false)
    expect(screen.queryByLabelText('Sonstige Materialien beschreiben')).toBeNull()
    expect(JSON.parse(screen.getByRole('status').textContent!)).toEqual({ materials: ['none'] })
    fireEvent.click(screen.getByLabelText('Buch'))
    expect((screen.getByLabelText('Keine Materialien') as HTMLInputElement).checked).toBe(false)
    expect(JSON.parse(screen.getByRole('status').textContent!)).toEqual({ materials: ['book'] })
  })
  it('trennt Keine Angabe von ausdrücklich fehlenden Materialien und begrenzt Freitext', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Mehr Kontext'))
    fireEvent.click(screen.getByLabelText('Sonstige Materialien'))
    expect((screen.getByLabelText('Sonstige Materialien beschreiben') as HTMLInputElement).maxLength).toBe(240)
    fireEvent.change(screen.getByLabelText('Sonstige Materialien beschreiben'), { target: { value: '<script>bad</script>' } })
    expect(screen.getByRole('alert').textContent).toContain('ohne HTML')
    fireEvent.click(screen.getByLabelText('Sonstige Materialien'))
    expect(JSON.parse(screen.getByRole('status').textContent!)).toEqual({ materials: [] })
  })
  it('sperrt Kontextfelder bei laufender Anfrage', () => {
    render(<Harness disabled />)
    fireEvent.click(screen.getByText('Mehr Kontext'))
    expect((screen.getByLabelText('Lernzweck') as HTMLSelectElement).closest('fieldset')!.disabled).toBe(true)
  })
  it('speichert geänderten Kontext im Editor ohne IDs, Häkchen oder Zeiten zu verändern', () => {
    const onSave = vi.fn()
    render(<PlanEditor initial={initial} disabled={false} onSave={onSave} onCancel={() => {}} />)
    fireEvent.click(screen.getByText('Mehr Kontext'))
    fireEvent.change(screen.getByLabelText('Lernzweck'), { target: { value: 'revision' } })
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }))
    expect(onSave).toHaveBeenCalledWith({ ...initial, learningContext: { materials: ['book'], purpose: 'revision' } })
    expect(initial.learningContext).toEqual({ materials: ['book'] })
  })
  it('verwirft Kontextänderungen beim Abbrechen', () => {
    const onSave = vi.fn(), onCancel = vi.fn()
    render(<PlanEditor initial={initial} disabled={false} onSave={onSave} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Mehr Kontext'))
    fireEvent.click(screen.getByLabelText('Keine Materialien'))
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onCancel).toHaveBeenCalledOnce(); expect(onSave).not.toHaveBeenCalled()
    expect(initial.learningContext).toEqual({ materials: ['book'] })
  })
})
