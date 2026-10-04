const HOUR = 3_600_000
export const prestigeMilestones = [
  { id: 'prestige-i', rank: 1, label: 'I', hours: 25, rewardSlotId: 'prestige-i-cosmetic' },
  { id: 'prestige-ii', rank: 2, label: 'II', hours: 75, rewardSlotId: 'prestige-ii-cosmetic' },
  { id: 'prestige-iii', rank: 3, label: 'III', hours: 200, rewardSlotId: 'prestige-iii-cosmetic' },
  { id: 'prestige-iv', rank: 4, label: 'IV', hours: 500, rewardSlotId: 'prestige-iv-cosmetic' },
  { id: 'prestige-v', rank: 5, label: 'V', hours: 1000, rewardSlotId: 'prestige-v-cosmetic' },
] as const
// Reward slots are reserved metadata, never items in the crate catalog.
export function getPrestige(value: unknown) {
  const totalMilliseconds = typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)) : 0
  const reached = prestigeMilestones.filter(stage => totalMilliseconds >= stage.hours * HOUR)
  const current = reached.at(-1) ?? null
  const next = prestigeMilestones[reached.length] ?? null
  const previousThreshold = current ? current.hours * HOUR : 0
  const nextThresholdMilliseconds = next ? next.hours * HOUR : null
  return {
    rank: current?.rank ?? 0, label: current?.label ?? '0', totalMilliseconds, current, next,
    nextThresholdMilliseconds,
    remainingMilliseconds: nextThresholdMilliseconds === null ? 0 : nextThresholdMilliseconds - totalMilliseconds,
    progress: nextThresholdMilliseconds === null ? 100 : (totalMilliseconds - previousThreshold) / (nextThresholdMilliseconds - previousThreshold) * 100,
  }
}
export function formatPrestigeTime(milliseconds: number, roundUp = false) {
  const seconds = Math[roundUp ? 'ceil' : 'floor'](milliseconds / 1000)
  return `${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min ${seconds % 60} s`
}
