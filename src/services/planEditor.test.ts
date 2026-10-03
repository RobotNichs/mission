import { describe, expect, it } from 'vitest'
import { applyPlanTiming, validateEditablePlan } from './planEditor'
import { advanceFocusSession } from './focusTimer'
import { addFocusTime } from './gamification'
import { initialGamificationState } from '../types/gamification'
import type { LearningPlan } from '../types/learningPlan'

const plan: LearningPlan = { id: 'id', goal: 'Statistik', timeBudgetMinutes: 90, energyLevel: 'low', learningBlocker: null, steps: [{ id: 's', title: 'Beispiel', description: 'Ein Beispiel ansehen.', minutes: 5, kind: 'learning', done: true }] }
describe('lokale Zeitmodi', () => {
  it('berechnet automatisch Restzeit, ohne absolvierte Zeit umzuschreiben', () => {
    expect(applyPlanTiming({ ...plan, timeMode: 'automatic' }, 60)).toMatchObject({ plan: { timeBudgetMinutes: 5 }, remainingSeconds: 240 })
    expect(applyPlanTiming({ ...plan, timeMode: 'automatic' }, 600).remainingSeconds).toBe(0)
  })
  it('erhält manuelle Dauer und unabhängige Schrittsumme', () => {
    expect(applyPlanTiming({ ...plan, timeMode: 'manual' }, 60)).toMatchObject({ plan: { timeBudgetMinutes: 90 }, remainingSeconds: 5340 })
    expect(validateEditablePlan(plan)).toBeNull()
  })
  it.each([0, -1, NaN, 1.5, Infinity, 10081])('weist ungültige Schrittzeit %s zurück', minutes => {
    expect(validateEditablePlan({ ...plan, steps: [{ ...plan.steps[0], minutes }] })).not.toBeNull()
  })
  it('weist leere Texte, leere Pläne und doppelte IDs zurück', () => {
    for (const p of [{ ...plan, goal: '' }, { ...plan, steps: [] }, { ...plan, steps: [plan.steps[0], plan.steps[0]] }, { ...plan, steps: [{ ...plan.steps[0], description: '' }] }]) expect(validateEditablePlan(p)).not.toBeNull()
  })
  it('nutzt dieselbe Fokuszeitabrechnung ohne Countdown-Grenze', () => {
    const a = advanceFocusSession({ lastTime: 0, remainingMilliseconds: 0, stopwatch: true }, 90_500)
    const b = advanceFocusSession(a.session, 120_000)
    expect(a.elapsedMilliseconds + b.elapsedMilliseconds).toBe(120_000)
    expect(addFocusTime(addFocusTime(initialGamificationState, a.elapsedMilliseconds), b.elapsedMilliseconds).coins).toBe(2)
    expect(advanceFocusSession(b.session, 120_000).elapsedMilliseconds).toBe(0)
  })
})
