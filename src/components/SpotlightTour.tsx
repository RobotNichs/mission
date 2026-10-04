import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { tourSteps, type TourStatus } from '../services/onboarding'

type Rect = { left: number; top: number; width: number; height: number }
export default function SpotlightTour({ targets, onClose }: {
  targets: ReadonlyArray<RefObject<HTMLElement | null>>; onClose: (status: TourStatus) => void
}) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [placement, setPlacement] = useState({ left: 16, top: 16 })
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useLayoutEffect(() => {
    const target = targets[step]?.current
    const measure = () => {
      const raw = target?.getBoundingClientRect()
      const visible = target && getComputedStyle(target).display !== 'none' && getComputedStyle(target).visibility !== 'hidden'
        && raw && raw.width > 0 && raw.height > 0 && [raw.left, raw.top, raw.width, raw.height].every(Number.isFinite)
      const viewportWidth = window.innerWidth, viewportHeight = window.innerHeight
      const next = visible ? { left: Math.max(0, raw.left), top: Math.max(0, raw.top),
        width: Math.max(0, Math.min(raw.right, viewportWidth) - Math.max(0, raw.left)),
        height: Math.max(0, Math.min(raw.bottom, viewportHeight) - Math.max(0, raw.top)) } : null
      const valid = next && next.width > 0 && next.height > 0 ? next : null
      setRect(valid)
      const boxHeight = dialog.current?.offsetHeight || 250
      const boxWidth = Math.min(340, Math.max(0, viewportWidth - 32))
      const desiredTop = valid ? valid.top + valid.height + 12 : (viewportHeight - boxHeight) / 2
      setPlacement({ left: Math.max(16, Math.min(valid?.left ?? (viewportWidth - boxWidth) / 2, viewportWidth - boxWidth - 16)),
        top: Math.max(16, Math.min(desiredTop, viewportHeight - boxHeight - 16)) })
    }
    target?.scrollIntoView?.({ block: 'center', behavior: 'instant' })
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (target) observer?.observe(target)
    if (dialog.current) observer?.observe(dialog.current)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [step, targets])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const siblings = [...document.body.children].filter(element => !element.contains(dialog.current)) as HTMLElement[]
    const old = siblings.map(element => ({ element, inert: element.inert, hidden: element.getAttribute('aria-hidden') }))
    old.forEach(({ element }) => { element.inert = true; element.setAttribute('aria-hidden', 'true') })
    const focus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.current?.contains(event.target)) dialog.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    }
    document.addEventListener('focusin', focus)
    return () => {
      document.removeEventListener('focusin', focus)
      old.forEach(({ element, inert, hidden }) => { element.inert = inert; if (hidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', hidden) })
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  useEffect(() => { dialog.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus() }, [step])
  return createPortal(<div className="tour-overlay" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); close.current('skipped') }
    if (event.key === 'Tab') {
      const buttons = [...dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []]
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }}>
    {rect ? <div className="tour-spotlight" aria-hidden="true" style={rect} /> : <div className="tour-shade" aria-hidden="true" />}
    <div ref={dialog} data-tour-controls className="tour-dialog" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description" style={placement}>
      <p className="section-kicker" aria-live="polite">Schritt {step + 1} von {tourSteps.length}</p>
      <h2 id="tour-title">{tourSteps[step].title}</h2><p id="tour-description">{tourSteps[step].text}</p>
      {!rect && <p className="tour-fallback">Dieser Bereich ist gerade nicht sichtbar. Du kannst die Erklärung trotzdem lesen.</p>}
      <div className="tour-actions">
        <button type="button" className="focus-leave" disabled={step === 0} onClick={() => setStep(value => value - 1)}>Zurück</button>
        <button type="button" className="focus-leave" onClick={() => close.current('skipped')}>Überspringen</button>
        <button type="button" className="timer-button" onClick={() => step === tourSteps.length - 1 ? close.current('completed') : setStep(value => value + 1)}>{step === tourSteps.length - 1 ? 'Fertig' : 'Weiter'}</button>
      </div>
    </div>
  </div>, document.body)
}
