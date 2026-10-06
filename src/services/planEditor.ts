import type { LearningPlan } from '../types/learningPlan'
import { validateLearningContext } from '../../shared/learningContext.mjs'
import { validFocusStrategy } from './focusBlocks'

export const MAX_PLAN_MINUTES = 10080

export function validateEditablePlan(plan: LearningPlan): string | null {
  if (plan.focusStrategy !== undefined && !validFocusStrategy(plan.focusStrategy)) return 'Fokusblock: 10 bis 120 Minuten. Pause: 1 bis 60 Minuten.'
  if (plan.learningContext !== undefined && !validateLearningContext(plan.learningContext)) return 'Bitte prüfe den optionalen Lernkontext.'
  if (!plan.goal.trim() || plan.goal.length > 280) return 'Bitte gib ein Lernziel mit höchstens 280 Zeichen ein.'
  if (!['automatic', 'manual', 'stopwatch'].includes(plan.timeMode ?? 'manual')) return 'Bitte wähle einen Zeitmodus.'
  if (!plan.steps.length || plan.steps.length > 100) return 'Ein Plan braucht 1 bis 100 Schritte.'
  if (new Set(plan.steps.map(s => s.id)).size !== plan.steps.length) return 'Die Schritte brauchen eindeutige IDs.'
  for (const s of plan.steps) {
    if (!s.id || !s.title.trim() || s.title.length > 90 || !s.description.trim() || s.description.length > 600) return 'Jeder Schritt braucht einen Titel (max. 90) und eine Beschreibung (max. 600 Zeichen).'
    if (!Number.isInteger(s.minutes) || s.minutes < 1 || s.minutes > MAX_PLAN_MINUTES) return 'Schrittzeiten müssen ganze Minuten zwischen 1 und 10080 sein.'
    if (!['learning', 'practice', 'preparation', 'reflection'].includes(s.kind) || typeof s.done !== 'boolean') return 'Der Schritt ist ungültig.'
  }
  if (plan.learningBlockerDetails !== undefined && (plan.learningBlocker !== 'other' || plan.learningBlockerDetails.length > 240)) return 'Bitte begrenze Sonstiges auf 240 Zeichen.'
  if (!Number.isInteger(plan.timeBudgetMinutes) || plan.timeBudgetMinutes < 1 || plan.timeBudgetMinutes > MAX_PLAN_MINUTES) return 'Die Gesamtdauer muss zwischen 1 und 10080 Minuten liegen.'
  if (plan.steps.reduce((sum, s) => sum + s.minutes, 0) > MAX_PLAN_MINUTES) return 'Die Schrittsumme darf höchstens 10080 Minuten betragen.'
  return null
}

export function applyPlanTiming(plan: LearningPlan, elapsedSeconds: number) {
  const timeBudgetMinutes = plan.timeMode === 'automatic' ? plan.steps.reduce((sum, s) => sum + s.minutes, 0) : plan.timeBudgetMinutes
  return { plan: { ...plan, timeBudgetMinutes }, remainingSeconds: plan.timeMode === 'stopwatch' ? 0 : Math.max(0, timeBudgetMinutes * 60 - elapsedSeconds) }
}
