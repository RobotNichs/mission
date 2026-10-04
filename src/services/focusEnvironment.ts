export const FOCUS_ENVIRONMENT_KEY = 'mission.focus-environment.v1'
export const focusEnvironments = [
  { id: 'still', name: 'Still' },
  { id: 'deep-space', name: 'Deep Space' },
  { id: 'nebula', name: 'Nebula' },
  { id: 'liquid', name: 'Liquid' },
] as const
export type FocusEnvironment = typeof focusEnvironments[number]['id']
export function normalizeFocusEnvironment(value: unknown): FocusEnvironment {
  return focusEnvironments.some(environment => environment.id === value) ? value as FocusEnvironment : 'still'
}
export function loadFocusEnvironment(): FocusEnvironment {
  try { return normalizeFocusEnvironment(localStorage.getItem(FOCUS_ENVIRONMENT_KEY)) } catch { return 'still' }
}
export function saveFocusEnvironment(value: FocusEnvironment): boolean {
  try { localStorage.setItem(FOCUS_ENVIRONMENT_KEY, normalizeFocusEnvironment(value)); return true } catch { return false }
}
