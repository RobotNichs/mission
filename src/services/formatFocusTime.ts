// Display only: omit incomplete minutes without changing stored precision.
export function formatFocusTime(milliseconds: number): string {
  const minutes = Number.isFinite(milliseconds) ? Math.floor(Math.max(0, milliseconds) / 60000) : 0
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}
