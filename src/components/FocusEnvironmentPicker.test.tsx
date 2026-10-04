// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import FocusEnvironmentPicker from './FocusEnvironmentPicker'
afterEach(cleanup)
it('öffnet ein kompaktes Panel mit Fokusführung und schließt über Escape zum Auslöser', async () => {
  const change = vi.fn()
  render(<FocusEnvironmentPicker value="still" onChange={change} />)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByText(/Bewegung nur/)).toBeNull()
  const button = screen.getByRole('button', { name: 'Umgebung ändern' })
  fireEvent.click(button)
  const select = screen.getByLabelText('Fokus-Umgebung')
  expect(document.activeElement).toBe(select)
  expect(button.getAttribute('aria-expanded')).toBe('true')
  const user = userEvent.setup()
  await user.tab({ shift: true })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Schließen' }))
  await user.tab()
  expect(document.activeElement).toBe(select)
  fireEvent.change(select, { target: { value: 'liquid' } })
  expect(change).toHaveBeenCalledWith('liquid')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(button)
})
it('schließt mit Schließen-Button und Hintergrundinteraktion', () => {
  render(<FocusEnvironmentPicker value="nebula" onChange={vi.fn()} />)
  const trigger = screen.getByRole('button', { name: 'Umgebung ändern' })
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(trigger)
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('dialog')).toBeNull()
})
