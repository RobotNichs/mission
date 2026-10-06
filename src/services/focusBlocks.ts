export type FocusStrategy = { mode: 'free' | 'pomodoro' | '50-10' } | { mode: 'custom'; focusMinutes: number; breakMinutes: number }
export type FocusBlocks = { phase: 'focus' | 'break' | 'finished'; block: number; completedBlocks: number; remainingMilliseconds: number; breakMilliseconds: number }
export function validFocusStrategy(value: unknown): value is FocusStrategy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const s = value as Record<string, unknown>
  if (s.mode === 'custom') return Object.keys(s).length === 3 && Number.isInteger(s.focusMinutes) && Number.isInteger(s.breakMinutes)
    && (s.focusMinutes as number) >= 10 && (s.focusMinutes as number) <= 120 && (s.breakMinutes as number) >= 1 && (s.breakMinutes as number) <= 60
  return Object.keys(s).length === 1 && ['free', 'pomodoro', '50-10'].includes(s.mode as string)
}
export function readFocusStrategy(value: unknown): FocusStrategy {
  return validFocusStrategy(value) ? { ...value } : { mode: 'free' }
}
export function intervals(strategy?: FocusStrategy) {
  const s = readFocusStrategy(strategy)
  return s.mode === 'free' ? null : s.mode === 'custom' ? { focus: s.focusMinutes * 60000, pause: s.breakMinutes * 60000 }
    : { focus: (s.mode === 'pomodoro' ? 25 : 50) * 60000, pause: (s.mode === 'pomodoro' ? 5 : 10) * 60000 }
}
export function createFocusBlocks(remainingSeconds: number, strategy?: FocusStrategy, previous?: FocusBlocks): FocusBlocks | null {
  const timing = intervals(strategy)
  if (!timing) return null
  return { phase: remainingSeconds > 0 ? 'focus' : 'finished', block: (previous?.completedBlocks ?? 0) + 1, completedBlocks: previous?.completedBlocks ?? 0,
    remainingMilliseconds: Math.min(Math.max(0, remainingSeconds * 1000), timing.focus), breakMilliseconds: previous?.breakMilliseconds ?? 0 }
}
export function restoreFocusBlocks(value: unknown, remainingSeconds: number, strategy?: FocusStrategy): FocusBlocks | null {
  const timing = intervals(strategy)
  if (!timing) return null
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const b = value as FocusBlocks
    if (['focus', 'break', 'finished'].includes(b.phase) && Number.isSafeInteger(b.block) && b.block >= 1 && b.block <= 10080
      && Number.isSafeInteger(b.completedBlocks) && b.completedBlocks >= 0 && b.completedBlocks <= b.block
      && Number.isFinite(b.remainingMilliseconds) && b.remainingMilliseconds >= 0
      && b.remainingMilliseconds <= (b.phase === 'break' ? timing.pause : Math.min(timing.focus, remainingSeconds * 1000))
      && Number.isFinite(b.breakMilliseconds) && b.breakMilliseconds >= 0
      && (b.phase !== 'finished' || remainingSeconds === 0)) return { phase: b.phase, block: b.block, completedBlocks: b.completedBlocks, remainingMilliseconds: b.remainingMilliseconds, breakMilliseconds: b.breakMilliseconds }
  }
  return createFocusBlocks(remainingSeconds, strategy)
}
// Pure transition: never touches clocks, storage or rewards. Overshoot is discarded.
export function advanceFocusBlocks(blocks: FocusBlocks, elapsedMilliseconds: number, remainingSeconds: number, strategy: FocusStrategy) {
  const timing = intervals(strategy)!
  const elapsed = Math.min(blocks.remainingMilliseconds, Math.max(0, Number.isFinite(elapsedMilliseconds) ? elapsedMilliseconds : 0))
  const focusMilliseconds = blocks.phase === 'focus' ? elapsed : 0
  // Align with the existing timer's integer-millisecond precision; repeated
  // division must not leave a floating-point residue that creates a extra break.
  const nextRemaining = Math.max(0, Math.round(remainingSeconds * 1000) - focusMilliseconds) / 1000
  let next = { ...blocks, remainingMilliseconds: blocks.remainingMilliseconds - elapsed,
    breakMilliseconds: blocks.breakMilliseconds + (blocks.phase === 'break' ? elapsed : 0) }
  const boundary = blocks.phase !== 'finished' && next.remainingMilliseconds === 0
  if (boundary) next = blocks.phase === 'focus'
    ? { ...next, completedBlocks: next.completedBlocks + 1, phase: nextRemaining === 0 ? 'finished' : 'break', remainingMilliseconds: nextRemaining === 0 ? 0 : timing.pause }
    : { ...next, phase: 'focus', block: next.block + 1, remainingMilliseconds: Math.min(timing.focus, nextRemaining * 1000) }
  return { blocks: next, remainingSeconds: nextRemaining, focusMilliseconds, boundary }
}
export function skipFocusBreak(blocks: FocusBlocks, remainingSeconds: number, strategy: FocusStrategy): FocusBlocks {
  return blocks.phase === 'break' ? { ...blocks, phase: 'focus', block: blocks.block + 1, remainingMilliseconds: Math.min(intervals(strategy)!.focus, remainingSeconds * 1000) } : blocks
}
export function strategyLabel(strategy?: FocusStrategy) {
  const s = readFocusStrategy(strategy)
  return s.mode === 'custom' ? `${s.focusMinutes} / ${s.breakMinutes}` : s.mode === 'pomodoro' ? '25 / 5' : s.mode === '50-10' ? '50 / 10' : 'Frei'
}
export function blockSummary(minutes: number, strategy?: FocusStrategy) {
  const timing = intervals(strategy)
  const count = timing ? Math.ceil(minutes * 60000 / timing.focus) : 1
  const breaks = Math.max(0, count - 1), pauseMinutes = timing ? breaks * timing.pause / 60000 : 0
  return { count, breaks, pauseMinutes, totalMinutes: minutes + pauseMinutes }
}
