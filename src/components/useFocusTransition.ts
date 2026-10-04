import { useLayoutEffect, useRef, useState } from 'react'
import { orbFlipTransform, type OrbOrigin } from '../services/focusTransition'

export default function useFocusTransition(origin: OrbOrigin | null | undefined, orbId: string) {
  const root = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const motion = useRef<HTMLDivElement>(null)
  const [entering, setEntering] = useState(false)
  useLayoutEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const element = motion.current
    if (!origin || origin.orbId !== orbId || media?.matches || !element?.animate || !stage.current) return
    const transform = orbFlipTransform(origin, stage.current.getBoundingClientRect())
    if (!transform) return
    const animations: Animation[] = []
    let timeout: number | undefined
    function finish() {
      animations.forEach(animation => animation.cancel())
      window.clearTimeout(timeout)
      setEntering(false)
    }
    try {
      setEntering(true)
      animations.push(element.animate([{ transform, transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }],
        { duration: 700, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' }))
      for (const content of root.current?.querySelectorAll<HTMLElement>('[data-focus-reveal]') ?? []) {
        animations.push(content.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 700, fill: 'both' }))
      }
      const backdrop = root.current?.querySelector<HTMLElement>('.focus-backdrop')
      if (backdrop?.animate) animations.push(backdrop.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 700 }))
      timeout = window.setTimeout(finish, 900)
    } catch { finish() }
    const reduced = () => { if (media?.matches) finish() }
    window.addEventListener('resize', finish)
    media?.addEventListener('change', reduced)
    return () => {
      window.clearTimeout(timeout)
      animations.forEach(animation => animation.cancel())
      window.removeEventListener('resize', finish)
      media?.removeEventListener('change', reduced)
    }
  }, [origin, orbId])
  return { root, stage, motion, entering }
}
