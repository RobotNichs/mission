import { describe, expect, it } from 'vitest'
import { getStableStepRewardSlot, preserveStepProgress } from './learningPlanProgress'
import type { LearningStep } from '../types/learningPlan'

const oldSteps: LearningStep[] = [
  { id: 'old-learning', title: 'Vererbung verstehen', description: 'Grundlagen', minutes: 8, kind: 'learning', done: true },
  { id: 'old-practice', title: 'Klassen anwenden', description: 'Übung', minutes: 7, kind: 'practice', done: false },
]

describe('Schrittfortschritt bei Planaktualisierung', () => {
  it('behält Reward-IDs auch bei neu formulierten Schritten und neuen Server-IDs bei', () => {
    const regenerated: LearningStep[] = [
      { id: 'new-id-a', title: 'Java-Vererbung abrufen', description: 'Neuer Text', minutes: 9, kind: 'learning', done: false },
      { id: 'new-id-b', title: 'Unterklassen programmieren', description: 'Neuer Text', minutes: 6, kind: 'practice', done: false },
    ]
    const steps = preserveStepProgress(regenerated, oldSteps, true, 'mission-a', [])

    expect(steps.map((step) => step.id)).toEqual(['old-learning', 'old-practice'])
    expect(steps.map((step) => step.done)).toEqual([false, false])
  })

  it('behält Häkchen nur für unveränderte Schritte und IDs bei', () => {
    const regenerated = [{ ...oldSteps[0], id: 'regenerated-id' }]
    const steps = preserveStepProgress(regenerated, oldSteps, true, 'mission-a', [])
    expect(steps[0]).toMatchObject({ id: 'old-learning', done: true })
  })

  it('vergibt neue IDs und löscht Häkchen bei einem anderen Missionsziel', () => {
    const regenerated = [{ ...oldSteps[0], id: 'new-mission-step' }]
    const steps = preserveStepProgress(regenerated, oldSteps, false, 'mission-b', [])
    expect(steps[0]).toMatchObject({ id: 'new-mission-step', done: false })
  })

  it('behält einen historischen Reward-ID-Treffer auch wenn mehrere Schritte derselben Art neu sortiert werden', () => {
    const previous: LearningStep[] = [
      { ...oldSteps[0], id: 'learning-one', done: false },
      { ...oldSteps[0], id: 'learning-two', title: 'Vererbung üben', done: false },
    ]
    const regenerated: LearningStep[] = [
      { ...oldSteps[0], id: 'new-first', title: 'Neuer Lernkern', done: false },
    ]
    const claims = ['mission-a::learning-two', 'mission-a::slot:learning:2']

    const steps = preserveStepProgress(regenerated, previous, true, 'mission-a', claims)

    expect(steps[0].id).toBe('learning-two')
  })

  it('bildet stabile Reward-Slots aus Schrittart und Reihenfolge statt Server-ID', () => {
    expect(getStableStepRewardSlot(oldSteps, 0)).toBe('learning:1')
    expect(getStableStepRewardSlot(oldSteps, 1)).toBe('practice:1')
    expect(getStableStepRewardSlot([
      oldSteps[0],
      { ...oldSteps[0], id: 'another-learning', done: false },
    ], 1)).toBe('learning:2')
  })
})
