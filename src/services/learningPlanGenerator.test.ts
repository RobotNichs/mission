import { describe, expect, it } from 'vitest'
import { generateLearningPlan, generateRuleBasedLearningPlan } from './learningPlanGenerator'
import type { LearningPlanInput } from '../types/learningPlan'

const input: LearningPlanInput = {
  goal: 'Python-Funktionen üben',
  timeBudgetMinutes: 25,
  energyLevel: 'high',
  learningBlocker: 'understanding',
}

describe('Lernplangenerator', () => {
  it('liefert einen Lernplan mit dem gemeinsamen Datenmodell und passenden Schrittzeiten', () => {
    const plan = generateRuleBasedLearningPlan(input)

    expect(plan).toMatchObject(input)
    expect(plan.steps.length).toBeGreaterThan(0)
    expect(plan.steps.reduce((total, step) => total + step.minutes, 0)).toBe(input.timeBudgetMinutes)
    expect(plan.steps.every((step) => (
      typeof step.id === 'string'
      && typeof step.title === 'string'
      && typeof step.description === 'string'
      && typeof step.minutes === 'number'
      && typeof step.done === 'boolean'
    ))).toBe(true)
    expect(plan.steps.some((step) => step.description.includes('konkrete Frage'))).toBe(true)
  })

  it('stellt den regelbasierten Generator hinter der austauschbaren asynchronen Service-Schnittstelle bereit', async () => {
    await expect(generateLearningPlan(input)).resolves.toMatchObject(input)
  })
})
