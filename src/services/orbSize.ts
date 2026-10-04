export function getOrbSize(level: number, view: 'dashboard' | 'focus' = 'dashboard', availableWidth = Infinity): number {
  const safeLevel = Number.isFinite(level) ? Math.max(1, level) : 1
  const growth = Math.min(1, Math.sqrt(safeLevel - 1) / Math.sqrt(99))
  const base = view === 'focus' ? 280 : 76
  const maximum = view === 'focus' ? 420 : 122
  const width = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : Infinity
  return Math.min(base + (maximum - base) * growth, width)
}
