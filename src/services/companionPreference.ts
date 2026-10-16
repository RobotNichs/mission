import type { CompanionSkinId } from '../components/companionSkins'
import { resolveCompanionVisual } from './companionVisualResolver'

export const COMPANION_PREFERENCE_KEY = 'mission.companion-preference.v1'
export type CompanionPreference = Readonly<{ version: 1; skinId: CompanionSkinId }>
export type CompanionPreferenceRead =
  | { status: 'valid'; preference: CompanionPreference }
  | { status: 'missing' | 'invalid' | 'storage-error' }
export type CompanionPreferenceWrite = { status: 'saved' | 'deleted' | 'invalid' | 'storage-error' }
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Strict payload validation, without repairing or persisting the input. */
export function validateCompanionPreference(value: unknown): CompanionPreference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const r = value as Record<string, unknown>
  if (Object.keys(r).length !== 2 || !Object.hasOwn(r, 'version') || !Object.hasOwn(r, 'skinId') || r.version !== 1) return null
  const visual = resolveCompanionVisual({ kind: 'companion', skinId: r.skinId })
  return visual.skinId === r.skinId ? { version: 1, skinId: visual.skinId } : null
}

export function parseCompanionPreference(raw: string): CompanionPreference | null {
  try { return validateCompanionPreference(JSON.parse(raw)) } catch { return null }
}

export function readCompanionPreference(storage?: PreferenceStorage): CompanionPreferenceRead {
  try {
    const raw = (storage ?? localStorage).getItem(COMPANION_PREFERENCE_KEY)
    if (raw === null) return { status: 'missing' }
    const preference = parseCompanionPreference(raw)
    return preference ? { status: 'valid', preference } : { status: 'invalid' }
  } catch { return { status: 'storage-error' } }
}

export function resolveCompanionPreference(result: CompanionPreferenceRead) {
  return resolveCompanionVisual(result.status === 'valid' ? { kind: 'companion', skinId: result.preference.skinId } : undefined)
}

// Future callers must hold MISSION_WRITER_LOCK. No lock acquisition or UI caller here.
export function saveCompanionPreference(skinId: CompanionSkinId, storage?: PreferenceStorage): CompanionPreferenceWrite {
  const preference = validateCompanionPreference({ version: 1, skinId })
  if (!preference) return { status: 'invalid' }
  try {
    (storage ?? localStorage).setItem(COMPANION_PREFERENCE_KEY, JSON.stringify(preference))
    return { status: 'saved' }
  } catch { return { status: 'storage-error' } }
}

export function deleteCompanionPreference(storage?: PreferenceStorage): CompanionPreferenceWrite {
  try {
    (storage ?? localStorage).removeItem(COMPANION_PREFERENCE_KEY)
    return { status: 'deleted' }
  } catch { return { status: 'storage-error' } }
}
