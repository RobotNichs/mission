export type OrbOrigin = { left: number; top: number; width: number; height: number; orbId: string }
export function measureOrb(element: HTMLElement | null, orbId: string): OrbOrigin | null {
  if (!element) return null
  const { left, top, width, height } = element.getBoundingClientRect()
  return [left, top, width, height].every(Number.isFinite) && width > 0 && height > 0
    ? { left, top, width, height, orbId } : null
}
export function orbFlipTransform(origin: OrbOrigin, target: DOMRect): string | null {
  if (![target.left, target.top, target.width, target.height].every(Number.isFinite) || target.width <= 0 || target.height <= 0) return null
  return `translate(${origin.left - target.left}px, ${origin.top - target.top}px) scale(${origin.width / target.width}, ${origin.height / target.height})`
}
