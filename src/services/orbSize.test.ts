import { expect, it } from 'vitest'
import { getOrbSize } from './orbSize'

it('wächst anfangs stärker, später langsamer und bleibt begrenzt', () => {
  expect(getOrbSize(1)).toBe(76)
  expect(getOrbSize(2)).toBeGreaterThan(76)
  expect(getOrbSize(2) - getOrbSize(1)).toBeGreaterThan(getOrbSize(20) - getOrbSize(19))
  expect(getOrbSize(1000)).toBe(122)
  expect(getOrbSize(1000, 'focus')).toBe(420)
  for (let level = 1; level < 100; level++) expect(getOrbSize(level + 1)).toBeGreaterThanOrEqual(getOrbSize(level))
})
it('begrenzt Größen auf kleine verfügbare Flächen und behandelt ungültige Level', () => {
  expect(getOrbSize(1000, 'focus', 240)).toBe(240)
  expect(getOrbSize(1000, 'dashboard', 80)).toBe(80)
  for (const level of [NaN, Infinity, -5, 0]) expect(getOrbSize(level)).toBe(76)
})
