import { useState } from 'react'
import type { LearningPlan } from '../types/learningPlan'
import { readCompanionPreference, resolveCompanionPreference } from '../services/companionPreference'
import MissionCompanion from './MissionCompanion'

type Props = {
  mission: LearningPlan | null
  hidden: boolean
  status: string
  action: string
  running: boolean
  completed: number
  project?: string
  activeProject?: string
  onAction: () => void
  onPlan: () => void
  onProjects: () => void
}

/** Read-only home presentation. Timer and progression remain owned by App. */
export default function HomeMission({ mission, hidden, status, action, running, completed, project, activeProject, onAction, onPlan, onProjects }: Props) {
  const [preference] = useState(() => readCompanionPreference())
  const visual = resolveCompanionPreference(preference)
  const next = mission?.steps.find(step => !step.done)
  return <section data-nav-area="home" hidden={hidden} className="mobile-mission-summary home-mission" aria-label="Heutige Mission">
    <div className="home-mission-intro">
      <div><p className="section-kicker">DEINE MISSION HEUTE</p><h2>{mission?.goal ?? 'Bereit für deine nächste Mission?'}</h2></div>
      <div className="companion-hero-stage" data-motion={hidden || running ? 'paused' : 'running'}>
        <div className="companion-hero-scenery" aria-hidden="true"><i /><i /><span /></div>
        <MissionCompanion skin={visual.skinId} state={running ? 'focus' : 'idle'} size={200} animated={!hidden} />
      </div>
    </div>
    <p className="home-session-status">{status}</p>
    {mission && <>
      <p className="home-mission-meta">{mission.timeMode === 'stopwatch' ? 'Freie Stoppuhr' : `${mission.timeBudgetMinutes} Min geplant`} · {completed}/{mission.steps.length} Schritte</p>
      {next && <p className="home-next-step"><span>Nächster Schritt:</span> <strong>{next.title}</strong></p>}
      {project && <p className="field-hint">Projekt: {project}</p>}
    </>}
    {!mission && <p className="field-hint">Ein Lernziel. Dein nächster Schritt.</p>}
    <button className="primary-button home-primary-action" type="button" onClick={onAction}>{action}</button>
    <div className="home-secondary-actions">
      {mission && <button className="focus-leave" type="button" onClick={onPlan}>Plan ansehen</button>}
      <button className="focus-leave" type="button" onClick={onProjects}>Projekte ansehen</button>
    </div>
    {activeProject && <p className="field-hint">Aktives Projekt: {activeProject}</p>}
    {preference.status === 'storage-error' && <p className="field-hint">Companion-Auswahl kann gerade nicht gelesen werden. Luna wird angezeigt.</p>}
  </section>
}
