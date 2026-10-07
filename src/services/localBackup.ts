import { PROJECT_STORAGE_KEY, readProjectStore } from '../../shared/longTermProjectSchema.mjs'
import { initialGamificationState } from '../types/gamification'
import { loadTemplates } from './missionTemplates'
import { normalizeHistory, normalizeActiveSession } from './learningHistory'
import { validFocusStrategy, restoreFocusBlocks } from './focusBlocks'
import { validateLearningContext } from '../../shared/learningContext.mjs'
import { validGoals, localDay } from './learningStatistics'
import { learningBlockerOptions } from '../types/learningPlan'
import { orbCollection } from './orbCatalog'
import { cosmeticShopItems } from './gamification'
import { canEquipOrb } from './prestigeOrbs'
import type { GamificationState } from '../types/gamification'

export const BACKUP_KEYS = ['mission.saved-mission.v1', 'mission.gamification.v1', 'mission.statistics.v1', 'mission.templates.v1', 'mission.focus-environment.v1', 'mission.onboarding.v1', 'mission.projects.v1'] as const
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024
type Data = Partial<Record<typeof BACKUP_KEYS[number], unknown>>
export type Backup = { format: 'mission-backup'; version: 1; exportedAt: string; data: Data }
function fail(): never { throw new Error('Das Backup ist ungültig oder enthält nicht unterstützte Daten. Es wurde nichts übernommen.') }
function record(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(); return v as Record<string, unknown> }
function fields(v: unknown, allowed: string[]) { const r = record(v); if (Object.keys(r).some(k => !allowed.includes(k))) fail(); return r }
function number(v: unknown, max = Number.MAX_SAFE_INTEGER) { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) fail() }
function integer(v: unknown, max = Number.MAX_SAFE_INTEGER) { number(v, max); if (!Number.isSafeInteger(v)) fail() }
function text(v: unknown, max = 600) { if (typeof v !== 'string' || v.length > max || /[\u0000-\u0008]/.test(v)) fail() }
function strings(v: unknown) { if (!Array.isArray(v) || v.length > 20000) fail(); v.forEach(s => text(s, 240)); if (new Set(v).size !== v.length) fail() }
function choice(v: unknown, list: unknown[]) { if (!list.includes(v)) fail() }
function context(r: Record<string, unknown>) {
  if (r.learningContext !== undefined && !validateLearningContext(r.learningContext)) fail()
  if (r.focusStrategy !== undefined && !validFocusStrategy(r.focusStrategy)) fail()
}
function plan(v: unknown, form = false) {
  const r = fields(v, ['goal', 'timeBudgetMinutes', 'energyLevel', 'learningBlocker', 'learningBlockerDetails', 'learningContext', ...(form ? [] : ['id', 'steps', 'timeMode', 'focusStrategy'])])
  text(r.goal, 280); number(r.timeBudgetMinutes, 10080)
  choice(r.energyLevel, ['low', 'medium', 'high']); choice(r.learningBlocker, [null, ...learningBlockerOptions.map(o => o.value)])
  if (r.learningBlockerDetails !== undefined) text(r.learningBlockerDetails, 240)
  context(r)
  if (!form) {
    text(r.id, 100); choice(r.timeMode ?? 'manual', ['automatic', 'manual', 'stopwatch'])
    if (!Array.isArray(r.steps) || !r.steps.length || r.steps.length > 100) fail()
    r.steps.forEach(v => { const s = fields(v, ['id', 'title', 'description', 'minutes', 'kind', 'done', 'topicFocus']); text(s.id, 100); text(s.title, 90); text(s.description, 600); number(s.minutes, 10080); if (!Number.isInteger(s.minutes) || (s.minutes as number) < 1) fail(); choice(s.kind, ['learning', 'practice', 'preparation', 'reflection']); if (typeof s.done !== 'boolean') fail(); if (s.topicFocus !== undefined) text(s.topicFocus, 280) })
    if (new Set(r.steps.map(s => record(s).id)).size !== r.steps.length) fail()
  }
  return r
}
const sessionFields = ['id', 'startedAt', 'goal', 'focusSeconds', 'plannedSeconds', 'timeMode', 'completedSteps', 'totalSteps', 'focusStrategy', 'completedFocusBlocks', 'breakSeconds']
function validateData(data: unknown): Data {
  const d = fields(data, [...BACKUP_KEYS])
  for (const [key, value] of Object.entries(d)) {
    if (key === BACKUP_KEYS[0]) {
      const r = fields(value, ['form', 'mission', 'remainingSeconds', 'elapsedSeconds', 'history', 'activeSession', 'focusBlocks'])
      plan(r.form, true); const p = r.mission === null ? null : plan(r.mission)
      number(r.remainingSeconds, 10080 * 60); if (r.elapsedSeconds !== undefined) number(r.elapsedSeconds)
      const history = r.history ?? []; if (!Array.isArray(history) || history.length > 5) fail()
      history.forEach(v => { const h = fields(v, [...sessionFields, 'endedAt', 'status']); context(h); if (h.breakSeconds !== undefined) number(h.breakSeconds); if (h.completedFocusBlocks !== undefined) integer(h.completedFocusBlocks, 10080) })
      const normalized = normalizeHistory(history); if (normalized.length !== history.length) fail()
      if (r.activeSession != null) { const a = fields(r.activeSession, [...sessionFields, 'missionId']); context(a); if (a.breakSeconds !== undefined) number(a.breakSeconds); if (a.completedFocusBlocks !== undefined) integer(a.completedFocusBlocks, 10080); if (!normalizeActiveSession(r.activeSession, normalized) || a.missionId !== p?.id) fail() }
      if (r.focusBlocks != null) {
        fields(r.focusBlocks, ['phase', 'block', 'completedBlocks', 'remainingMilliseconds', 'breakMilliseconds'])
        const restored = p && restoreFocusBlocks(r.focusBlocks, r.remainingSeconds as number, p.focusStrategy as never)
        if (!restored || Object.entries(restored).some(([k, v]) => record(r.focusBlocks)[k] !== v)) fail()
      }
    } else if (key === BACKUP_KEYS[1]) {
      const r = fields(value, Object.keys(initialGamificationState)); if (r.version !== 2) fail()
      for (const k of ['legacyXp', 'coins', 'totalFocusMilliseconds']) number(r[k])
      integer(r.totalFocusMilliseconds); integer(r.coins)
      for (const k of ['ownedOrbIds', 'completedCratePurchaseIds', 'claimedStepRewardKeys', 'claimedMissionIds', 'ownedCosmeticIds']) strings(r[k])
      if (r.equippedOrbId !== null) text(r.equippedOrbId, 100)
      text(r.selectedBackgroundId, 100); text(r.selectedCoreEffectId, 100)
      if ((r.ownedOrbIds as string[]).some(id => !orbCollection.some(o => o.id === id)) || (r.ownedCosmeticIds as string[]).some(id => !cosmeticShopItems.some(o => o.id === id)) || !canEquipOrb(r as GamificationState, r.equippedOrbId as string | null)) fail()
      for (const [field, kind, defaultId] of [['selectedBackgroundId', 'background', 'deep-space'], ['selectedCoreEffectId', 'core-effect', 'core-soft']]) {
        if (r[field] !== defaultId && (!(r.ownedCosmeticIds as string[]).includes(r[field] as string) || !cosmeticShopItems.some(o => o.id === r[field] && o.kind === kind))) fail()
      }
    } else if (key === BACKUP_KEYS[2]) {
      const r = fields(value, ['version', 'days', 'goals', 'trackedSince', 'accountedThrough', 'completedSessions', 'endedEarlySessions', 'lastSessionId', 'pending'])
      if (r.version !== 1 || !validGoals(r.goals) || Object.keys(record(r.goals)).length !== 2) fail()
      for (const k of ['trackedSince', 'accountedThrough', 'completedSessions', 'endedEarlySessions']) integer(r[k])
      if (r.lastSessionId !== undefined) text(r.lastSessionId, 100)
      const days = record(r.days); if (Object.keys(days).length > 400) fail()
      for (const [day, ms] of Object.entries(days)) { if (!/^\d{4}-\d\d-\d\d$/.test(day) || localDay(Date.parse(`${day}T12:00:00`)) !== day) fail(); integer(ms) }
      if (r.pending !== undefined) { const b = fields(r.pending, ['from', 'to', 'start']); for (const k of ['from', 'to', 'start']) integer(b[k]); if ((b.to as number) <= (b.from as number) || (b.to as number) - (b.from as number) > 10080 * 60000 || !Number.isFinite(new Date(b.start as number).getTime())) fail() }
    } else if (key === BACKUP_KEYS[3]) loadTemplates({ getItem: () => JSON.stringify(value) })
    else if (key === BACKUP_KEYS[4]) choice(value, ['still', 'deep-space', 'nebula', 'liquid'])
    else if (key === PROJECT_STORAGE_KEY) readProjectStore(value)
    else { const r = fields(value, ['version', 'status']); if (r.version !== 1) fail(); choice(r.status, ['offered', 'dismissed', 'completed', 'skipped']) }
  }
  // Progress and statistics must describe the same measurement journal.
  const game = d[BACKUP_KEYS[1]], stats = d[BACKUP_KEYS[2]]
  if (stats && !game) fail()
  if (game && stats && (record(stats).accountedThrough as number) > (record(game).totalFocusMilliseconds as number)) fail()
  return d
}
export function parseBackup(raw: string): Backup {
  if (new Blob([raw]).size > MAX_BACKUP_BYTES) fail()
  let parsed: unknown; try { parsed = JSON.parse(raw) } catch { fail() }
  const b = fields(parsed, ['format', 'version', 'exportedAt', 'data'])
  if (b.format !== 'mission-backup' || b.version !== 1 || typeof b.exportedAt !== 'string' || !Number.isFinite(Date.parse(b.exportedAt))) fail()
  validateData(b.data)
  return b as Backup
}
export function exportBackup(storage: Storage = localStorage): string {
  const data: Data = {}
  for (const key of BACKUP_KEYS) { const raw = storage.getItem(key); if (raw !== null) data[key] = key === BACKUP_KEYS[4] ? raw : JSON.parse(raw) }
  const raw = JSON.stringify({ format: 'mission-backup', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)
  parseBackup(raw); return raw
}
// Caller must own the existing app writer lock and keep its timer stopped.
export function replaceLocalData(backup: Backup | null, confirmed: boolean, storage: Storage = localStorage) {
  if (!confirmed) throw new Error('Bitte bestätige das Ersetzen oder Löschen deiner lokalen Mission-Daten.')
  const data = backup ? parseBackup(JSON.stringify(backup)).data : {}
  const previous = BACKUP_KEYS.map(key => storage.getItem(key))
  try {
    for (const key of BACKUP_KEYS) { if (Object.hasOwn(data, key)) storage.setItem(key, key === BACKUP_KEYS[4] ? data[key] as string : JSON.stringify(data[key])); else storage.removeItem(key) }
  } catch {
    try { BACKUP_KEYS.forEach((key, i) => { if (previous[i] === null) storage.removeItem(key); else storage.setItem(key, previous[i]!) }) } catch { throw new Error('Speicherfehler: Wiederherstellung nicht vollständig möglich. Bewahre dein Backup auf.') }
    throw new Error('Speicherfehler. Die bisherigen Daten wurden wiederhergestellt.')
  }
}
