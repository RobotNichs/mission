import { describe, expect, it } from 'vitest'
import { finishLearningSession, normalizeActiveSession, normalizeHistory, type ActiveLearningSession } from './learningHistory'

const active: ActiveLearningSession = { id: 'session-1', missionId: 'mission-1', startedAt: '2026-10-03T10:00:00.000Z', goal: 'Statistik', focusSeconds: 75.5, plannedSeconds: 1500, timeMode: 'manual', completedSteps: 1, totalSteps: 3 }
const endedAt = '2026-10-03T11:00:00.000Z'
describe('lokale Historie ohne Vergütungslogik', () => {
  it.each(['completed', 'ended_early'] as const)('speichert %s mit tatsächlichen Sekunden', status => {
    expect(finishLearningSession([], active, status, endedAt)[0]).toMatchObject({ focusSeconds: 75.5, plannedSeconds: 1500, status, completedSteps: 1, totalSteps: 3 })
  })
  it('speichert keine Session ohne Fokuszeit', () => {
    expect(finishLearningSession([], { ...active, focusSeconds: 0 }, 'ended_early', endedAt)).toEqual([])
    expect(finishLearningSession([], null, 'completed', endedAt)).toEqual([])
  })
  it('begrenzt und sortiert nach Abschlusszeit', () => {
    const entries = Array.from({ length: 8 }, (_, i) => ({ ...active, id: `s-${i}`, status: 'completed', endedAt: `2026-10-03T11:0${i}:00.000Z` }))
    expect(normalizeHistory(entries.reverse()).map(e => e.id)).toEqual(['s-7', 's-6', 's-5', 's-4', 's-3'])
  })
  it('verhindert doppelte IDs bei wiederholtem Beenden und Laden', () => {
    const history = finishLearningSession([], active, 'completed', endedAt)
    expect(finishLearningSession(history, active, 'ended_early', endedAt)).toBe(history)
    expect(normalizeHistory([...history, ...history])).toHaveLength(1)
    expect(normalizeActiveSession(active, history)).toBeNull()
  })
  it.each([null, {}, 'bad', [null], [{ ...active, status: 'completed', endedAt: 'bad' }], [{ ...active, status: 'bad', endedAt }], [{ ...active, focusSeconds: -1, status: 'completed', endedAt }], [{ ...active, focusSeconds: Infinity, status: 'completed', endedAt }], [{ ...active, completedSteps: 4, status: 'completed', endedAt }], [{ ...active, status: 'completed', endedAt: '2020-01-01' }]])('verwirft ungültige Historie %j', value => {
    expect(normalizeHistory(value)).toEqual([])
  })
  it('erhält gültige Nachbareinträge und verwirft unbekannte gespeicherte Felder', () => {
    const valid = { ...active, status: 'completed', endedAt, untrusted: 'ignore' }
    const result = normalizeHistory([null, valid, {}])
    expect(result).toHaveLength(1)
    expect(result[0]).not.toHaveProperty('untrusted')
  })
  it('validiert fortsetzbare Sessions ohne Fokuszeit und Stoppuhr', () => {
    expect(normalizeActiveSession({ ...active, focusSeconds: 0 }, [])).toMatchObject({ focusSeconds: 0 })
    expect(normalizeActiveSession({ ...active, timeMode: 'stopwatch', plannedSeconds: null }, [])).toMatchObject({ plannedSeconds: null })
    expect(normalizeActiveSession({ ...active, missionId: 123 }, [])).toBeNull()
  })
})
