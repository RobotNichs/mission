import { useEffect, useState } from 'react'
import CoinShop from './components/CoinShop'
import GamificationPanel from './components/GamificationPanel'
import MissionRewardDialog, { type MissionReward } from './components/MissionRewardDialog'
import {
  awardMissionCompletion,
  awardStepCompletion,
  equipCosmetic,
  equipOrb,
  GAMIFICATION_STORAGE_KEY,
  loadGamificationState,
  purchaseCosmetic,
  XP_PER_STEP,
} from './services/gamification'
import { generateLearningPlanWithStatus } from './services/learningPlanGenerator'
import {
  createLearningPlanId,
  learningBlockerOptions,
  type EnergyLevel,
  type LearningBlocker,
  type LearningPlan,
  type LearningPlanClarification,
  type LearningPlanInput,
  type LearningPlanRequest,
  type LearningStep,
  type LearningStepKind,
} from './types/learningPlan'
import type { GamificationState } from './types/gamification'
import { getStableStepRewardSlot, preserveStepProgress } from './services/learningPlanProgress'

type FormSettings = LearningPlanInput
type SavedAppState = { form: FormSettings; mission: LearningPlan | null; remainingSeconds: number }
type PendingClarification = { question: string; input: LearningPlanInput }

const STORAGE_KEY = 'mission.saved-mission.v1'
const energyCopy: Record<EnergyLevel, { label: string; note: string; icon: string }> = {
  low: { label: 'Niedrig', note: 'Sanft starten', icon: '☁' },
  medium: { label: 'Ausgeglichen', note: 'Guter Flow', icon: '◐' },
  high: { label: 'Hoch', note: 'Voll fokussiert', icon: '✳' },
}

