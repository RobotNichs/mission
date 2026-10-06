import { useId, useState } from 'react'
import { environmentOptions, purposeOptions, materialOptions, MAX_CONTEXT_DETAILS, validateLearningContext, type LearningContext } from '../../shared/learningContext.mjs'

type Props = { value?: LearningContext; onChange: (value: LearningContext) => void; disabled?: boolean }
export default function LearningContextFields({ value = {}, onChange, disabled = false }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return <details className="learning-context" open={open}><summary onClick={e => { e.preventDefault(); setOpen(value => !value) }}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) setOpen(value => !value) } }}>Mehr Kontext</summary>
    {open && <fieldset disabled={disabled}><legend>Optionaler Lernkontext</legend>
      <label htmlFor={`${id}-environment`}>Lernumgebung</label>
      <select id={`${id}-environment`} value={value.environment ?? ''} onChange={e => onChange({ ...value, environment: e.target.value as LearningContext['environment'] || undefined })}>
        <option value="">Keine Angabe</option>{environmentOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <label htmlFor={`${id}-purpose`}>Lernzweck</label>
      <select id={`${id}-purpose`} value={value.purpose ?? ''} onChange={e => onChange({ ...value, purpose: e.target.value as LearningContext['purpose'] || undefined })}>
        <option value="">Keine Angabe</option>{purposeOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <fieldset className="context-materials"><legend>Vorhandene Materialien</legend>
        {materialOptions.map(([key, label]) => <label key={key} htmlFor={`${id}-${key}`}>
          <input id={`${id}-${key}`} type="checkbox" checked={value.materials?.includes(key) ?? false} onChange={e => {
            const materials: NonNullable<LearningContext['materials']> = e.target.checked ? key === 'none' ? ['none'] : [...(value.materials ?? []).filter(m => m !== 'none'), key] : (value.materials ?? []).filter(m => m !== key)
            onChange({ ...value, materials: [...materials], materialsDetails: materials.includes('other') ? value.materialsDetails : undefined })
          }} />{label === 'Sonstiges' ? 'Sonstige Materialien' : label}
        </label>)}
      </fieldset>
      {value.materials?.includes('other') && <><label htmlFor={`${id}-details`}>Sonstige Materialien beschreiben</label>
        <input id={`${id}-details`} value={value.materialsDetails ?? ''} maxLength={MAX_CONTEXT_DETAILS} onChange={e => onChange({ ...value, materialsDetails: e.target.value })} />
        <p className="field-hint">Optional, maximal 240 Zeichen. Keine vertraulichen Informationen angeben.</p></>}
      <p className="field-hint">Ohne Auswahl bleiben die Materialien unbekannt. Kontext wird mit deinem Plan lokal gespeichert und bei KI-Planung an den Anbieter gesendet.</p>
      {!validateLearningContext(value) && <p role="alert">Bitte beschreibe Materialien als einfachen Text mit höchstens 240 Zeichen, ohne HTML.</p>}
    </fieldset>}
  </details>
}
