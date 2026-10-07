// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import LoadingStatus from './LoadingStatus'
afterEach(() => { cleanup(); vi.useRealTimers() })
it.each(['Mission wird vorbereitet …', 'Roadmap wird erstellt …', 'Heutige Mission wird vorbereitet …', 'Fortschritt wird ausgewertet …'])('announces %s without fake progress', text => {
  render(<LoadingStatus text={text} />)
  expect(screen.getByRole('status').textContent).toBe(text)
  expect(screen.queryByText(/\d+\s*%/)).toBeNull()
})
it('delays the slower-request notice and cancels its timer on unmount', () => {
  vi.useFakeTimers(); const ui = render(<LoadingStatus text="Mission wird vorbereitet …" />)
  act(() => vi.advanceTimersByTime(2999)); expect(screen.queryByText(/länger als gewöhnlich/)).toBeNull()
  act(() => vi.advanceTimersByTime(1)); expect(screen.getByText(/länger als gewöhnlich/)).toBeTruthy()
  ui.unmount(); expect(vi.getTimerCount()).toBe(0)
})
