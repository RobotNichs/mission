// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { COMPANION_PREFERENCE_KEY as KEY, deleteCompanionPreference, parseCompanionPreference, readCompanionPreference, resolveCompanionPreference, saveCompanionPreference, validateCompanionPreference } from './companionPreference'
import { BACKUP_KEYS, exportBackup, parseBackup, replaceLocalData } from './localBackup'
import { initialGamificationState } from '../types/gamification'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())
const preference = (skinId = 'milo') => ({ version: 1, skinId })
const backup = (version: 1 | 2, data: Record<string, unknown> = {}) => parseBackup(JSON.stringify({ format: 'mission-backup', version, exportedAt: '2026-10-16T00:00:00Z', data }))

it('reads missing data as Luna without writing, but retains explicit Luna', () => {
  const set = vi.spyOn(Storage.prototype, 'setItem'), remove = vi.spyOn(Storage.prototype, 'removeItem')
  expect(readCompanionPreference()).toEqual({ status: 'missing' })
  expect(resolveCompanionPreference(readCompanionPreference())).toEqual({ kind: 'companion', skinId: 'luna' })
  expect(set).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled()
  expect(saveCompanionPreference('luna')).toEqual({ status: 'saved' })
  expect(readCompanionPreference()).toEqual({ status: 'valid', preference: preference('luna') })
})
it.each(['milo', 'nova'] as const)('persists explicit %s and deletes only on demand', skinId => {
  expect(saveCompanionPreference(skinId).status).toBe('saved')
  expect(readCompanionPreference()).toEqual({ status: 'valid', preference: preference(skinId) })
  expect(resolveCompanionPreference(readCompanionPreference()).skinId).toBe(skinId)
  expect(deleteCompanionPreference().status).toBe('deleted')
  expect(readCompanionPreference().status).toBe('missing')
})
it.each([null, [], {}, { version: 2, skinId: 'milo' }, { version: 1, skinId: 'bad' },
  { version: 1, skinId: 'toString' }, { version: 1, skinId: 'nova', coins: 4 }])('rejects invalid payload %j without repairing storage', value => {
  const raw = JSON.stringify(value); localStorage.setItem(KEY, raw)
  expect(validateCompanionPreference(value)).toBeNull()
  expect(readCompanionPreference().status).toBe('invalid')
  expect(resolveCompanionPreference(readCompanionPreference()).skinId).toBe('luna')
  expect(localStorage.getItem(KEY)).toBe(raw)
})
it('does not overwrite broken JSON or accept invalid explicit writes', () => {
  localStorage.setItem(KEY, '{broken')
  expect(parseCompanionPreference('{broken')).toBeNull()
  expect(readCompanionPreference().status).toBe('invalid')
  expect(saveCompanionPreference('bad' as 'luna').status).toBe('invalid')
  expect(localStorage.getItem(KEY)).toBe('{broken')
})
it('reports read, write and delete failures without logging payloads', () => {
  const error = () => { throw new Error('private payload') }
  const storage = { getItem: error, setItem: error, removeItem: error }
  const log = vi.spyOn(console, 'error')
  expect(readCompanionPreference(storage)).toEqual({ status: 'storage-error' })
  expect(resolveCompanionPreference(readCompanionPreference(storage)).skinId).toBe('luna')
  expect(saveCompanionPreference('milo', storage)).toEqual({ status: 'storage-error' })
  expect(deleteCompanionPreference(storage)).toEqual({ status: 'storage-error' })
  expect(log).not.toHaveBeenCalled()
})
it('imports the service without touching storage or network', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem'), set = vi.spyOn(Storage.prototype, 'setItem'), remove = vi.spyOn(Storage.prototype, 'removeItem')
  const fetch = vi.spyOn(globalThis, 'fetch')
  vi.resetModules(); await import('./companionPreference')
  expect(get).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
})
it.each(['milo', 'nova'] as const)('exports V2 with %s and restores preference', skinId => {
  saveCompanionPreference(skinId)
  const b = parseBackup(exportBackup())
  expect(b.version).toBe(2); expect(b.data[KEY]).toEqual(preference(skinId))
  deleteCompanionPreference(); replaceLocalData(b, true)
  expect(readCompanionPreference()).toEqual({ status: 'valid', preference: preference(skinId) })
})
it('exports V2 without inventing a missing preference', () => {
  const b = parseBackup(exportBackup())
  expect(b.version).toBe(2); expect(Object.hasOwn(b.data, KEY)).toBe(false)
  expect(localStorage.getItem(KEY)).toBeNull()
})
it.each([1, 2] as const)('restores V%i without preference by removing the current preference', version => {
  saveCompanionPreference('nova')
  const game = { ...initialGamificationState, coins: 52, totalFocusMilliseconds: 999999, ownedOrbIds: ['orb-common'], equippedOrbId: 'orb-common', completedCratePurchaseIds: ['purchase'] }
  const b = backup(version, { 'mission.gamification.v1': game })
  expect(() => replaceLocalData(b, false)).toThrow()
  expect(readCompanionPreference().status).toBe('valid')
  replaceLocalData(b, true)
  expect(readCompanionPreference().status).toBe('missing')
  expect(resolveCompanionPreference(readCompanionPreference()).skinId).toBe('luna')
  expect(JSON.parse(localStorage.getItem('mission.gamification.v1')!)).toEqual(game)
})
it('rejects preference in V1, future backup versions, unknown fields and invalid V2 preferences', () => {
  expect(() => backup(1, { [KEY]: preference() })).toThrow()
  for (const value of [{ version: 2, skinId: 'milo' }, { version: 1, skinId: 'unknown' }, { ...preference(), secret: 'x' }]) {
    expect(() => backup(2, { [KEY]: value })).toThrow()
  }
  const b = backup(2)
  expect(() => parseBackup(JSON.stringify({ ...b, version: 3 }))).toThrow()
  expect(() => parseBackup(JSON.stringify({ ...b, extra: true }))).toThrow()
  expect(() => backup(2, { unknown: {} })).toThrow()
})
it.each(['restore', 'delete'] as const)('rolls back the preference and all old keys after failed %s', action => {
  saveCompanionPreference('nova'); localStorage.setItem('mission.onboarding.v1', '{"version":1,"status":"completed"}')
  const previous = BACKUP_KEYS.map(k => localStorage.getItem(k))
  let failOnce = true
  const storage = { getItem: localStorage.getItem.bind(localStorage), setItem(k: string, v: string) {
    localStorage.setItem(k, v)
    if (k === KEY && failOnce) { failOnce = false; throw new Error('quota') }
  }, removeItem(k: string) {
    localStorage.removeItem(k)
    if (k === KEY && failOnce) { failOnce = false; throw new Error('quota') }
  } } as Storage
  expect(() => replaceLocalData(action === 'delete' ? null : backup(2, { [KEY]: preference() }), true, storage)).toThrow('wiederhergestellt')
  expect(BACKUP_KEYS.map(k => localStorage.getItem(k))).toEqual(previous)
})
it('refuses export of corrupt preference instead of silently omitting it', () => {
  localStorage.setItem(KEY, '{broken')
  expect(() => exportBackup()).toThrow()
  expect(localStorage.getItem(KEY)).toBe('{broken')
})
it('keeps all other data byte-identical during preference actions and preserves foreign keys on full deletion', () => {
  localStorage.setItem('mission.gamification.v1', JSON.stringify({ ...initialGamificationState, coins: 50, totalFocusMilliseconds: 123456, ownedOrbIds: ['orb-common'], equippedOrbId: 'orb-common', completedCratePurchaseIds: ['paid'] }))
  localStorage.setItem('mission.saved-mission.v1', 'synthetic history snapshot')
  localStorage.setItem('foreign-app', 'keep'); localStorage.setItem('mission.unknown', 'keep')
  const previous = BACKUP_KEYS.filter(k => k !== KEY).map(k => localStorage.getItem(k))
  saveCompanionPreference('milo'); readCompanionPreference(); deleteCompanionPreference()
  expect(BACKUP_KEYS.filter(k => k !== KEY).map(k => localStorage.getItem(k))).toEqual(previous)
  saveCompanionPreference('nova')
  replaceLocalData(null, true)
  BACKUP_KEYS.forEach(k => expect(localStorage.getItem(k)).toBeNull())
  expect(localStorage.getItem('foreign-app')).toBe('keep'); expect(localStorage.getItem('mission.unknown')).toBe('keep')
})
