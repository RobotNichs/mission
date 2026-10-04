// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import GamificationPanel from './GamificationPanel'
import { initialGamificationState } from '../types/gamification'
import { getLevel } from '../services/gamification'
import { getOrbSize } from '../services/orbSize'
import { formatFocusTime } from '../services/formatFocusTime'
afterEach(cleanup)
it('zeigt echte Fokuszeit, Level, Coins und Prestige mit ausgerüstetem Prestige-Orb', () => {
  const state = { ...initialGamificationState, coins: 81, totalFocusMilliseconds: (75 * 60 + 35) * 60000,
    equippedOrbId: 'orb-prestige-orbit' }
  const before = JSON.stringify(state)
  render(<GamificationPanel state={state} rewardNotice={null} />)
  const level = getLevel(state.totalFocusMilliseconds / 60000)
  expect(screen.getByRole('heading', { name: `Level ${level}` })).toBeTruthy()
  expect(screen.getByText('75 h 35 min')).toBeTruthy()
  expect(screen.getByText('Prestige II')).toBeTruthy()
  expect(screen.getByLabelText('81 Coins').querySelector('.icon-coin')).toBeTruthy()
  const core = screen.getByRole('img', { name: `Mission Core, Level ${level}` })
  expect(core.querySelector('.core-orb-art')?.getAttribute('data-orb-id')).toBe('orb-prestige-orbit')
  expect((core as HTMLElement).style.width).toBe(`min(${getOrbSize(level) * 1.8}px, 220px, 100%)`)
  expect(screen.getByRole('progressbar', { name: 'Fortschritt zum nächsten Level' })).toBeTruthy()
  expect(JSON.stringify(state)).toBe(before)
})
it.each([
  [0, '0 h 0 min'], [12 * 3600000 + 35 * 60000 + 59999, '12 h 35 min'],
  [60_000, '0 h 1 min'], [NaN, '0 h 0 min'], [-5, '0 h 0 min'],
])('formatiert echte Fokuszeit %s ohne unvollständige Minuten aufzurunden', (value, result) => {
  expect(formatFocusTime(value as number)).toBe(result)
})
