import { getEquippedOrb } from './services/prestigeOrbs'
import LearningHistory from './components/LearningHistory'
import MobileNavigation, { mobileAreaLabels, type MobileArea } from './components/MobileNavigation'
import useMobileLayout from './services/useMobileLayout'
import PwaStatus, { usePwaStatus } from './components/PwaStatus'
import LearningStatistics from './components/LearningStatistics'
import { STATISTICS_STORAGE_KEY, loadStatistics, prepareFocusBooking, reconcileStatistics, countStatisticsSession, validGoals, type LearningStatistics as Statistics, type StatisticsGoals } from './services/learningStatistics'
import { advanceFocusBlocks, createFocusBlocks, restoreFocusBlocks, intervals, readFocusStrategy, skipFocusBreak, blockSummary, strategyLabel, type FocusBlocks } from './services/focusBlocks'
import LearningContextFields from './components/LearningContextFields'
import { readLearningContext, validateLearningContext, type LearningContext } from '../shared/learningContext.mjs'
import MissionLibrary from './components/MissionLibrary'
import SpotlightTour from './components/SpotlightTour'
import UiIcon from './components/UiIcon'
import { saveTourStatus, shouldOfferTour, type TourStatus } from './services/onboarding'
import PrestigePanel from './components/PrestigePanel'
import { measureOrb, type OrbOrigin } from './services/focusTransition'
import FocusEnvironmentPicker from './components/FocusEnvironmentPicker'
import { loadFocusEnvironment, saveFocusEnvironment, type FocusEnvironment } from './services/focusEnvironment'
import OrbCollectionDialog from './components/OrbCollectionDialog'
import { normalizeHistory, normalizeActiveSession, finishLearningSession, type SessionHistoryEntry, type ActiveLearningSession } from './services/learningHistory'
import PlanEditor from './components/PlanEditor'
import { applyPlanTiming } from './services/planEditor'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import OrbCrateShop from './components/OrbCrateShop'
import GamificationPanel from './components/GamificationPanel'
import MissionRewardDialog from './components/MissionRewardDialog'
import FocusMode from './components/FocusMode'
import { defaultOrb } from './services/orbCatalog'
import {
  recordMissionCompletion,
  addFocusTime,
  recordStepCompletion,
  equipOrb,
  getLevel,
  GAMIFICATION_STORAGE_KEY,
  loadGamificationState,
  purchaseOrbCrate,
  type CratePurchaseResult,
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
import { acquireMissionWriter, advanceFocusSession, type FocusSession } from './services/focusTimer'
import type { GamificationState } from './types/gamification'
import { getStableStepRewardSlot, preserveStepProgress } from './services/learningPlanProgress'
import { isLocalDevelopment } from './services/developmentMode'

// Vite removes the dynamic import and its entire module from production builds.
const GamificationDebug = import.meta.env.DEV ? lazy(() => import('./components/GamificationDebug')) : null

type FormSettings = LearningPlanInput
type SavedAppState = { form: FormSettings; mission: LearningPlan | null; remainingSeconds: number; elapsedSeconds?: number; history?: SessionHistoryEntry[]; activeSession?: ActiveLearningSession | null; focusBlocks?: FocusBlocks | null }
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
    ...(typeof value.learningBlockerDetails === 'string' && value.learningBlockerDetails.length <= 240 ? { learningBlockerDetails: value.learningBlockerDetails } : {}),
    ...(readLearningContext(value.learningContext) !== undefined ? { learningContext: readLearningContext(value.learningContext) } : {}),
  }
}

function planToForm(plan: LearningPlan): FormSettings {
  return {
    goal: plan.goal,
    timeBudgetMinutes: plan.timeBudgetMinutes,
    energyLevel: plan.energyLevel,
    learningBlocker: plan.learningBlocker,
    learningBlockerDetails: plan.learningBlockerDetails,
    learningContext: readLearningContext(plan.learningContext),
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
    timeMode: value.timeMode === 'automatic' || value.timeMode === 'stopwatch' ? value.timeMode : 'manual',
    ...(value.focusStrategy !== undefined ? { focusStrategy: readFocusStrategy(value.focusStrategy) } : {}),
    ...(typeof value.learningBlockerDetails === 'string' && value.learningBlockerDetails.length <= 240 ? { learningBlockerDetails: value.learningBlockerDetails } : {}),
    ...(readLearningContext(value.learningContext) !== undefined ? { learningContext: readLearningContext(value.learningContext) } : {}),
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
    const history = normalizeHistory(parsed.history)
    return {
      form,
      history,
      activeSession: normalizeActiveSession(parsed.activeSession, history),
      mission,
      focusBlocks: mission?.timeMode === 'stopwatch' ? null : restoreFocusBlocks(parsed.focusBlocks, typeof storedSeconds === 'number' && Number.isFinite(storedSeconds) && storedSeconds >= 0 ? storedSeconds : (mission?.timeBudgetMinutes ?? 25) * 60, mission?.focusStrategy),
      elapsedSeconds: typeof parsed.elapsedSeconds === 'number' && Number.isFinite(parsed.elapsedSeconds) && parsed.elapsedSeconds >= 0 ? parsed.elapsedSeconds : Math.max(0, (mission?.timeBudgetMinutes ?? 25) * 60 - (typeof storedSeconds === 'number' ? storedSeconds : (mission?.timeBudgetMinutes ?? 25) * 60)),
      remainingSeconds: typeof storedSeconds === 'number' && Number.isFinite(storedSeconds) && storedSeconds >= 0
        ? storedSeconds
        : (mission?.timeBudgetMinutes ?? 25) * 60,
    }
  } catch {
    return null
  }
}

