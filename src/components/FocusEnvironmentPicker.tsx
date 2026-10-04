import { useEffect, useRef, useState } from 'react'
import { focusEnvironments, type FocusEnvironment } from '../services/focusEnvironment'

export default function FocusEnvironmentPicker({ value, onChange }: { value: FocusEnvironment; onChange: (value: FocusEnvironment) => void }) {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const select = useRef<HTMLSelectElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  function close() { setOpen(false); trigger.current?.focus() }
  useEffect(() => {
    if (!open) return
    select.current?.focus()
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <div className="focus-environment-picker" ref={wrapper}>
    <button ref={trigger} className="focus-leave" type="button" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => open ? close() : setOpen(true)}>Umgebung ändern</button>
    <span className="environment-current">{focusEnvironments.find(environment => environment.id === value)?.name}</span>
    {open && <div className="environment-panel" role="dialog" aria-label="Fokus-Umgebung auswählen"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
        if (event.key === 'Tab') {
          if (event.shiftKey && document.activeElement === select.current) { event.preventDefault(); closeButton.current?.focus() }
          else if (!event.shiftKey && document.activeElement === closeButton.current) { event.preventDefault(); select.current?.focus() }
        }
      }}>
      <label>Fokus-Umgebung<select ref={select} value={value} onChange={event => onChange(event.target.value as FocusEnvironment)}>
        {focusEnvironments.map(environment => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
      </select></label>
      <p>Bewegung nur bei aktiver Fokuszeit. Bei reduzierter Bewegung bleiben alle Umgebungen statisch.</p>
      <button ref={closeButton} className="focus-leave" type="button" onClick={close}>Schließen</button>
    </div>}
  </div>
}
