import { useEffect, useRef, useState } from 'react'
import FocusEnvironmentPicker from './FocusEnvironmentPicker'
import FocusBackdrop from './FocusBackdrop'
import useFocusTransition from './useFocusTransition'
import type { OrbOrigin } from '../services/focusTransition'
import type { FocusEnvironment } from '../services/focusEnvironment'
import type { LearningPlan } from '../types/learningPlan'
import type { OrbDefinition } from '../types/gamification'
import OrbVisual from './OrbVisual'
import { getOrbSize } from '../services/orbSize'

type Props = {
  orbOrigin?: OrbOrigin | null
  environment?: FocusEnvironment
  onEnvironmentChange?: (value: FocusEnvironment) => void
  environmentNotice?: string | null
  mission: LearningPlan | null
  orb: OrbDefinition
  countdown: string
  stopwatch?: boolean
  level?: number
  isRunning: boolean
  finished: boolean
  enabled: boolean
  error: string | null
  onToggleTimer: () => void
  onResetTimer: () => void
  onToggleStep: (id: string) => void
  onLeave: () => void
  onEditPlan?: () => void
  onEndSession?: () => void
  onCompleteSession?: () => void
}

export default function FocusMode({ mission, orb, countdown, stopwatch, level = 1, isRunning, finished, enabled, error,
  onToggleTimer, onResetTimer, onToggleStep, onLeave, onEditPlan, onEndSession, onCompleteSession,
  environment = 'still', onEnvironmentChange, environmentNotice, orbOrigin }: Props) {
  const transition = useFocusTransition(orbOrigin, orb.id)
  const [visible, setVisible] = useState(() => !document.hidden)
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  const heading = useRef<HTMLHeadingElement>(null)
  const leave = useRef(onLeave)
  leave.current = onLeave
  useEffect(() => {
    heading.current?.focus()
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented
        && !(event.target instanceof Element && event.target.closest('[role="dialog"]'))) { event.preventDefault(); leave.current() }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  const steps = mission?.steps ?? []
  const completed = steps.filter((step) => step.done).length
  const progress = steps.length ? Math.round(completed / steps.length * 100) : 0

  return (
    <main ref={transition.root} className={`focus-mode environment-${environment}`} data-focus-entering={transition.entering} data-background-motion={visible && isRunning ? 'running' : 'paused'} aria-label="Fokusmodus">
      <FocusBackdrop environment={environment} />
      <div className="focus-topline"><span>MISSION · FOKUS</span>
        <button className="focus-leave" type="button" onClick={onLeave}>Fokusmodus verlassen</button></div>
      {onEnvironmentChange && <FocusEnvironmentPicker value={environment} onChange={onEnvironmentChange} />}
      {environmentNotice && <p className="environment-notice">{environmentNotice}</p>}
      {onEditPlan && <button className="focus-leave" type="button" disabled={!enabled} onClick={onEditPlan}>Lernplan bearbeiten</button>}
      {error && <p className="writer-notice" role="alert">{error}</p>}
      <section className="focus-session" aria-labelledby="focus-title">
        <h1 id="focus-title" className="focus-title" ref={heading} tabIndex={-1}>Ein Moment für deinen Fokus.</h1>
        <div ref={transition.stage} className={`focus-orb-stage ${isRunning ? 'is-running' : ''} ${finished ? 'is-finished' : ''}`} style={{ width: `min(${getOrbSize(level, 'focus')}px, 78vw, 100%)` }}>
          <div ref={transition.motion} className="focus-orb-motion"><OrbVisual orb={orb} className="focus-orb" label={orb.name} /></div>
          <div data-focus-reveal className="focus-countdown" role="timer" aria-label={`${stopwatch ? 'Vergangene' : 'Verbleibende'} Zeit: ${countdown}`}>
            <strong>{countdown}</strong><span>MIN : SEK</span>
          </div>
        </div>
        <p className="focus-session-status" role="status">{finished ? 'Fokuszeit abgeschlossen. Gut gemacht.' : isRunning ? 'Du bist im Fokus.' : 'Pausiert. Dein Fortschritt bleibt erhalten.'}</p>
        <div data-focus-reveal inert={transition.entering} className="focus-controls">
          <button className="timer-button" type="button" disabled={!enabled} onClick={onToggleTimer}>{isRunning ? 'Pause' : finished ? 'Weiter' : 'Fortsetzen'}</button>
          <button className="reset-button" type="button" disabled={!enabled} onClick={onResetTimer} aria-label="Timer zurücksetzen">↺</button>
          {onEndSession && <button className="focus-leave" type="button" disabled={!enabled} onClick={onEndSession}>Session beenden</button>}
          {stopwatch && onCompleteSession && <button className="focus-leave" type="button" disabled={!enabled} onClick={onCompleteSession}>Session abschließen</button>}
        </div>
      </section>
      <section data-focus-reveal inert={transition.entering} className="focus-learning" aria-labelledby="focus-goal">
        <p className="section-kicker">DEIN LERNZIEL</p><h2 id="focus-goal">{mission?.goal ?? 'Zeit für dich und dein Lernen'}</h2>
        {steps.length > 0 ? <>
          <p className="focus-current-step"><span className="section-kicker">AKTUELLER SCHRITT</span><strong>{steps.find(step => !step.done)?.title ?? 'Alle Schritte erledigt'}</strong></p>
          <div className="progress-copy"><span>Lernfortschritt</span><strong>{completed} von {steps.length} erledigt</strong></div>
          <div className="focus-track" role="progressbar" aria-label="Lernfortschritt" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
          <div className="steps-list focus-steps">{steps.map((step) => (
            <label className={`task-step ${step.done ? 'is-done' : ''}`} key={step.id}>
              <input type="checkbox" checked={step.done} disabled={!enabled} onChange={() => onToggleStep(step.id)} />
              <span className="custom-checkbox" aria-hidden="true">{step.done ? '✓' : ''}</span>
              <span className="step-content"><span className="step-title">{step.title}</span><span className="step-description">{step.description}</span></span>
              <span className="step-duration">{step.minutes} min</span>
            </label>
          ))}</div>
        </> : <p className="focus-empty">Du kannst auch ohne Lernplan fokussieren. Dein Timer zählt wie gewohnt.</p>}
      </section>
    </main>
  )
}
