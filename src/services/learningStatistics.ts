export const STATISTICS_STORAGE_KEY = 'mission.statistics.v1'
export const RETENTION_DAYS = 400
export type StatisticsGoals = { dailyMinutes: number | null; weeklyMinutes: number | null }
type Booking = { from: number; to: number; start: number }
export type LearningStatistics = {
  version: 1
  days: Record<string, number>
  goals: StatisticsGoals
  trackedSince: number
  accountedThrough: number
  completedSessions: number
  endedEarlySessions: number
  lastSessionId?: string
  pending?: Booking
}
const integer = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function localDay(time: number): string {
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function dayOffset(time: number, offset: number): number {
  const d = new Date(time)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset).getTime()
}
export function validGoals(v: unknown): v is StatisticsGoals {
  return record(v) && (v.dailyMinutes === null || (integer(v.dailyMinutes) && v.dailyMinutes >= 10 && v.dailyMinutes <= 720))
    && (v.weeklyMinutes === null || (integer(v.weeklyMinutes) && v.weeklyMinutes >= 30 && v.weeklyMinutes <= 10080))
}
export function emptyStatistics(total: number, now = Date.now()): LearningStatistics {
  return { version: 1, days: {}, goals: { dailyMinutes: null, weeklyMinutes: null }, trackedSince: now,
    accountedThrough: integer(total) ? total : 0, completedSessions: 0, endedEarlySessions: 0 }
}
export function pruneStatistics(s: LearningStatistics, now = Date.now()): LearningStatistics {
  const oldest = localDay(dayOffset(now, -(RETENTION_DAYS - 1)))
  return { ...s, days: Object.fromEntries(Object.entries(s.days).filter(([key]) => key >= oldest && key <= localDay(now))) }
}
// This journal describes an already measured delta. It never measures time or grants rewards.
export function prepareFocusBooking(s: LearningStatistics, from: number, to: number, start: number): LearningStatistics {
  if (!integer(from) || !integer(to) || to <= from || !Number.isFinite(start) || !Number.isFinite(new Date(start + to - from).getTime())) return s
  return { ...s, pending: { from, to, start } }
}
export function reconcileStatistics(s: LearningStatistics, total: number, now = Date.now()): LearningStatistics {
  const next = { ...s, days: { ...s.days } }
  const p = s.pending
  if (p) {
    const from = Math.max(p.from, s.accountedThrough)
    const to = Math.min(p.to, total)
    let cursor = p.start + from - p.from
    const end = cursor + Math.max(0, to - from)
    while (cursor < end) {
      const boundary = dayOffset(cursor, 1)
      const until = Math.min(end, boundary)
      const key = localDay(cursor)
      next.days[key] = Math.min(Number.MAX_SAFE_INTEGER, (next.days[key] ?? 0) + until - cursor)
      cursor = until
    }
  }
  delete next.pending
  next.accountedThrough = Math.max(s.accountedThrough, total)
  return pruneStatistics(next, now)
}
export function readStatistics(value: unknown, total: number, now = Date.now()): LearningStatistics {
  const fresh = emptyStatistics(total, now)
  if (!record(value) || value.version !== 1) return fresh
  const days: Record<string, number> = {}
  if (record(value.days)) for (const [key, ms] of Object.entries(value.days)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && localDay(new Date(`${key}T12:00:00`).getTime()) === key && integer(ms)) days[key] = ms
  }
  const s: LearningStatistics = { ...fresh, days,
    goals: validGoals(value.goals) ? { ...value.goals } : fresh.goals,
    trackedSince: integer(value.trackedSince) && Number.isFinite(new Date(value.trackedSince).getTime()) ? value.trackedSince : now,
    accountedThrough: integer(value.accountedThrough) ? value.accountedThrough : total,
    completedSessions: integer(value.completedSessions) ? value.completedSessions : 0,
    endedEarlySessions: integer(value.endedEarlySessions) ? value.endedEarlySessions : 0,
    ...(typeof value.lastSessionId === 'string' && value.lastSessionId.length <= 100 ? { lastSessionId: value.lastSessionId } : {}),
  }
  const p = value.pending
  if (record(p) && integer(p.from) && integer(p.to) && p.to > p.from && typeof p.start === 'number'
    && Number.isFinite(new Date(p.start).getTime()) && Number.isFinite(new Date(p.start + p.to - p.from).getTime())
    && p.to - p.from <= 10080 * 60000) s.pending = { from: p.from, to: p.to, start: p.start }
  return reconcileStatistics(s, total, now)
}
export function loadStatistics(total: number, strict = false): LearningStatistics {
  let raw: string | null
  try { raw = localStorage.getItem(STATISTICS_STORAGE_KEY) } catch (e) { if (strict) throw e; return emptyStatistics(total) }
  try { return readStatistics(raw ? JSON.parse(raw) : null, total) } catch { return emptyStatistics(total) }
}
export function countStatisticsSession(s: LearningStatistics, id: string, status: 'completed' | 'ended_early'): LearningStatistics {
  if (s.lastSessionId === id) return s
  const field = status === 'completed' ? 'completedSessions' : 'endedEarlySessions'
  return { ...s, lastSessionId: id, [field]: Math.min(Number.MAX_SAFE_INTEGER, s[field] + 1) }
}
export function statisticsOverview(s: LearningStatistics, total: number, now = Date.now()) {
  const today = localDay(now)
  const weekday = (new Date(now).getDay() + 6) % 7
  const weekStart = localDay(dayOffset(now, -weekday))
  const weekEnd = localDay(dayOffset(now, 7 - weekday))
  const sevenDays = Array.from({ length: 7 }, (_, i) => {
    const time = dayOffset(now, i - 6), key = localDay(time)
    return { key, time, focusMilliseconds: s.days[key] ?? 0 }
  })
  const weekMilliseconds = Object.entries(s.days).reduce((sum, [key, ms]) => sum + (key >= weekStart && key < weekEnd ? ms : 0), 0)
  return { todayMilliseconds: s.days[today] ?? 0, weekMilliseconds, totalMilliseconds: total,
    lastSevenMilliseconds: sevenDays.reduce((sum, d) => sum + d.focusMilliseconds, 0), sevenDays }
}
export function goalProgress(milliseconds: number, minutes: number | null) {
  if (minutes === null) return null
  const target = minutes * 60000
  return { reached: milliseconds >= target, fraction: Math.min(1, milliseconds / target), remainingMilliseconds: Math.max(0, target - milliseconds) }
}
export function formatFocusDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`
}
