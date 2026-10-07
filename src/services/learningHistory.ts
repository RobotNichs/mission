import { readSessionReview, type SessionReview } from '../../shared/projectReviewSchema.mjs'
import { readSourceProject, type SourceProject } from '../../shared/sourceProject.mjs'
import { readFocusStrategy, validFocusStrategy, type FocusStrategy } from './focusBlocks'
export type SessionHistoryEntry = {
  id: string
  startedAt: string
  endedAt: string
  goal: string
  focusSeconds: number
  plannedSeconds: number | null
  timeMode: 'automatic' | 'manual' | 'stopwatch'
  completedSteps: number
  totalSteps: number
  status: 'completed' | 'ended_early'
  projectReview?: SessionReview
  sourceProject?: SourceProject
  focusStrategy?: FocusStrategy
  completedFocusBlocks?: number
  breakSeconds?: number
}

export type ActiveLearningSession = Omit<SessionHistoryEntry, 'endedAt' | 'status'> & { missionId: string | null }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function validBase(value: unknown): boolean {
  if (!record(value)) return false
  return typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 100
    && typeof value.startedAt === 'string' && Number.isFinite(Date.parse(value.startedAt))
    && typeof value.goal === 'string' && value.goal.trim().length > 0 && value.goal.length <= 280
    && typeof value.focusSeconds === 'number' && Number.isFinite(value.focusSeconds) && value.focusSeconds >= 0
    && (value.plannedSeconds === null || (typeof value.plannedSeconds === 'number' && Number.isFinite(value.plannedSeconds) && value.plannedSeconds > 0))
    && ['automatic', 'manual', 'stopwatch'].includes(value.timeMode as string)
    && Number.isSafeInteger(value.completedSteps) && Number.isSafeInteger(value.totalSteps)
    && (value.completedSteps as number) >= 0 && (value.totalSteps as number) >= 0
    && (value.completedSteps as number) <= (value.totalSteps as number)
}

// Reconstruct whitelisted fields; never retain arbitrary stored payloads.
function base(value: Record<string, unknown>) {
  let projectReview:SessionReview | undefined
  try {if(value.projectReview!==undefined && readSourceProject(value.sourceProject))projectReview=readSessionReview(value.projectReview,readSourceProject(value.sourceProject)!)} catch { /* Keep the valid session, reject unsafe review metadata. */ }
  return {
    ...(projectReview ? {projectReview} : {}),
    ...(readSourceProject(value.sourceProject) ? {sourceProject:readSourceProject(value.sourceProject)} : {}),
    id: value.id as string, startedAt: value.startedAt as string, goal: value.goal as string,
    focusSeconds: value.focusSeconds as number, plannedSeconds: value.plannedSeconds as number | null,
    timeMode: value.timeMode as SessionHistoryEntry['timeMode'],
    completedSteps: value.completedSteps as number, totalSteps: value.totalSteps as number,
    ...(validFocusStrategy(value.focusStrategy) ? { focusStrategy: readFocusStrategy(value.focusStrategy) } : {}),
    ...(Number.isSafeInteger(value.completedFocusBlocks) && (value.completedFocusBlocks as number) >= 0 && (value.completedFocusBlocks as number) <= 10080 ? { completedFocusBlocks: value.completedFocusBlocks as number } : {}),
    ...(typeof value.breakSeconds === 'number' && Number.isFinite(value.breakSeconds) && value.breakSeconds >= 0 ? { breakSeconds: value.breakSeconds } : {}),
  }
}

export function normalizeHistory(value: unknown): SessionHistoryEntry[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const entries: SessionHistoryEntry[] = []
  for (const item of value) {
    if (!record(item) || !validBase(item) || (item.focusSeconds as number) <= 0
      || typeof item.endedAt !== 'string' || !Number.isFinite(Date.parse(item.endedAt))
      || Date.parse(item.endedAt) < Date.parse(item.startedAt as string)
      || !['completed', 'ended_early'].includes(item.status as string) || seen.has(item.id as string)) continue
    seen.add(item.id as string)
    entries.push({ ...base(item), endedAt: item.endedAt, status: item.status as SessionHistoryEntry['status'] })
  }
  return entries.sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt) || a.id.localeCompare(b.id)).slice(0, 5)
}

export function normalizeActiveSession(value: unknown, history: SessionHistoryEntry[]): ActiveLearningSession | null {
  if (!record(value) || !validBase(value) || !(value.missionId === null || typeof value.missionId === 'string')
    || history.some(e => e.id === value.id)) return null
  return { ...base(value), missionId: value.missionId }
}

export function finishLearningSession(history: SessionHistoryEntry[], active: ActiveLearningSession | null,
  status: SessionHistoryEntry['status'], endedAt: string): SessionHistoryEntry[] {
  if (!active || active.focusSeconds <= 0 || history.some(e => e.id === active.id)) return history
  return normalizeHistory([...history, { ...active, status, endedAt }])
}
