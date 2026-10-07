import { fireEvent, screen as originalScreen, within as originalWithin } from '@testing-library/react'

// Existing feature regressions now reach controls via real navigation first.
// queryByRole remains untouched, so visibility assertions cannot reveal a tab.
function navigable<T extends Pick<typeof originalScreen, 'getByRole' | 'getAllByRole' | 'findByRole' | 'queryAllByRole'>>(queries: T): T {
  const result = { ...queries }
  for (const key of ['getByRole', 'getAllByRole', 'findByRole'] as const) {
    const query = queries[key] as (...args: unknown[]) => unknown
    const locate = (...args: unknown[]) => {
      const role = args[0] as string, options = (args[1] ?? {}) as Record<string, unknown>
      const candidates = queries.queryAllByRole(role, { ...options, hidden: true })
      const candidate = candidates.find(e => e.closest('[data-nav-area][hidden]'))
      if (candidate && !queries.queryAllByRole(role, options).length) {
        const area = candidate.closest('[data-nav-area]')?.getAttribute('data-nav-area')
        const labels: Record<string, string> = { home: 'Home', plan: 'Plan', projects: 'Projekte', library: 'Bibliothek', progress: 'Fortschritt' }
        const nav = candidate.closest('.mission-writer-surface')?.parentElement?.querySelector('.desktop-sidebar nav, .mobile-navigation') ?? document.querySelector('.desktop-sidebar nav, .mobile-navigation')
        if (nav && area && labels[area]) fireEvent.click(originalWithin(nav as HTMLElement).getByRole('button', { name: labels[area] }))
      }
      return query(...args)
    }
    Object.assign(result, { [key]: locate })
  }
  return result
}
export const screen = navigable(originalScreen)
export function within(element: HTMLElement) { return navigable(originalWithin(element)) }
