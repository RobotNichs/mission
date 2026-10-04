// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { measureOrb, orbFlipTransform } from './focusTransition'
it('überspringt fehlende, nicht messbare oder ungültige Orb-Positionen', () => {
  expect(measureOrb(null, 'default')).toBeNull()
  const element = document.createElement('div')
  expect(measureOrb(element, 'default')).toBeNull()
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left: NaN, top: 0, width: 76, height: 76 } as DOMRect)
  expect(measureOrb(element, 'default')).toBeNull()
  expect(orbFlipTransform({ left: 0, top: 0, width: 76, height: 76, orbId: 'default' }, { width: 0, height: 0, left: 0, top: 0 } as DOMRect)).toBeNull()
})
