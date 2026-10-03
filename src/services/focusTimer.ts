export type FocusSession = { lastTime: number; remainingMilliseconds: number }

// A monotonic clock is supplied by the caller. Persisted timestamps are never resumed.
export function advanceFocusSession(session: FocusSession, now: number) {
  const elapsedMilliseconds = Number.isFinite(now)
    ? Math.min(session.remainingMilliseconds, Math.max(0, Math.floor(now - session.lastTime)))
    : 0
  return {
    elapsedMilliseconds,
    session: {
      lastTime: session.lastTime + elapsedMilliseconds,
      remainingMilliseconds: session.remainingMilliseconds - elapsedMilliseconds,
    },
  }
}

export const MISSION_WRITER_LOCK = 'mission.app.writer.v2'

// The lock covers both storage contracts, purchases and focus accounting. A waiting
// tab must reload storage when ownership transfers; it may never flush stale state.
export function acquireMissionWriter(
  locks: LockManager,
  onAcquired: () => void,
  onError: () => void,
): () => void {
  const controller = new AbortController()
  let release: (() => void) | undefined
  let cancelled = false
  void locks.request(MISSION_WRITER_LOCK, { signal: controller.signal }, async () => {
    if (cancelled) return
    await new Promise<void>((resolve) => {
      release = resolve
      onAcquired()
    })
  }).catch(() => { if (!cancelled) onError() })
  return () => {
    cancelled = true
    controller.abort()
    release?.()
  }
}
