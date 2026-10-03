import { describe, expect, it } from 'vitest'
import { acquireMissionWriter, advanceFocusSession } from './focusTimer'
import { createTestLocks } from './testLocks'

describe('Fokusabrechnung', () => {
  it('rechnet denselben Zeitpunkt niemals zweimal ab', () => {
    const first = advanceFocusSession({ lastTime: 0, remainingMilliseconds: 60_000 }, 59_999)
    expect(first.elapsedMilliseconds).toBe(59_999)
    expect(advanceFocusSession(first.session, 59_999).elapsedMilliseconds).toBe(0)
    expect(advanceFocusSession(first.session, 60_000).elapsedMilliseconds).toBe(1)
  })

  it('begrenzt verzögerte Ticks auf die verbleibende Countdownzeit', () => {
    const result = advanceFocusSession({ lastTime: 100, remainingMilliseconds: 250 }, 100_000)
    expect(result.elapsedMilliseconds).toBe(250)
    expect(result.session.remainingMilliseconds).toBe(0)
    expect(advanceFocusSession(result.session, 200_000).elapsedMilliseconds).toBe(0)
  })

  it('vergütet keine rückwärts laufende oder ungültige Uhr und erhält Submillisekunden', () => {
    const session = { lastTime: 10, remainingMilliseconds: 100 }
    expect(advanceFocusSession(session, 5).elapsedMilliseconds).toBe(0)
    expect(advanceFocusSession(session, NaN).elapsedMilliseconds).toBe(0)
    const first = advanceFocusSession(session, 10.8)
    expect(first.elapsedMilliseconds).toBe(0)
    expect(advanceFocusSession(first.session, 11.2).elapsedMilliseconds).toBe(1)
  })

  it('gibt nur einem Tab Schreibrecht und überträgt es nach Freigabe', () => {
    const locks = createTestLocks()
    const owners: number[] = []
    const releaseFirst = acquireMissionWriter(locks, () => owners.push(1), () => {})
    const releaseSecond = acquireMissionWriter(locks, () => owners.push(2), () => {})
    expect(owners).toEqual([1])
    releaseFirst()
    expect(owners).toEqual([1, 2])
    releaseFirst()
    releaseSecond()
  })

  it('erteilt einem bereits geschlossenen wartenden Tab kein Schreibrecht', () => {
    const locks = createTestLocks()
    const owners: number[] = []
    const releaseFirst = acquireMissionWriter(locks, () => owners.push(1), () => {})
    const releaseSecond = acquireMissionWriter(locks, () => owners.push(2), () => {})
    releaseSecond()
    releaseFirst()
    expect(owners).toEqual([1])
  })
})