const energyLevels = new Set<EnergyLevel>(['low', 'medium', 'high'])
const learningBlockers = new Set<LearningBlocker>(learningBlockerOptions.map(({ value }) => value))
const learningStepKinds = new Set<LearningStepKind>(['learning', 'practice', 'preparation', 'reflection'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeForm(value: unknown, fallback: LearningPlan | null): FormSettings | null {
  if (!isRecord(value)) return fallback ? planToForm(fallback) : null
  const goal = typeof value.goal === 'string' ? value.goal : value.task
  const timeBudgetMinutes = typeof value.timeBudgetMinutes === 'number' ? value.timeBudgetMinutes : value.minutes
  const energyLevel = typeof value.energyLevel === 'string' ? value.energyLevel : value.energy
  const learningBlocker = value.learningBlocker ?? value.blocker ?? null

  if (
    typeof goal !== 'string'
    || typeof timeBudgetMinutes !== 'number'
    || !Number.isFinite(timeBudgetMinutes)
    || typeof energyLevel !== 'string'
    || !energyLevels.has(energyLevel as EnergyLevel)
    || !(learningBlocker === null || (typeof learningBlocker === 'string' && learningBlockers.has(learningBlocker as LearningBlocker)))
  ) {
    return fallback ? planToForm(fallback) : null
  }

  return {
    goal,
    timeBudgetMinutes,
    energyLevel: energyLevel as EnergyLevel,
    learningBlocker: learningBlocker as LearningBlocker | null,
  }
}

function planToForm(plan: LearningPlan): FormSettings {
  return {
    goal: plan.goal,
    timeBudgetMinutes: plan.timeBudgetMinutes,
    energyLevel: plan.energyLevel,
    learningBlocker: plan.learningBlocker,
  }
}

function normalizePlan(value: unknown): LearningPlan | null {
  if (!isRecord(value)) return null
  const id = typeof value.id === 'string' && value.id ? value.id : createLearningPlanId()
  const goal = typeof value.goal === 'string' ? value.goal : value.task
  const timeBudgetMinutes = typeof value.timeBudgetMinutes === 'number' ? value.timeBudgetMinutes : value.minutes
  const energyLevel = typeof value.energyLevel === 'string' ? value.energyLevel : value.energy
  const learningBlocker = value.learningBlocker ?? value.blocker ?? null
  const rawSteps = value.steps

  if (
    typeof goal !== 'string'
    || typeof timeBudgetMinutes !== 'number'
    || !Number.isFinite(timeBudgetMinutes)
    || typeof energyLevel !== 'string'
    || !energyLevels.has(energyLevel as EnergyLevel)
    || !(learningBlocker === null || (typeof learningBlocker === 'string' && learningBlockers.has(learningBlocker as LearningBlocker)))
    || !Array.isArray(rawSteps)
    || rawSteps.length === 0
    || !goal.trim()
  ) {
    return null
  }

  const steps: LearningStep[] = []
  for (const rawStep of rawSteps) {
    if (
      !isRecord(rawStep)
      || typeof rawStep.id !== 'string'
      || typeof rawStep.title !== 'string'
      || typeof rawStep.description !== 'string'
      || typeof rawStep.minutes !== 'number'
      || typeof rawStep.done !== 'boolean'
    ) {
      return null
    }
    const kind = typeof rawStep.kind === 'string' && learningStepKinds.has(rawStep.kind as LearningStepKind)
      ? rawStep.kind as LearningStepKind
      : 'learning'
    steps.push({ ...rawStep, kind } as LearningStep)
  }

  return {
    id,
    goal,
    timeBudgetMinutes,
    energyLevel: energyLevel as EnergyLevel,
    learningBlocker: learningBlocker as LearningBlocker | null,
    steps,
  }
}

function readSavedMission(): SavedAppState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return null
    const parsed: unknown = JSON.parse(saved)
    if (!isRecord(parsed)) return null

    // Lädt sowohl das getrennte Zwischenformat als auch ältere flache Lernpläne.
    const hasSeparatedState = 'form' in parsed || 'mission' in parsed
    const mission = normalizePlan(hasSeparatedState ? parsed.mission : parsed)
    const form = normalizeForm(hasSeparatedState ? parsed.form : parsed, mission)
    if (!form) return null

    const storedSeconds = parsed.remainingSeconds
    return {
      form,
      mission,
      remainingSeconds: typeof storedSeconds === 'number' && Number.isFinite(storedSeconds) && storedSeconds >= 0
        ? storedSeconds
        : (mission?.timeBudgetMinutes ?? 25) * 60,
    }
  } catch {
    return null
  }
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function App() {
  const [saved] = useState(readSavedMission)
  const [task, setTask] = useState(saved?.form.goal ?? '')
  const [minutes, setMinutes] = useState(saved?.form.timeBudgetMinutes ?? 25)
  const [energy, setEnergy] = useState<EnergyLevel>(saved?.form.energyLevel ?? 'medium')
  const [blocker, setBlocker] = useState<LearningBlocker | null>(saved?.form.learningBlocker ?? null)
  const [mission, setMission] = useState<LearningPlan | null>(saved?.mission ?? null)
  const [remainingSeconds, setRemainingSeconds] = useState(saved?.remainingSeconds ?? 25 * 60)
  const [gamification, setGamification] = useState<GamificationState>(loadGamificationState)
  const [rewardNotice, setRewardNotice] = useState<string | null>(null)
  const [missionReward, setMissionReward] = useState<MissionReward | null>(null)
  const [generationNotice, setGenerationNotice] = useState<string | null>(null)
  const [pendingClarification, setPendingClarification] = useState<PendingClarification | null>(null)
  const [clarificationAnswer, setClarificationAnswer] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [deadline, setDeadline] = useState<number | null>(null)

  const steps = mission?.steps ?? []
  const completed = steps.filter((step) => step.done).length
  const progress = steps.length ? Math.round((completed / steps.length) * 100) : 0
  const hasMission = mission !== null

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      form: {
        goal: task,
        timeBudgetMinutes: minutes,
        energyLevel: energy,
        learningBlocker: blocker,
      },
      mission,
      remainingSeconds,
    } satisfies SavedAppState))
  }, [task, minutes, energy, blocker, mission, remainingSeconds])

  useEffect(() => {
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(gamification))
  }, [gamification])

  useEffect(() => {
    if (!isRunning || deadline === null) return
    const interval = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemainingSeconds(next)
      if (next === 0) setIsRunning(false)
    }, 250)
    return () => window.clearInterval(interval)
  }, [isRunning, deadline])

  async function generateAndApplyPlan(input: LearningPlanRequest) {
    const generation = await generateLearningPlanWithStatus(input)
    setGenerationNotice(generation.notice)

    if (generation.clarifyingQuestion && !input.clarification) {
      setPendingClarification({
        question: generation.clarifyingQuestion,
        input: {
          goal: input.goal,
          timeBudgetMinutes: input.timeBudgetMinutes,
          energyLevel: input.energyLevel,
          learningBlocker: input.learningBlocker,
        },
      })
      setClarificationAnswer('')
      return
    }

    const sameMission = mission?.goal.trim() === input.goal.trim()
    const reconciledSteps = preserveStepProgress(
      generation.plan.steps,
      mission?.steps ?? [],
      sameMission,
      mission?.id ?? generation.plan.id,
      gamification.claimedStepRewardKeys,
    )
    setMission({
      ...generation.plan,
      id: sameMission && mission ? mission.id : generation.plan.id,
      steps: reconciledSteps,
    })
    setRemainingSeconds(input.timeBudgetMinutes * 60)
    setIsRunning(false)
    setDeadline(null)
    setPendingClarification(null)
    setClarificationAnswer('')
  }

  async function createMission(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!task.trim() || isGenerating || pendingClarification) return
    setIsGenerating(true)
    try {
      await generateAndApplyPlan({
        goal: task,
        timeBudgetMinutes: minutes,
        energyLevel: energy,
        learningBlocker: blocker,
      })
    } finally {
      setIsGenerating(false)
    }
  }

  async function finishClarification(event: React.FormEvent<HTMLFormElement>, skipped: boolean) {
    event.preventDefault()
    if (!pendingClarification || isGenerating || (!skipped && !clarificationAnswer.trim())) return
    const clarification: LearningPlanClarification = {
      question: pendingClarification.question,
      answer: skipped ? '' : clarificationAnswer.trim(),
      skipped,
    }
    setIsGenerating(true)
    try {
      await generateAndApplyPlan({ ...pendingClarification.input, clarification })
    } finally {
      setIsGenerating(false)
    }
  }

  function toggleStep(id: string) {
    if (!mission) return
    const currentStep = mission.steps.find((step) => step.id === id)
    if (!currentStep) return

    setMission((current) => current ? {
      ...current,
      steps: current.steps.map((step) => step.id === id ? { ...step, done: !step.done } : step),
    } : current)

    if (currentStep.done) return

    const completesMission = mission.steps.every((step) => step.id === id || step.done)
    const stepIndex = mission.steps.findIndex((step) => step.id === id)
    const stepResult = awardStepCompletion(
      gamification,
      mission.id,
      id,
      getStableStepRewardSlot(mission.steps, stepIndex),
    )
    let nextGamification = stepResult.state
    const notices = stepResult.xpAdded > 0 ? [`+${XP_PER_STEP} XP`] : []

    if (completesMission) {
      const missionResult = awardMissionCompletion(nextGamification, mission.id, Math.random())
      nextGamification = missionResult.state
      if (missionResult.awarded && missionResult.orb) {
        const orbStatus = missionResult.orbWasAlreadyOwned ? 'bereits gesammelt' : 'neu freigeschaltet'
        notices.push(`Mission: +${missionResult.xpAdded} XP, +${missionResult.coinsAdded} Coins · ${missionResult.orb.name} ${orbStatus}`)
        setMissionReward({
          xpAdded: stepResult.xpAdded + missionResult.xpAdded,
          coinsAdded: missionResult.coinsAdded,
          orb: missionResult.orb,
          orbWasAlreadyOwned: missionResult.orbWasAlreadyOwned,
        })
      }
    }

    setGamification(nextGamification)
    setRewardNotice(notices.length > 0 ? notices.join(' · ') : 'Belohnung für diesen Schritt bereits erhalten.')
  }

  function handleCosmeticPurchase(itemId: string) {
    const result = purchaseCosmetic(gamification, itemId)
    setGamification(result.state)
    return result.status
  }

  function toggleTimer() {
    if (isRunning) {
      const left = deadline === null ? remainingSeconds : Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemainingSeconds(left)
      setIsRunning(false)
      setDeadline(null)
      return
    }
    const duration = remainingSeconds > 0 ? remainingSeconds : (mission?.timeBudgetMinutes ?? 25) * 60
    setRemainingSeconds(duration)
    setDeadline(Date.now() + duration * 1000)
    setIsRunning(true)
  }

  function resetTimer() {
    setIsRunning(false)
    setDeadline(null)
    setRemainingSeconds((mission?.timeBudgetMinutes ?? 25) * 60)
  }

  return (
    <main className={`app-shell theme-${gamification.selectedBackgroundId}`}>
      <header className="topbar">
        <a className="brand" href="#start" aria-label="Mission Startseite">
          <span className="brand-mark">m<span>.</span></span>
          <span className="brand-name">mission</span>
        </a>
        <div className="topbar-right">
          <span className="local-badge"><span className="status-dot" /> Alles lokal gespeichert</span>
          <span className="avatar" aria-label="Dein Lernbereich">L</span>
        </div>
      </header>

      <section className="intro" id="start">
        <div>
          <p className="eyebrow"><span className="eyebrow-star">✳</span> DEIN FOKUS-RAUM</p>
          <h1>Heute kommst du <span>weiter.</span></h1>
          <p className="intro-copy">Ein Ziel. Kleine Schritte. Ein gutes Gefühl am Ende.</p>
        </div>
        <div className="date-chip"><span className="date-sun">☼</span><span>Deine nächste Lernsession</span></div>
      </section>

      <GamificationPanel
        state={gamification}
        rewardNotice={rewardNotice}
        onEquipOrb={(orbId) => setGamification((current) => equipOrb(current, orbId))}
      />

      <CoinShop
        state={gamification}
        onPurchase={handleCosmeticPurchase}
        onEquip={(itemId) => setGamification((current) => equipCosmetic(current, itemId))}
      />

      <div className="workspace-grid">
        <section className="panel setup-panel" aria-labelledby="setup-heading">
          <div className="panel-heading">
            <div className="heading-icon lavender">✎</div>
            <div>
              <p className="section-kicker">LOS GEHT'S</p>
              <h2 id="setup-heading">Deine Mission</h2>
            </div>
            <span className="step-count">01 <i>/ 02</i></span>
          </div>

          <form onSubmit={(event) => {
            if (pendingClarification) {
              const submitter = (event.nativeEvent as SubmitEvent).submitter
              void finishClarification(event, submitter instanceof HTMLButtonElement && submitter.dataset.skip === 'true')
              return
            }
            void createMission(event)
          }}>
            <label className="field-label" htmlFor="task">Was möchtest du lernen?</label>
            <div className="textarea-wrap">
              <textarea
                id="task"
                value={task}
                onChange={(event) => setTask(event.target.value)}
                placeholder="z. B. Die Grundlagen der objektorientierten Programmierung verstehen …"
                maxLength={280}
                rows={4}
                disabled={pendingClarification !== null || isGenerating}
              />
              <span className="character-count">{task.length}/280</span>
            </div>

            <div className="field-row">
              <label className="field-label" htmlFor="time">Wie viel Zeit hast du?</label>
              <span className="field-hint">in Minuten</span>
            </div>
            <div className="select-wrap">
              <span className="select-icon">◷</span>
              <select id="time" value={minutes} disabled={pendingClarification !== null || isGenerating} onChange={(event) => setMinutes(Number(event.target.value))}>
                {Array.from({ length: 12 }, (_, index) => (index + 1) * 5).map((value) => (
                  <option key={value} value={value}>{value} Minuten</option>
                ))}
              </select>
              <span className="select-chevron">⌄</span>
            </div>

            <fieldset className="energy-fieldset">
              <legend className="field-label">Wie ist dein Energielevel?</legend>
              <div className="energy-options">
                {(Object.keys(energyCopy) as EnergyLevel[]).map((level) => (
                  <button
                    className={`energy-option ${energy === level ? 'selected' : ''}`}
                    type="button"
                    disabled={pendingClarification !== null || isGenerating}
                    key={level}
                    aria-pressed={energy === level}
                    onClick={() => setEnergy(level)}
                  >
                    <span className={`energy-icon energy-${level}`}>{energyCopy[level].icon}</span>
                    <span className="energy-label">{energyCopy[level].label}</span>
                    <span className="energy-note">{energyCopy[level].note}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="field-row">
              <label className="field-label" htmlFor="blocker">Was hindert dich gerade am Lernen?</label>
              <span className="field-hint">optional</span>
            </div>
            <div className="select-wrap">
              <select
                id="blocker"
                className="blocker-select"
                value={blocker ?? ''}
                disabled={pendingClarification !== null || isGenerating}
                onChange={(event) => setBlocker((event.target.value || null) as LearningBlocker | null)}
              >
                <option value="">Keine Auswahl</option>
                {learningBlockerOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <span className="select-chevron">⌄</span>
            </div>

            {!pendingClarification && (
              <button className="primary-button" type="submit" disabled={!task.trim() || isGenerating}>
                <span>{isGenerating ? 'Plan wird erstellt …' : hasMission ? 'Mission aktualisieren' : 'Mission planen'}</span>
                <span className="button-arrow">↗</span>
              </button>
            )}
            {pendingClarification && (
              <section className="clarification-panel" aria-labelledby="clarification-title">
                <p className="section-kicker">EINE KURZE RÜCKFRAGE</p>
                <h3 id="clarification-title">{pendingClarification.question}</h3>
                <label className="field-label" htmlFor="clarification-answer">Deine Antwort <span className="field-hint">optional, max. 120 Zeichen</span></label>
                <textarea
                  id="clarification-answer"
                  value={clarificationAnswer}
                  onChange={(event) => setClarificationAnswer(event.target.value)}
                  maxLength={120}
                  rows={2}
                  autoFocus
                  disabled={isGenerating}
                  placeholder="Ein konkreter Begriff oder Schwerpunkt genügt …"
                />
                <div className="clarification-actions">
                  <button className="primary-button" type="submit" disabled={isGenerating || !clarificationAnswer.trim()}>
                    <span>{isGenerating ? 'Plan wird erstellt …' : 'Antwort senden'}</span>
                    <span className="button-arrow">↗</span>
                  </button>
                  <button className="clarification-skip" type="submit" data-skip="true" disabled={isGenerating}>
                    Überspringen
                  </button>
                  <button className="clarification-cancel" type="button" disabled={isGenerating} onClick={() => {
                    setPendingClarification(null)
                    setClarificationAnswer('')
                    setGenerationNotice('Rückfrage abgebrochen. Dein aktiver Lernplan und Timer bleiben unverändert.')
                  }}>
                    Abbrechen
                  </button>
                </div>
              </section>
            )}
            {generationNotice && <p className="generation-notice" role="status">{generationNotice}</p>}
            <p className="privacy-note"><span>⌑</span> Dein Lernplan bleibt nur auf diesem Gerät.</p>
          </form>
        </section>

        <section className="panel plan-panel" aria-labelledby="plan-heading">
          <div className="panel-heading plan-heading">
            <div className="heading-icon mint">☷</div>
            <div>
              <p className="section-kicker">DEIN FAHRPLAN</p>
              <h2 id="plan-heading">Schritt für Schritt</h2>
            </div>
            {mission && <span className="plan-pill">{mission.timeBudgetMinutes} MIN</span>}
          </div>

          {mission ? (
            <>
              <div className="plan-summary">
                <div className="summary-copy">
                  <span className="summary-label">DEIN LERNZIEL</span>
                  <p>{mission.goal}</p>
                  {mission.learningBlocker && (
                    <span className="summary-label">
                      {learningBlockerOptions.find((option) => option.value === mission.learningBlocker)?.label}
                    </span>
                  )}
                </div>
                <span className="summary-sparkle">✳</span>
              </div>

              <div className="steps-list">
                {steps.map((step, index) => (
                  <label className={`task-step ${step.done ? 'is-done' : ''}`} key={step.id}>
                    <input type="checkbox" checked={step.done} onChange={() => toggleStep(step.id)} />
                    <span className="custom-checkbox" aria-hidden="true">{step.done ? '✓' : ''}</span>
                    <span className="step-content">
                      <span className="step-title">{step.title}</span>
                      <span className="step-description">{step.description}</span>
                    </span>
                    <span className="step-duration">{step.minutes} min</span>
                    {index < steps.length - 1 && <span className="step-connector" aria-hidden="true" />}
                  </label>
                ))}
              </div>

              <div className="progress-section">
                <div className="progress-copy"><span>Dein Fortschritt</span><strong>{completed} von {steps.length} erledigt</strong></div>
                <div className="progress-track" role="progressbar" aria-label="Lernfortschritt" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>
            </>
          ) : (
            <div className="empty-plan">
              <div className="empty-illustration"><span className="empty-sun">✳</span><span className="empty-page">☷</span></div>
              <h3>Dein nächster Schritt<br />beginnt hier.</h3>
              <p>Beschreib dein Lernziel und wir teilen es in machbare Etappen auf.</p>
              <span className="empty-hint">Dein Plan erscheint genau hier <span>↓</span></span>
            </div>
          )}
        </section>
      </div>

      <section className="timer-panel" aria-label="Lern-Timer">
        <div className="timer-message">
          <div className="timer-icon">◷</div>
          <div><p className="section-kicker">BLEIB IM FLOW</p><h2>Zeit für deinen Fokus.</h2></div>
        </div>
        <div className="timer-clock" aria-live="polite" aria-label={`Verbleibende Zeit: ${formatTime(remainingSeconds)}`}>
          <span>{formatTime(remainingSeconds)}</span><small>MIN : SEK</small>
        </div>
        <div className="timer-controls">
          <button className="timer-button" type="button" onClick={toggleTimer}>
            <span>{isRunning ? 'Ⅱ' : '▶'}</span>{isRunning ? 'Pause' : remainingSeconds === 0 ? 'Weiter' : 'Start'}
          </button>
          <button className="reset-button" type="button" onClick={resetTimer} aria-label="Timer zurücksetzen" title="Timer zurücksetzen">↺</button>
        </div>
        <p className="timer-encouragement"><span>✦</span> Kleine Schritte zählen.</p>
      </section>

      <footer className="footer"><span>MISSION <i>·</i> DEIN LERNWEG, IN DEINEM TEMPO.</span><span>Mit Ruhe. Mit Fokus. Mit dir.</span></footer>
      {missionReward && <MissionRewardDialog reward={missionReward} onClose={() => setMissionReward(null)} />}
    </main>
  )
}

export default App
