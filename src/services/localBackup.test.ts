// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { BACKUP_KEYS, exportBackup, parseBackup, replaceLocalData, MAX_BACKUP_BYTES } from './localBackup'
import { initialGamificationState } from '../types/gamification'
import { emptyStatistics } from './learningStatistics'
import { exampleTemplates } from './missionTemplates'
beforeEach(() => localStorage.clear())
const plan = { id: 'mission-test', goal: 'Statistik lernen', timeBudgetMinutes: 25, energyLevel: 'medium', learningBlocker: 'starting', timeMode: 'manual', steps: [{ id: 'step', title: 'Beispiel prüfen', description: 'Statistik-Beispiel prüfen', minutes: 25, kind: 'learning', done: true }] }
function fixture() {
  localStorage.setItem(BACKUP_KEYS[0], JSON.stringify({ form: { goal: plan.goal, timeBudgetMinutes: 25, energyLevel: 'medium', learningBlocker: 'starting' }, mission: plan, remainingSeconds: 123, elapsedSeconds: 10, history: [], activeSession: null }))
  localStorage.setItem(BACKUP_KEYS[1], JSON.stringify({ ...initialGamificationState, totalFocusMilliseconds: 123456, coins: 2 }))
  localStorage.setItem(BACKUP_KEYS[2], JSON.stringify(emptyStatistics(123456)))
  localStorage.setItem(BACKUP_KEYS[3], JSON.stringify({ version: 1, templates: [{ ...exampleTemplates[0], id: 'custom', origin: 'custom' }] }))
  localStorage.setItem(BACKUP_KEYS[4], 'nebula')
  localStorage.setItem(BACKUP_KEYS[5], JSON.stringify({ version: 1, status: 'completed' }))
}
it('exports versioned mission, progress, goals, templates and settings without foreign secrets', () => {
  fixture(); localStorage.setItem('GROQ_API_KEY', 'SYNTHETIC-ONLY'); localStorage.setItem('other-app', 'private')
  const raw = exportBackup(), b = parseBackup(raw)
  expect(b.format).toBe('mission-backup'); expect(b.version).toBe(1); expect(Object.keys(b.data)).toHaveLength(6)
  expect(raw).not.toContain('SYNTHETIC-ONLY'); expect(raw).not.toContain('other-app')
})
it('restores exact focus, coins, mission ids and paused timer data without rewards', () => {
  fixture(); const before = exportBackup(); const b = parseBackup(before)
  localStorage.clear(); replaceLocalData(b, true)
  expect(parseBackup(exportBackup()).data).toEqual(b.data)
  expect(JSON.parse(localStorage.getItem(BACKUP_KEYS[1])!).coins).toBe(2)
  expect(JSON.parse(localStorage.getItem(BACKUP_KEYS[1])!).totalFocusMilliseconds).toBe(123456)
})
it('requires confirmation and deletes only the allowlisted Mission keys', () => {
  fixture(); localStorage.setItem('other-app', 'keep'); localStorage.setItem('mission.unknown', 'keep')
  expect(() => replaceLocalData(null, false)).toThrow('bestätige')
  expect(localStorage.getItem(BACKUP_KEYS[0])).not.toBeNull()
  replaceLocalData(null, true)
  BACKUP_KEYS.forEach(k => expect(localStorage.getItem(k)).toBeNull())
  expect(localStorage.getItem('other-app')).toBe('keep'); expect(localStorage.getItem('mission.unknown')).toBe('keep')
})
it.each(['{bad', JSON.stringify({ format: 'mission-backup', version: 2, data: {} }), 'x'.repeat(MAX_BACKUP_BYTES + 1)])('rejects invalid JSON/version/oversize without modifying data', raw => {
  fixture(); const before = exportBackup(); expect(() => parseBackup(raw)).toThrow(); expect(parseBackup(exportBackup()).data).toEqual(parseBackup(before).data)
})
it.each(['unknown', '__proto__', 'constructor'])('rejects unknown or dangerous keys %s', key => {
  expect(() => parseBackup(`{"format":"mission-backup","version":1,"exportedAt":"2026-10-07T00:00:00Z","data":{"${key}":{}}}`)).toThrow()
})
it('rejects nested secrets and invalid progress instead of silently importing partial state', () => {
  fixture(); const b = parseBackup(exportBackup()); const game = b.data[BACKUP_KEYS[1]] as Record<string, unknown>
  game.GROQ_API_KEY = 'SYNTHETIC'; expect(() => replaceLocalData(b, true)).toThrow()
  delete game.GROQ_API_KEY; game.coins = -1; expect(() => replaceLocalData(b, true)).toThrow()
  expect(JSON.parse(localStorage.getItem(BACKUP_KEYS[1])!).coins).toBe(2)
})
it('rolls back every key on a write failure', () => {
  fixture(); const b = parseBackup(exportBackup()); const previous = BACKUP_KEYS.map(k => localStorage.getItem(k)); let count = 0
  const storage = { getItem: localStorage.getItem.bind(localStorage), removeItem: localStorage.removeItem.bind(localStorage), setItem(k: string, v: string) { if (++count === 2) throw new Error('quota'); localStorage.setItem(k, v) } } as Storage
  expect(() => replaceLocalData(b, true, storage)).toThrow('wiederhergestellt')
  expect(BACKUP_KEYS.map(k => localStorage.getItem(k))).toEqual(previous)
})
