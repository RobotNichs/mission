import { companionSkins, type CompanionSkinId } from '../components/companionSkins'

export type CompanionVisualSelection = Readonly<{
  kind: 'companion'
  skinId: CompanionSkinId
}>

/** Technical display fallback only; never an equipment or ownership decision. */
export function resolveCompanionVisual(selection?: unknown): CompanionVisualSelection {
  if (selection !== null && typeof selection === 'object' && !Array.isArray(selection)) {
    const candidate = selection as Record<string, unknown>
    if (candidate.kind === 'companion' && typeof candidate.skinId === 'string'
      && Object.prototype.hasOwnProperty.call(companionSkins, candidate.skinId)) {
      return { kind: 'companion', skinId: candidate.skinId as CompanionSkinId }
    }
  }
  return { kind: 'companion', skinId: 'luna' }
}
