import type { GamificationState } from '../types/gamification'
import { orbCollection } from './orbCatalog'
import { isLocalDevelopment } from './developmentMode'

export type DebugAction = { type: 'add-test-coins' } | { type: 'unlock-test-orb'; orbId: string }

// Imported only by the development-only lazy component. Focus fields stay intact.
export function applyDebugAction(
  state: GamificationState, action: DebugAction, development: boolean, hostname: string,
): GamificationState {
  if (!isLocalDevelopment(development, hostname)) return state
  if (action.type === 'add-test-coins') {
    return { ...state, coins: Math.min(Number.MAX_SAFE_INTEGER, state.coins + 300) }
  }
  if (!orbCollection.some((orb) => orb.id === action.orbId) || state.ownedOrbIds.includes(action.orbId)) return state
  return { ...state, ownedOrbIds: [...state.ownedOrbIds, action.orbId] }
}
