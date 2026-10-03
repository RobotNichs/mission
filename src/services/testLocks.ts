// Deterministic Web Locks stand-in for jsdom, including queued owners and aborts.
export function createTestLocks(): LockManager {
  let busy = false
  const queue: Array<() => void> = []
  return {
    request: (_name: string, options: LockOptions, callback: LockGrantedCallback) => new Promise((resolve, reject) => {
      let cancelled = false
      let released = false
      let granted = false
      const release = () => {
        if (released || !granted) return
        released = true
        busy = false
        queue.shift()?.()
      }
      options.signal?.addEventListener('abort', () => {
        cancelled = true
        release()
        reject(new DOMException('Aborted', 'AbortError'))
      }, { once: true })
      const run = () => {
        if (cancelled) { queue.shift()?.(); return }
        busy = true
        granted = true
        Promise.resolve(callback({ name: _name, mode: 'exclusive' } as Lock))
          .then(resolve, reject).finally(release)
      }
      if (busy) queue.push(run)
      else run()
    }),
  } as LockManager
}