function formatTime(totalSeconds: number) {
  totalSeconds = Math.ceil(totalSeconds)
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function App() {
  const pwaStatus = usePwaStatus()
  const isMobile = useMobileLayout()
  const [mobileArea, setMobileArea] = useState<MobileArea>('home')
  const mobileHeading = useRef<HTMLHeadingElement>(null)
  const navigationOrb = useRef<HTMLDivElement>(null)
  const navigationFocus = useRef<HTMLButtonElement>(null)
  const [tourOffer, setTourOffer] = useState(shouldOfferTour)
  const [tourOpen, setTourOpen] = useState(false)
  const setupTarget = useRef<HTMLElement>(null)
  const planTarget = useRef<HTMLElement>(null)
  const timerTarget = useRef<HTMLElement>(null)
  const coreTarget = useRef<HTMLElement>(null)
  const cratesTarget = useRef<HTMLElement>(null)
  const tourTargets = useRef([setupTarget, planTarget, timerTarget, coreTarget, cratesTarget])
  const tourHelp = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (tourOffer) saveTourStatus('offered') }, [tourOffer])
  function closeTour(status: TourStatus) {
    saveTourStatus(status)
    setTourOpen(false)
    tourHelp.current?.focus()
  }
  const dashboardOrb = useRef<HTMLDivElement>(null)
  const orbOrigin = useRef<OrbOrigin | null>(null)
  const [focusEnvironment, setFocusEnvironment] = useState(loadFocusEnvironment)
  const [environmentNotice, setEnvironmentNotice] = useState<string | null>(null)
  function changeFocusEnvironment(value: FocusEnvironment) {
    setFocusEnvironment(value)
    setEnvironmentNotice(saveFocusEnvironment(value) ? null : 'Die Umgebung gilt für diesen Besuch, konnte aber nicht gespeichert werden.')
  }
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [saved] = useState(readSavedMission)
  const [history, setHistory] = useState(saved?.history ?? [])
  const [hasActiveSession, setHasActiveSession] = useState(Boolean(saved?.activeSession))
  const [task, setTask] = useState(saved?.form.goal ?? '')
  const [minutes, setMinutes] = useState(saved?.form.timeBudgetMinutes ?? 25)
  const [energy, setEnergy] = useState<EnergyLevel>(saved?.form.energyLevel ?? 'medium')
  const [blocker, setBlocker] = useState<LearningBlocker | null>(saved?.form.learningBlocker ?? null)
  const [blockerDetails, setBlockerDetails] = useState(saved?.form.learningBlockerDetails ?? '')
  const [learningContext, setLearningContext] = useState<LearningContext | undefined>(saved?.form.learningContext)
  const [elapsedSeconds, setElapsedSeconds] = useState(saved?.elapsedSeconds ?? 0)
  const [editingPlan, setEditingPlan] = useState<LearningPlan | null>(null)
  const [templateSaveRequest, setTemplateSaveRequest] = useState<LearningPlan | null>(null)
  const [templateOrigin, setTemplateOrigin] = useState<'custom' | 'ai'>('custom')
  const [mission, setMission] = useState<LearningPlan | null>(saved?.mission ?? null)
  const [remainingSeconds, setRemainingSeconds] = useState(saved?.remainingSeconds ?? 25 * 60)
  const [gamification, setGamification] = useState<GamificationState>(loadGamificationState)
  const [displayLevelOverride, setDisplayLevelOverride] = useState<number | null>(null)
  const actualPlayerLevel = getLevel(gamification.totalFocusMilliseconds / 60000)
  const effectiveDisplayLevel = import.meta.env.DEV && isLocalDevelopment(import.meta.env.DEV, window.location.hostname)
    ? displayLevelOverride ?? actualPlayerLevel : actualPlayerLevel
  const [statistics, setStatistics] = useState(() => loadStatistics(gamification.totalFocusMilliseconds))
  const statisticsRef = useRef(statistics)
  const focusWallAnchor = useRef(0)
  const [rewardNotice, setRewardNotice] = useState<string | null>(null)
  const [showMissionCompletion, setShowMissionCompletion] = useState(false)
  const [generationNotice, setGenerationNotice] = useState<string | null>(null)
  const [pendingClarification, setPendingClarification] = useState<PendingClarification | null>(null)
  const [clarificationAnswer, setClarificationAnswer] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const normalTimerButton = useRef<HTMLButtonElement>(null)
  const hasEnteredFocus = useRef(false)
  const [canWrite, setCanWrite] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const writer = useRef(false)
  const [focusBlocks, setFocusBlocks] = useState<FocusBlocks | null>(saved?.focusBlocks ?? null)
  const blocksRef = useRef(focusBlocks)
  function updateBlocks(value: FocusBlocks | null) { blocksRef.current = value; setFocusBlocks(value); appSnapshot.current = { ...appSnapshot.current, focusBlocks: value } }
  const session = useRef<FocusSession | null>(null)
  const game = useRef(gamification)
  const appSnapshot = useRef<SavedAppState>({ focusBlocks: saved?.focusBlocks ?? null, history: saved?.history ?? [], activeSession: saved?.activeSession ?? null, form: { ...(learningContext !== undefined ? { learningContext } : {}), goal: task, timeBudgetMinutes: minutes, energyLevel: energy, learningBlocker: blocker, ...(blocker === 'other' ? { learningBlockerDetails: blockerDetails } : {}) }, mission, remainingSeconds, elapsedSeconds })
  const stopRef = useRef<() => void>(() => {})

  function commitGamification(next: GamificationState) {
    if (!writer.current) return
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(next))
    game.current = next
    setGamification(next)
  }

  function settleTimer() {
    if (!writer.current || !session.current) return
    const advanced = advanceFocusSession(session.current, performance.now())
    const block = blocksRef.current
    const transition = block ? advanceFocusBlocks(block, advanced.elapsedMilliseconds, appSnapshot.current.remainingSeconds, readFocusStrategy(appSnapshot.current.mission?.focusStrategy)) : null
    const earned = transition?.focusMilliseconds ?? advanced.elapsedMilliseconds
    if (earned > 0) {
      const next = addFocusTime(game.current, earned)
      commitStatistics(prepareFocusBooking(statisticsRef.current, game.current.totalFocusMilliseconds, next.totalFocusMilliseconds, focusWallAnchor.current))
      commitGamification(next)
      commitStatistics(reconcileStatistics(statisticsRef.current, next.totalFocusMilliseconds))
    }
    focusWallAnchor.current += advanced.elapsedMilliseconds
    session.current = advanced.session
    const seconds = transition?.remainingSeconds ?? advanced.session.remainingMilliseconds / 1000
    const elapsed = (appSnapshot.current.elapsedSeconds ?? 0) + earned / 1000
    setElapsedSeconds(elapsed)
    if (transition) updateBlocks(transition.blocks)
    const active = appSnapshot.current.activeSession
    appSnapshot.current = { ...appSnapshot.current, remainingSeconds: seconds, elapsedSeconds: elapsed,
      activeSession: active ? { ...active, focusSeconds: active.focusSeconds + earned / 1000,
        ...(appSnapshot.current.mission?.focusStrategy ? { focusStrategy: readFocusStrategy(appSnapshot.current.mission.focusStrategy) } : {}),
        ...(transition && block ? { completedFocusBlocks: (active.completedFocusBlocks ?? 0) + transition.blocks.completedBlocks - block.completedBlocks, breakSeconds: (active.breakSeconds ?? 0) + (block.phase === 'break' ? advanced.elapsedMilliseconds / 1000 : 0) } : {}) } : null }
    if (!advanced.session.stopwatch && seconds === 0) finalizeSession('completed')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSnapshot.current))
    setRemainingSeconds(seconds)
    if (transition?.boundary || (!advanced.session.stopwatch && seconds === 0)) { session.current = null; setIsRunning(false) }
  }

  function finalizeSession(status: SessionHistoryEntry['status']) {
    const active = appSnapshot.current.activeSession
    if (!writer.current || !active) return
    const currentPlan = appSnapshot.current.mission
    const snapshot = currentPlan?.id === active.missionId ? { ...active,
      completedSteps: currentPlan.steps.filter(s => s.done).length, totalSteps: currentPlan.steps.length } : active
    const endedAt = new Date(Math.max(Date.now(), Date.parse(active.startedAt))).toISOString()
    const next = finishLearningSession(appSnapshot.current.history ?? [], snapshot, status, endedAt)
    if (next.some(entry => entry.id === active.id) && !(appSnapshot.current.history ?? []).some(entry => entry.id === active.id)) {
      commitStatistics(countStatisticsSession(statisticsRef.current, active.id, status))
    }
    appSnapshot.current = { ...appSnapshot.current, history: next, activeSession: null }
    setHistory(next)
    setHasActiveSession(false)
  }

  function endLearningSession(status: SessionHistoryEntry['status'] = 'ended_early') {
    if (!writer.current || !appSnapshot.current.activeSession) return
    try {
      stopTimer()
      finalizeSession(status)
      setElapsedSeconds(0)
      updateBlocks(null)
      const duration = mission?.timeMode === 'stopwatch' ? 0 : (mission?.timeBudgetMinutes ?? 25) * 60
      setRemainingSeconds(duration)
      appSnapshot.current = { ...appSnapshot.current, remainingSeconds: duration, elapsedSeconds: 0 }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appSnapshot.current))
      setIsFocusMode(false)
    } catch { failStorage() }
  }

  function stopTimer() {
    settleTimer()
    session.current = null
    setIsRunning(false)
  }
  stopRef.current = stopTimer

  function commitStatistics(next: Statistics) {
    if (!writer.current) return
    localStorage.setItem(STATISTICS_STORAGE_KEY, JSON.stringify(next))
    statisticsRef.current = next
    setStatistics(next)
  }
  function changeGoals(goals: StatisticsGoals) {
    if (!writer.current || !validGoals(goals)) return
    try { commitStatistics({ ...statisticsRef.current, goals: { ...goals } }) } catch { failStorage() }
  }

  const steps = mission?.steps ?? []
  const completed = steps.filter((step) => step.done).length
  const progress = steps.length ? Math.round((completed / steps.length) * 100) : 0
  const hasMission = mission !== null

  useEffect(() => {
    if (isFocusMode) hasEnteredFocus.current = true
    else if (hasEnteredFocus.current) (isMobile ? navigationFocus.current : normalTimerButton.current)?.focus()
  }, [isFocusMode])
  useEffect(() => {
    if (!isMobile || isFocusMode || tourOpen) return
    mobileHeading.current?.focus({ preventScroll: true })
    mobileHeading.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  }, [mobileArea, isMobile])

  function failStorage() {
    session.current = null
    writer.current = false
    setCanWrite(false)
    setIsRunning(false)
    setStorageError('Die lokale Speicherung ist nicht verfügbar. Der Timer wurde pausiert; Änderungen sind gesperrt.')
  }

  useEffect(() => {
    const active = appSnapshot.current.activeSession
    const activePlan = mission?.id === active?.missionId ? mission : appSnapshot.current.mission
    if (active && activePlan?.id === active.missionId) {
      appSnapshot.current = { ...appSnapshot.current, activeSession: { ...active,
        completedSteps: activePlan.steps.filter(s => s.done).length, totalSteps: activePlan.steps.length } }
    }
    const snapshot = { ...appSnapshot.current, focusBlocks, form: { ...(learningContext !== undefined ? { learningContext } : {}), goal: task, timeBudgetMinutes: minutes, energyLevel: energy, learningBlocker: blocker, ...(blocker === 'other' ? { learningBlockerDetails: blockerDetails } : {}) }, mission, remainingSeconds, elapsedSeconds }
    appSnapshot.current = snapshot
    if (!canWrite || !writer.current) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)) } catch { failStorage() }
  }, [task, minutes, energy, blocker, blockerDetails, learningContext, mission, remainingSeconds, elapsedSeconds, focusBlocks, canWrite])

  useEffect(() => {
    const hydrate = () => {
      const latest = readSavedMission()
      if (latest) {
        setTask(latest.form.goal)
        setMinutes(latest.form.timeBudgetMinutes)
        setEnergy(latest.form.energyLevel)
        setBlocker(latest.form.learningBlocker)
        setBlockerDetails(latest.form.learningBlockerDetails ?? '')
        setLearningContext(latest.form.learningContext)
        updateBlocks(latest.focusBlocks ?? null)
        setElapsedSeconds(latest.elapsedSeconds ?? 0)
        setMission(latest.mission)
        setRemainingSeconds(latest.remainingSeconds)
        setEditingPlan(null)
        appSnapshot.current = latest
        setHistory(latest.history ?? [])
        setHasActiveSession(Boolean(latest.activeSession))
      }
      game.current = loadGamificationState(true)
      setGamification(game.current)
      statisticsRef.current = loadStatistics(game.current.totalFocusMilliseconds, true)
      setStatistics(statisticsRef.current)
    }
    const sync = () => {
      if (!writer.current) {
        try { hydrate() } catch { failStorage() }
      }
    }
    window.addEventListener('storage', sync)
    if (!navigator.locks) {
      setStorageError('Dieser Browser unterstützt keine sichere Tab-Sperre. Bitte öffne Mission in einem aktuellen Browser unter HTTPS oder localhost.')
      return () => window.removeEventListener('storage', sync)
    }
    const release = acquireMissionWriter(navigator.locks, () => {
      try {
        hydrate()
        writer.current = true
        commitGamification(game.current)
        commitStatistics(statisticsRef.current)
        setCanWrite(true)
      } catch { failStorage() }
    }, failStorage)
    const leave = () => {
      if (writer.current) {
        try { stopRef.current() } catch { failStorage() }
      }
      writer.current = false
      setCanWrite(false)
      release()
    }
    window.addEventListener('pagehide', leave)
    const returnFromCache = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload() }
    window.addEventListener('pageshow', returnFromCache)
    return () => {
      leave()
      window.removeEventListener('storage', sync)
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('pageshow', returnFromCache)
    }
  }, [])

  useEffect(() => {
    if (!isRunning) return
    const interval = window.setInterval(() => {
      try { settleTimer() } catch { failStorage() }
    }, 250)
    return () => window.clearInterval(interval)
  }, [isRunning])

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
          learningBlockerDetails: input.learningBlockerDetails,
          ...(input.learningContext !== undefined ? { learningContext: readLearningContext(input.learningContext) } : {}),
        },
      })
      setClarificationAnswer('')
      return
    }

    if (!writer.current) return
    if (session.current && !window.confirm('Laufende Session pausieren und Lernplan ersetzen? Verdiente Fokuszeit bleibt erhalten.')) return
    stopTimer()
    updateBlocks(null)
    setElapsedSeconds(0)
    updateBlocks(null)
    setTemplateOrigin(generation.source === 'groq' ? 'ai' : 'custom')
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
      ...(input.learningBlockerDetails !== undefined ? { learningBlockerDetails: input.learningBlockerDetails } : {}),
      id: sameMission && mission ? mission.id : generation.plan.id,
      steps: reconciledSteps,
    })
    setRemainingSeconds(input.timeBudgetMinutes * 60)
    setIsRunning(false)
    setIsFocusMode(false)
    setPendingClarification(null)
    setClarificationAnswer('')
  }

  async function createMission(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!writer.current || !task.trim() || isGenerating || pendingClarification) return
    if (learningContext !== undefined && !validateLearningContext(learningContext)) { setGenerationNotice('Bitte prüfe den optionalen Lernkontext.'); return }
    setIsGenerating(true)
    try {
      await generateAndApplyPlan({
        goal: task,
        timeBudgetMinutes: minutes,
        energyLevel: energy,
        learningBlocker: blocker,
        ...(blocker === 'other' ? { learningBlockerDetails: blockerDetails.trim() } : {}),
        ...(learningContext !== undefined ? { learningContext: readLearningContext(learningContext) } : {}),
      })
    } finally {
      setIsGenerating(false)
    }
  }

  async function finishClarification(event: React.FormEvent<HTMLFormElement>, skipped: boolean) {
    event.preventDefault()
    if (!writer.current || !pendingClarification || isGenerating || (!skipped && !clarificationAnswer.trim())) return
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
    if (!writer.current || !mission) return
    const currentStep = mission.steps.find((step) => step.id === id)
    if (!currentStep) return

    setMission((current) => current ? {
      ...current,
      steps: current.steps.map((step) => step.id === id ? { ...step, done: !step.done } : step),
    } : current)

    if (currentStep.done) return

    const completesMission = mission.steps.every((step) => step.id === id || step.done)
    const stepIndex = mission.steps.findIndex((step) => step.id === id)
    const next = recordStepCompletion(game.current, mission.id, id, getStableStepRewardSlot(mission.steps, stepIndex))
    const firstCompletion = completesMission && !next.claimedMissionIds.includes(mission.id)
    commitGamification(completesMission ? recordMissionCompletion(next, mission.id) : next)
    if (firstCompletion) setShowMissionCompletion(true)
    setRewardNotice('Level und Coins wachsen ausschließlich durch laufende Fokuszeit.')
  }

  function handleCratePurchase(purchaseId: string): CratePurchaseResult {
    const unavailable: CratePurchaseResult = { state: game.current, status: 'unavailable', orb: null, duplicate: false }
    if (!writer.current) return unavailable
    const result = purchaseOrbCrate(game.current, purchaseId, Math.random(), Math.random())
    if (result.status !== 'purchased') return result
    try { commitGamification(result.state); return result } catch { failStorage(); return unavailable }
  }

  function saveEditedPlan(plan: LearningPlan) {
    if (!writer.current) return
    if (session.current && !window.confirm('Laufende Session pausieren und diese Änderungen übernehmen? Verdiente Fokuszeit bleibt erhalten.')) return
    try {
      stopTimer()
      const elapsed = plan.id === mission?.id ? (appSnapshot.current.elapsedSeconds ?? 0) : 0
      const steps = plan.steps.map(step => {
        const current = plan.id === mission?.id ? mission.steps.find(s => s.id === step.id) : undefined
        return current ? { ...step, done: current.done } : step
      })
      const next = applyPlanTiming({ ...plan, steps }, elapsed)
      if (plan.id !== mission?.id) setTemplateOrigin('custom')
      const sameStrategy = JSON.stringify(readFocusStrategy(plan.focusStrategy)) === JSON.stringify(readFocusStrategy(mission?.focusStrategy))
      const sameDuration = next.remainingSeconds === appSnapshot.current.remainingSeconds
      updateBlocks(plan.timeMode === 'stopwatch' ? null : sameStrategy && sameDuration && plan.id === mission?.id
        ? restoreFocusBlocks(blocksRef.current, next.remainingSeconds, plan.focusStrategy)
        : createFocusBlocks(next.remainingSeconds, plan.focusStrategy, plan.id === mission?.id ? blocksRef.current ?? undefined : undefined))
      setMission(next.plan)
      setRemainingSeconds(next.remainingSeconds)
      setElapsedSeconds(elapsed)
      appSnapshot.current = { ...appSnapshot.current, mission: next.plan, remainingSeconds: next.remainingSeconds, elapsedSeconds: elapsed }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appSnapshot.current))
      setEditingPlan(null)
      setGenerationNotice('Dein bearbeiteter Plan wurde lokal gespeichert.')
    } catch { failStorage() }
  }

  function createOwnPlan() {
    if (!writer.current || pendingClarification || isGenerating) return
    if (learningContext !== undefined && !validateLearningContext(learningContext)) { setGenerationNotice('Bitte prüfe den optionalen Lernkontext.'); return }
    setEditingPlan({ id: createLearningPlanId(), goal: task, timeBudgetMinutes: minutes, energyLevel: energy, learningBlocker: blocker,
      ...(blocker === 'other' ? { learningBlockerDetails: blockerDetails.trim() } : {}), ...(learningContext !== undefined ? { learningContext: readLearningContext(learningContext) } : {}), timeMode: 'automatic',
      steps: [{ id: createLearningPlanId(), title: '', description: '', minutes: 5, kind: 'learning', done: false }] })
  }

  function toggleTimer() {
    if (!writer.current) return
    if (session.current) { stopTimer(); return }
    if (!isFocusMode) orbOrigin.current = measureOrb(dashboardOrb.current, gamification.equippedOrbId ?? defaultOrb.id)
    if (mission?.timeMode !== 'stopwatch' && (!blocksRef.current || remainingSeconds === 0)) updateBlocks(createFocusBlocks(remainingSeconds > 0 ? remainingSeconds : (mission?.timeBudgetMinutes ?? 25) * 60, mission?.focusStrategy))
    const duration = mission?.timeMode === 'stopwatch' ? 0 : remainingSeconds > 0 ? remainingSeconds : (mission?.timeBudgetMinutes ?? 25) * 60
    if (remainingSeconds === 0 && mission?.timeMode !== 'stopwatch') {
      setElapsedSeconds(0)
      appSnapshot.current = { ...appSnapshot.current, elapsedSeconds: 0 }
    }
    if (!appSnapshot.current.activeSession) {
      const currentPlan = appSnapshot.current.mission
      appSnapshot.current = { ...appSnapshot.current, activeSession: {
        id: crypto.randomUUID(), startedAt: new Date().toISOString(),
        missionId: currentPlan?.id ?? null, goal: currentPlan?.goal ?? 'Freie Fokuszeit', focusSeconds: 0,
        plannedSeconds: currentPlan?.timeMode === 'stopwatch' ? null : (currentPlan?.timeBudgetMinutes ?? 25) * 60,
        timeMode: currentPlan?.timeMode ?? 'manual',
        completedSteps: currentPlan?.steps.filter(s => s.done).length ?? 0, totalSteps: currentPlan?.steps.length ?? 0,
      } }
      setHasActiveSession(true)
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appSnapshot.current)) } catch { failStorage(); return }
    focusWallAnchor.current = Date.now()
    session.current = { lastTime: performance.now(), remainingMilliseconds: blocksRef.current?.remainingMilliseconds ?? duration * 1000, stopwatch: mission?.timeMode === 'stopwatch' }
    setRemainingSeconds(duration)
    setIsRunning(true)
    setIsFocusMode(true)
  }

  function resetTimer() {
    if (!writer.current) return
    try {
      stopTimer()
      const duration = mission?.timeMode === 'stopwatch' ? 0 : (mission?.timeBudgetMinutes ?? 25) * 60
      updateBlocks(mission?.timeMode === 'stopwatch' ? null : createFocusBlocks(duration, mission?.focusStrategy))
      setElapsedSeconds(0)
      setRemainingSeconds(duration)
      appSnapshot.current = { ...appSnapshot.current, remainingSeconds: duration, elapsedSeconds: 0 }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appSnapshot.current))
    } catch { failStorage() }
  }

  function skipBreak() {
    if (!writer.current || blocksRef.current?.phase !== 'break') return
    try {
      stopTimer()
      if (blocksRef.current?.phase === 'break') updateBlocks(skipFocusBreak(blocksRef.current, appSnapshot.current.remainingSeconds, readFocusStrategy(mission?.focusStrategy)))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appSnapshot.current))
    } catch { failStorage() }
  }
  function blockStatus() {
    if (!focusBlocks) return ''
    const blockSeconds = (intervals(mission?.focusStrategy)?.focus ?? 1) / 1000
    const pending = focusBlocks.phase === 'focus' ? 1 + Math.ceil(Math.max(0, remainingSeconds - focusBlocks.remainingMilliseconds / 1000) / blockSeconds) : Math.ceil(remainingSeconds / blockSeconds)
    return `${focusBlocks.phase === 'break' ? 'Pause' : focusBlocks.phase === 'finished' ? 'Beendet' : 'Fokus'} · Block ${focusBlocks.block} von ${focusBlocks.completedBlocks + pending}`
  }
  function leaveFocusMode() {
    try { stopTimer() } catch { failStorage() }
    setIsFocusMode(false)
  }
  function openMobileFocus() {
    if (tourOpen) return
    if (!mission) { setMobileArea('plan'); return }
    orbOrigin.current = measureOrb(navigationOrb.current, getEquippedOrb(gamification).id)
    setIsFocusMode(true)
  }
  const hideMobile = (area: MobileArea) => isMobile && !tourOpen && mobileArea !== area

  if (isFocusMode) return (
    <>
      <FocusMode mission={mission} orb={getEquippedOrb(gamification)}
        pwaStatus={<PwaStatus status={pwaStatus} />}
        orbOrigin={orbOrigin.current}
        environment={focusEnvironment} onEnvironmentChange={changeFocusEnvironment} environmentNotice={environmentNotice}
        level={effectiveDisplayLevel}
        countdown={formatTime(focusBlocks ? focusBlocks.remainingMilliseconds / 1000 : mission?.timeMode === 'stopwatch' ? elapsedSeconds : remainingSeconds)} stopwatch={mission?.timeMode === 'stopwatch'} isRunning={isRunning} finished={mission?.timeMode !== 'stopwatch' && remainingSeconds === 0}
        phase={focusBlocks?.phase} blockLabel={focusBlocks ? blockStatus() : undefined} onSkipBreak={focusBlocks?.phase === 'break' ? skipBreak : undefined}
        enabled={canWrite} error={storageError} onToggleTimer={toggleTimer} onResetTimer={resetTimer}
        onEditPlan={mission ? () => { setEditingPlan(mission); if (isMobile) setMobileArea('plan'); setIsFocusMode(false) } : undefined}
        onEndSession={hasActiveSession ? () => endLearningSession() : undefined}
        onCompleteSession={hasActiveSession ? () => endLearningSession('completed') : undefined}
        onToggleStep={toggleStep} onLeave={leaveFocusMode} />
      {showMissionCompletion && <MissionRewardDialog onClose={() => setShowMissionCompletion(false)} />}
    </>
  )

  return (
    <>
    <fieldset className="mission-writer-surface" disabled={!canWrite} onClickCapture={event => {
      if (tourOpen && !(event.target instanceof Element && event.target.closest('[data-tour-controls]'))) { event.preventDefault(); event.stopPropagation() }
    }} onChangeCapture={event => {
      if (tourOpen) { event.preventDefault(); event.stopPropagation() }
    }} onSubmitCapture={event => {
      if (tourOpen) { event.preventDefault(); event.stopPropagation() }
    }}>
    {!canWrite && <p role="status" className="writer-notice">{storageError ?? 'Mission ist in einem anderen Tab aktiv. Dieser Tab zeigt den gespeicherten Stand und übernimmt nach dessen Schließen.'}</p>}
    <main data-mobile-area={isMobile ? mobileArea : undefined} className={`app-shell theme-${gamification.selectedBackgroundId} ${hasEnteredFocus.current ? 'focus-return' : ''}`}>
      <header className="topbar">
        <a className="brand" href="#start" aria-label="Mission Startseite" onClick={event => { if (isMobile) { event.preventDefault(); setMobileArea('home') } }}>
          <span className="brand-mark">m<span>.</span></span>
          <span className="brand-name">mission</span>
        </a>
        <div className="topbar-right">
          <button ref={tourHelp} className="focus-leave tour-help" type="button" aria-label="Mission-Tour starten" title="Mission kennenlernen"
            disabled={isRunning} onClick={() => { setTourOffer(false); setTourOpen(true) }}><UiIcon name="help" /></button>
          <span className="local-badge"><span className="status-dot" /> Alles lokal gespeichert</span>
          <span className="avatar" aria-label="Dein Lernbereich">L</span>
        </div>
      </header>
      <PwaStatus status={pwaStatus} />
      {isMobile && <h1 ref={mobileHeading} tabIndex={-1} className="mobile-area-heading">{mobileAreaLabels[mobileArea]}</h1>}
      {isMobile && <section hidden={hideMobile('home')} className="mobile-mission-summary" aria-label="Heutige Mission">
        <p className="section-kicker">DEINE MISSION HEUTE</p><h2>{mission?.goal ?? 'Bereit für deine nächste Mission?'}</h2>
        <p>{isRunning ? 'Fokuszeit läuft' : hasActiveSession ? 'Session pausiert – dein Fortschritt bleibt erhalten.' : 'Dein Timer ist bereit.'}</p>
        <button className="focus-leave" type="button" onClick={() => setMobileArea('plan')}>{mission ? 'Plan ansehen' : 'Mission erstellen'}</button>
      </section>}
      {tourOffer && !isRunning && <aside className="tour-offer" aria-label="Mission kennenlernen">
        <span>Mission kurz kennenlernen?</span>
        <button type="button" className="focus-leave" onClick={() => { setTourOffer(false); setTourOpen(true) }}>Tour starten</button>
        <button type="button" className="focus-leave" onClick={() => { setTourOffer(false); saveTourStatus('skipped') }}>Jetzt nicht</button>
      </aside>}
      {tourOpen && <SpotlightTour targets={tourTargets.current} onClose={closeTour} />}

      <section hidden={isMobile} className="intro" id="start">
        <div>
          <p className="eyebrow">MISSION CONTROL / DEIN FOKUS-RAUM</p>
          <h1>Heute kommst du <span>weiter.</span></h1>
          <p className="intro-copy">Ein Ziel. Kleine Schritte. Ein gutes Gefühl am Ende.</p>
        </div>
        <div className="date-chip"><span className="date-sun">☼</span><span>Deine nächste Lernsession</span></div>
      </section>

      <div className="workspace-grid">
        <section hidden={hideMobile('plan')} ref={setupTarget} className="panel setup-panel" aria-labelledby="setup-heading">
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

            {blocker === 'other' && <><label className="field-label" htmlFor="blocker-details">Was erschwert dir das Lernen?</label>
              <textarea id="blocker-details" maxLength={240} value={blockerDetails} disabled={pendingClarification !== null || isGenerating} onChange={e => setBlockerDetails(e.target.value)} />
              <p className="field-hint">Optional, maximal 240 Zeichen. Ohne Text wird Sonstiges allgemein berücksichtigt.</p></>}
            {!pendingClarification && <button type="button" className="clarification-skip" onClick={createOwnPlan} disabled={isGenerating}>Eigenen Plan erstellen</button>}
            <LearningContextFields value={learningContext} onChange={setLearningContext} disabled={pendingClarification !== null || isGenerating} />
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

        <section hidden={hideMobile('plan')} ref={planTarget} className="panel plan-panel" aria-labelledby="plan-heading">
          <div className="panel-heading plan-heading">
            <div className="heading-icon mint">☷</div>
            <div>
              <p className="section-kicker">DEIN FAHRPLAN</p>
              <h2 id="plan-heading">Schritt für Schritt</h2>
            </div>
            {mission && <span className="plan-pill">{mission.timeMode === 'stopwatch' ? 'STOPPUHR' : `${mission.timeBudgetMinutes} MIN`}</span>}
          </div>

          {editingPlan && <PlanEditor initial={editingPlan} onSave={saveEditedPlan} onCancel={() => setEditingPlan(null)} disabled={!canWrite || isGenerating || pendingClarification !== null} />}
          {mission && !editingPlan && <><p className="generation-notice">Alle Schritte sind bearbeitbar. KI-Pläne sind Vorschläge. Du entscheidest über deinen Plan.</p>
            <button type="button" className="clarification-skip" disabled={isGenerating || pendingClarification !== null} onClick={() => setEditingPlan(mission)}>Lernplan bearbeiten</button>
            <button type="button" className="clarification-skip" disabled={isGenerating || pendingClarification !== null} onClick={() => { if (isMobile) setMobileArea('library'); setTemplateSaveRequest({ ...mission, steps: mission.steps.map(s => ({ ...s })) }) }}>Als Vorlage speichern</button></>}
          {!editingPlan && (mission ? (
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
          ))}
        </section>
      </div>

      <section hidden={hideMobile('home')} ref={timerTarget} className="timer-panel" aria-label="Lern-Timer">
        <FocusEnvironmentPicker value={focusEnvironment} onChange={changeFocusEnvironment} />
        {environmentNotice && <p className="environment-notice">{environmentNotice}</p>}
        <div className="timer-message">
          <div className="timer-icon">◷</div>
          <div><p className="section-kicker">BLEIB IM FLOW</p><h2>Zeit für deinen Fokus.</h2></div>
        </div>
        {mission?.timeMode !== 'stopwatch' && <p className="field-hint">{mission?.timeBudgetMinutes ?? 25} Min Fokus · {strategyLabel(mission?.focusStrategy)} · {blockSummary(mission?.timeBudgetMinutes ?? 25, mission?.focusStrategy).count} Fokusblöcke · {blockSummary(mission?.timeBudgetMinutes ?? 25, mission?.focusStrategy).pauseMinutes} Min Pause zusätzlich</p>}
        {focusBlocks && <p role="status">{blockStatus()} · Restliche Fokuszeit: {formatTime(remainingSeconds)}{focusBlocks.phase === 'break' && <button type="button" onClick={skipBreak}>Pause überspringen</button>}</p>}
        <div className="timer-clock" aria-live="polite" aria-label={`${mission?.timeMode === 'stopwatch' ? 'Vergangene' : 'Verbleibende'} Zeit: ${formatTime(focusBlocks ? focusBlocks.remainingMilliseconds / 1000 : mission?.timeMode === 'stopwatch' ? elapsedSeconds : remainingSeconds)}`}>
          <span>{formatTime(focusBlocks ? focusBlocks.remainingMilliseconds / 1000 : mission?.timeMode === 'stopwatch' ? elapsedSeconds : remainingSeconds)}</span><small>MIN : SEK</small>
        </div>
        <div className="timer-controls">
          <button ref={normalTimerButton} className="timer-button" type="button" onClick={toggleTimer}>
            <span aria-hidden="true">{isRunning ? 'Ⅱ' : '▶'}</span>{focusBlocks?.phase === 'break' ? isRunning ? 'Pause anhalten' : 'Pause starten' : isRunning ? 'Pause' : mission?.timeMode === 'stopwatch' ? elapsedSeconds > 0 ? 'Fortsetzen' : 'Start' : remainingSeconds === 0 ? 'Weiter' : focusBlocks ? 'Fokusblock starten' : 'Start'}
          </button>
          <button className="reset-button" type="button" onClick={resetTimer} aria-label="Timer zurücksetzen" title="Timer zurücksetzen">↺</button>
        </div>
        {hasActiveSession && <button className="clarification-skip" type="button" onClick={() => endLearningSession()}>Session beenden</button>}
        {hasActiveSession && mission?.timeMode === 'stopwatch' && <button className="clarification-skip" type="button" onClick={() => endLearningSession('completed')}>Session abschließen</button>}
        <p className="timer-encouragement"><span>✦</span> Kleine Schritte zählen.</p>
      </section>

      <div className="mission-support">
      <GamificationPanel
        hidden={hideMobile('home')}
        displayLevel={effectiveDisplayLevel}
        sectionRef={coreTarget}
        coreRef={dashboardOrb}
        state={gamification}
        rewardNotice={rewardNotice}
      />

      <div className="mobile-crate-container" hidden={hideMobile('home')}><OrbCrateShop sectionRef={cratesTarget} state={gamification} enabled={canWrite} onPurchase={handleCratePurchase} onOpenCollection={() => setCollectionOpen(true)} /></div>
      {collectionOpen && <OrbCollectionDialog state={gamification} enabled={canWrite} onClose={() => setCollectionOpen(false)}
        onEquipOrb={id => { if (writer.current) commitGamification(equipOrb(game.current, id)) }} />}
      {import.meta.env.DEV && GamificationDebug && isLocalDevelopment(import.meta.env.DEV, window.location.hostname) && (
        <div hidden={hideMobile('progress')} className="mobile-dev-container">
        <Suspense fallback={null}>
          <GamificationDebug state={gamification} enabled={canWrite} displayLevelOverride={displayLevelOverride}
            onDisplayLevelChange={value => {
              if (isLocalDevelopment(import.meta.env.DEV, window.location.hostname)
                && (value === null || (Number.isInteger(value) && value >= 1 && value <= 100))) setDisplayLevelOverride(value)
            }} onChange={(transform) => {
            if (!writer.current || !isLocalDevelopment(import.meta.env.DEV, window.location.hostname)) return false
            try { commitGamification(transform(game.current)); return true } catch { failStorage(); return false }
          }} />
        </Suspense>
        </div>
      )}

      </div>
      <div hidden={hideMobile('progress')}>
      <LearningHistory entries={history} />
      <LearningStatistics active={isMobile && mobileArea === 'progress'} statistics={statistics} total={gamification.totalFocusMilliseconds} canWrite={canWrite} onGoals={changeGoals} />
      </div>
      <div hidden={hideMobile('library')}>
      <MissionLibrary active={isMobile && mobileArea === 'library'} saveRequest={templateSaveRequest} suggestedOrigin={templateOrigin} onDismissSave={() => setTemplateSaveRequest(null)}
        enabled={canWrite && !isGenerating && pendingClarification === null && !tourOpen} sessionActive={hasActiveSession}
        onUse={plan => {
          if (!writer.current || appSnapshot.current.activeSession || session.current) return
          const remaining = plan.timeMode === 'stopwatch' ? 0 : plan.timeBudgetMinutes * 60
          const next = { ...appSnapshot.current, mission: plan, remainingSeconds: remaining, elapsedSeconds: 0 }
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); appSnapshot.current = next
            updateBlocks(null); setMission(plan); setLearningContext(readLearningContext(plan.learningContext)); setRemainingSeconds(remaining); setElapsedSeconds(0); setEditingPlan(null)
            setShowMissionCompletion(false); setGenerationNotice('Vorlage übernommen. Dein Timer bleibt pausiert.'); setTemplateSaveRequest(null); setTemplateOrigin('custom')
            if (isMobile) setMobileArea('plan')
          } catch { failStorage() }
        }} />
      </div>
      <div hidden={hideMobile('progress')}><PrestigePanel focusMilliseconds={gamification.totalFocusMilliseconds} /></div>
      <footer className="footer"><span>MISSION <i>·</i> DEIN LERNWEG, IN DEINEM TEMPO.</span><span>Mit Ruhe. Mit Fokus. Mit dir.</span></footer>
      {showMissionCompletion && <MissionRewardDialog onClose={() => setShowMissionCompletion(false)} />}
    </main>
    </fieldset>
    {isMobile && <MobileNavigation area={mobileArea} onArea={setMobileArea} onFocus={openMobileFocus}
      orb={getEquippedOrb(gamification)} level={effectiveDisplayLevel} disabled={tourOpen}
      orbRef={navigationOrb} focusRef={navigationFocus} hasMission={Boolean(mission)} />}
    </>
  )
}

export default App
