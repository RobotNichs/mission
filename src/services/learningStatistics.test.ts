import { describe, expect, it } from 'vitest'
import { emptyStatistics, prepareFocusBooking, reconcileStatistics, readStatistics, statisticsOverview, goalProgress, validGoals, localDay, countStatisticsSession, pruneStatistics, formatFocusDuration } from './learningStatistics'
const date = (day: number, hour = 12, minute = 0) => new Date(2026, 9, day, hour, minute).getTime()
const book = (start: number, ms: number) => reconcileStatistics(prepareFocusBooking(emptyStatistics(0, start), 0, ms, start), ms, start + ms)
describe('local statistics', () => {
  it('counts only the measured delta, not an existing lifetime total', () => {
    const s = emptyStatistics(9000000, date(6))
    expect(statisticsOverview(s, 9000000, date(6))).toMatchObject({ todayMilliseconds: 0, totalMilliseconds: 9000000 })
  })
  it('splits midnight precisely', () => {
    expect(book(date(6, 23, 50), 1200000).days).toEqual({ '2026-10-06': 600000, '2026-10-07': 600000 })
  })
  it('splits Sunday into Monday and the new week', () => {
    const s = book(date(4, 23, 50), 1200000)
    expect(statisticsOverview(s, 1200000, date(5)).weekMilliseconds).toBe(600000)
    expect(statisticsOverview(s, 1200000, date(4)).weekMilliseconds).toBe(600000)
  })
  it('uses Monday–Sunday rather than a sliding week', () => {
    const s = { ...emptyStatistics(0, date(6)), days: { '2026-10-04': 100, '2026-10-05': 200, '2026-10-06': 300 } }
    const v = statisticsOverview(s, 600, date(6))
    expect(v.weekMilliseconds).toBe(500); expect(v.lastSevenMilliseconds).toBe(600)
    expect(v.sevenDays).toHaveLength(7); expect(v.sevenDays[0].focusMilliseconds).toBe(0)
  })
  it.each([0, 1, 59999, 60000, 90000])('preserves exact milliseconds %s across reload', ms => {
    const s = book(date(6), ms)
    expect(readStatistics(JSON.parse(JSON.stringify(s)), ms, date(6))).toEqual(s)
  })
  it('recovers a committed reward with an unfinished statistics journal exactly once', () => {
    const pending = prepareFocusBooking(emptyStatistics(0, date(6)), 0, 60000, date(6))
    const recovered = readStatistics(pending, 60000, date(6))
    expect(recovered.days['2026-10-06']).toBe(60000)
    expect(readStatistics(recovered, 60000, date(6))).toEqual(recovered)
    expect(reconcileStatistics({ ...recovered, pending: pending.pending }, 60000, date(6))).toEqual(recovered)
  })
  it('does not allocate a journal when the game write failed', () => {
    const p = prepareFocusBooking(emptyStatistics(0, date(6)), 0, 60000, date(6))
    expect(readStatistics(p, 0, date(6)).days).toEqual({})
  })
  it('does not invent offline or unjournaled time', () => {
    expect(reconcileStatistics(emptyStatistics(0, date(6)), 60000, date(7)).days).toEqual({})
  })
  it('combines focus fragments and blocks without counting intervening breaks', () => {
    let s = book(date(6), 30000)
    s = reconcileStatistics(prepareFocusBooking(s, 30000, 60000, date(6, 13)), 60000, date(6, 14))
    expect(s.days['2026-10-06']).toBe(60000)
  })
  it.each([null, {}, [], { version: 9 }, { version: 1, days: { bad: 3, '2026-02-30': 4, '2026-10-06': -1 } }])('safely loads damaged or absent data %j', value => {
    expect(readStatistics(value, 60000, date(6)).days).toEqual({})
  })
  it('retains 400 local calendar days and bounded counters', () => {
    const now = date(6), old = new Date(2025, 0, 1).getTime()
    expect(pruneStatistics({ ...emptyStatistics(0, old), days: { [localDay(old)]: 100, [localDay(now)]: 200 } }, now).days).toEqual({ [localDay(now)]: 200 })
  })
  it('counts each completed session once without reward changes', () => {
    const s = countStatisticsSession(emptyStatistics(1000, date(6)), 'one', 'completed')
    expect(countStatisticsSession(s, 'one', 'completed')).toEqual(s)
    expect(s.completedSessions).toBe(1); expect(s.accountedThrough).toBe(1000); expect(s.days).toEqual({})
    expect(countStatisticsSession(s, 'two', 'ended_early').endedEarlySessions).toBe(1)
  })
  it.each([['dailyMinutes', 9], ['dailyMinutes', 721], ['dailyMinutes', 20.5], ['weeklyMinutes', 29], ['weeklyMinutes', 10081]])('rejects invalid goal %s %s', (field, value) => {
    expect(validGoals({ dailyMinutes: null, weeklyMinutes: null, [field]: value })).toBe(false)
  })
  it.each([10, 30, 60, 90, 720])('accepts daily goal %s', dailyMinutes => expect(validGoals({ dailyMinutes, weeklyMinutes: 10080 })).toBe(true))
  it('supports disabled, reached and exceeded goals with capped progress', () => {
    expect(goalProgress(60000, null)).toBeNull()
    expect(goalProgress(30000, 1)).toEqual({ reached: false, fraction: .5, remainingMilliseconds: 30000 })
    expect(goalProgress(60000, 1)?.reached).toBe(true)
    expect(goalProgress(120000, 1)).toEqual({ reached: true, fraction: 1, remainingMilliseconds: 0 })
    expect(goalProgress(180000000, 300)?.reached).toBe(true)
  })
  it('changing goals leaves history and aggregated focus untouched', () => {
    const s = book(date(6), 60000), before = JSON.stringify(s.days)
    statisticsOverview({ ...s, goals: { dailyMinutes: 30, weeklyMinutes: 180 } }, 60000, date(6))
    expect(JSON.stringify(s.days)).toBe(before)
  })
  it('formats total focus without rounding it up', () => expect(formatFocusDuration(45399999)).toBe('12 h 36 min'))
})
