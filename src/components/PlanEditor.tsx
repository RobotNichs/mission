import { useState } from 'react'
import { createLearningPlanId, type LearningPlan, type LearningStep } from '../types/learningPlan'
import { MAX_PLAN_MINUTES, validateEditablePlan } from '../services/planEditor'
import LearningContextFields from './LearningContextFields'

type Props = { initial: LearningPlan; onSave: (plan: LearningPlan) => void; onCancel: () => void; disabled: boolean; saveLabel?: string }

export default function PlanEditor({ initial, onSave, onCancel, disabled, saveLabel = 'Änderungen speichern' }: Props) {
  const [draft, setDraft] = useState<LearningPlan>(() => ({ ...initial, timeMode: initial.timeMode ?? 'manual', steps: initial.steps.map(s => ({ ...s })) }))
  const [error, setError] = useState<string | null>(null)
  const [openStep, setOpenStep] = useState<string | null>(() => initial.steps.find(s => !s.title || !s.description)?.id ?? null)
  const sum = draft.steps.reduce((n, s) => n + s.minutes, 0)
  function change(id: string, patch: Partial<LearningStep>) {
    setDraft(p => ({ ...p, steps: p.steps.map(s => s.id === id ? { ...s, ...patch } : s) }))
  }
  function move(index: number, offset: number) {
    setDraft(p => { const steps = [...p.steps]; [steps[index], steps[index + offset]] = [steps[index + offset], steps[index]]; return { ...p, steps } })
  }
  return <form className="plan-editor" aria-label="Lernplan bearbeiten" noValidate onSubmit={e => {
    e.preventDefault()
    const plan = { ...draft, timeBudgetMinutes: draft.timeMode === 'automatic' ? sum : draft.timeBudgetMinutes }
    const issue = validateEditablePlan(plan)
    setError(issue)
    if (!issue) onSave(plan)
  }}><fieldset disabled={disabled}>
    <legend>Dein Plan, deine Entscheidungen</legend>
    <label>Lernziel<input value={draft.goal} maxLength={280} required onChange={e => setDraft(p => ({ ...p, goal: e.target.value }))} /></label>
    <LearningContextFields value={draft.learningContext} onChange={learningContext => setDraft(p => ({ ...p, learningContext }))} />
    <label>Zeitmodus<select value={draft.timeMode} onChange={e => setDraft(p => ({ ...p, timeMode: e.target.value as LearningPlan['timeMode'] }))}>
      <option value="automatic">Automatisch</option><option value="manual">Manuell</option><option value="stopwatch">Stoppuhr</option>
    </select></label>
    {draft.timeMode === 'manual' && <label>Gesamtdauer in Minuten<input type="number" min={1} max={MAX_PLAN_MINUTES} required value={draft.timeBudgetMinutes} onChange={e => setDraft(p => ({ ...p, timeBudgetMinutes: Number(e.target.value) }))} /></label>}
    <p>Schrittsumme: {sum} Minuten{draft.timeMode === 'stopwatch' ? ' · ohne Zeitlimit' : ''}</p>
    {draft.timeMode === 'manual' && sum !== draft.timeBudgetMinutes && <p role="status">Gesamtdauer und Schrittsumme weichen ab. Deine Zeiten bleiben unverändert.</p>}
    <ol className="editor-step-list">{draft.steps.map((s, i) => {
      const original = initial.steps.find(step => step.id === s.id)
      const status = !original ? 'Neu' : s.title !== original.title || s.description !== original.description || s.minutes !== original.minutes ? 'Bearbeitet' : s.done ? 'Erledigt' : 'Unverändert'
      return <li className="editor-step" key={s.id}>
        <button type="button" className="editor-step-toggle" aria-expanded={openStep === s.id} aria-controls={`editor-step-${s.id}`}
          aria-label={`Schritt ${i + 1} bearbeiten: ${s.title || 'Neuer Schritt'}`} onClick={() => setOpenStep(openStep === s.id ? null : s.id)}>
          <span className="editor-step-number">{String(i + 1).padStart(2, '0')}</span>
          <span className="editor-step-name">{s.title || 'Neuer Schritt'}<small>{status}</small></span>
          <span className="editor-step-time">{s.minutes} min</span><span aria-hidden="true">{openStep === s.id ? '−' : '+'}</span>
        </button>
        <div id={`editor-step-${s.id}`} hidden={openStep !== s.id}>
        {openStep === s.id && <fieldset className="editor-step-fields"><legend>Schritt {i + 1}{s.done ? ' · erledigt' : ''}</legend>
      <label>Titel<input required maxLength={90} value={s.title} onChange={e => change(s.id, { title: e.target.value })} /></label>
      <label>Beschreibung<textarea required maxLength={600} value={s.description} onChange={e => change(s.id, { description: e.target.value })} /></label>
      <label>Minuten<input required type="number" min={1} max={MAX_PLAN_MINUTES} value={s.minutes} onChange={e => change(s.id, { minutes: Number(e.target.value) })} /></label>
        </fieldset>}
        </div>
      <div className="editor-actions editor-step-actions"><button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Schritt ${i + 1} nach oben`}>Nach oben</button>
        <button type="button" disabled={i === draft.steps.length - 1} onClick={() => move(i, 1)} aria-label={`Schritt ${i + 1} nach unten`}>Nach unten</button>
        <button type="button" onClick={() => setDraft(p => ({ ...p, steps: p.steps.filter(step => step.id !== s.id) }))}>Schritt {i + 1} löschen</button></div>
    </li>})}</ol>
    <div className="editor-actions editor-save-actions"><button type="button" disabled={draft.steps.length >= 100} onClick={() => {
      const id = createLearningPlanId()
      setDraft(p => ({ ...p, steps: [...p.steps, { id, title: '', description: '', minutes: 5, kind: 'learning', done: false }] }))
      setOpenStep(id)
    }}>Schritt hinzufügen</button>
      <button type="submit">{saveLabel}</button><button type="button" onClick={onCancel}>Abbrechen</button></div>
    {error && <p role="alert">{error}</p>}
  </fieldset></form>
}
