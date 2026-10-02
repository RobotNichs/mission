import { describe, expect, it } from 'vitest'
import { generateLearningPlanWithStatus } from './learningPlanApi'
import type { LearningPlanApiResponse } from '../../shared/learningPlanSchema.mjs'
import type { LearningPlanInput, LearningPlanRequest } from '../types/learningPlan'

const input: LearningPlanInput = {
  goal: 'Java-Klassen und Methoden üben',
  timeBudgetMinutes: 5,
  energyLevel: 'low',
  learningBlocker: 'starting',
}

const mockResponse: LearningPlanApiResponse = {
  source: 'mock',
  clarifyingQuestion: null,
  plan: {
    id: 'server-mission-id',
    ...input,
    steps: [{
      id: 'server-mission-id-step-1',
      title: 'Eine Java-Methode schreiben',
      description: 'Schreibe eine kleine Java-Methode und erkläre ihren Rückgabewert.',
      minutes: 5,
      kind: 'learning',
      done: false,
    }],
  },
}

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return (async () => ({
    ok,
    json: async () => payload,
  })) as unknown as typeof fetch
}

describe('Frontend-API-Service', () => {
  it('verwendet eine gültige Serverantwort aus dem Mock-Modus', async () => {
    const result = await generateLearningPlanWithStatus(input, fakeFetch(mockResponse))

    expect(result.source).toBe('mock')
    expect(result.plan.id).toBe('server-mission-id')
    expect(result.plan.steps[0].kind).toBe('learning')
    expect(result.plan.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(5)
    expect(result.notice).toContain('Mock-Antwort')
  })

  it('verwirft ungültige Serverdaten und erzeugt den lokalen Ersatzplan', async () => {
    const invalidResponse = structuredClone(mockResponse)
    invalidResponse.plan.steps[0].minutes = 4
    const result = await generateLearningPlanWithStatus(input, fakeFetch(invalidResponse))

    expect(result.source).toBe('fallback')
    expect(result.plan.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(input.timeBudgetMinutes)
    expect(result.plan.steps.some((step) => ['learning', 'practice'].includes(step.kind))).toBe(true)
    expect(result.notice).toContain('lokaler Ersatzplan')
  })

  it('fällt bei Netzwerk- und HTTP-Ausfällen auf den lokalen Generator zurück', async () => {
    const networkFailure = (async () => { throw new Error('network unavailable') }) as typeof fetch
    const networkResult = await generateLearningPlanWithStatus(input, networkFailure)
    const httpResult = await generateLearningPlanWithStatus(input, fakeFetch({}, false))

    expect(networkResult.source).toBe('fallback')
    expect(httpResult.source).toBe('fallback')
    expect(networkResult.plan.goal).toBe(input.goal)
    expect(httpResult.plan.timeBudgetMinutes).toBe(input.timeBudgetMinutes)
  })

  it('sendet Follow-up-Antworten an die API und akzeptiert nur einen finalen Plan ohne weitere Frage', async () => {
    const followup: LearningPlanRequest = {
      ...input,
      clarification: { question: 'Welcher Teil von Java?', answer: 'Vererbung', skipped: false },
    }
    let sentBody = ''
    const response = {
      ...mockResponse,
      plan: { ...mockResponse.plan, goal: followup.goal, timeBudgetMinutes: followup.timeBudgetMinutes },
    }
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      sentBody = init?.body as string
      return { ok: true, json: async () => response }
    }) as unknown as typeof fetch

    const result = await generateLearningPlanWithStatus(followup, fetchImpl)

    expect(JSON.parse(sentBody).clarification).toEqual(followup.clarification)
    expect(result.source).toBe('mock')
    expect(result.clarifyingQuestion).toBeNull()
  })

  it('verwendet bei Follow-up-Netzwerkfehlern den lokalen Fallback mit Antwortkontext', async () => {
    const followup: LearningPlanRequest = {
      ...input,
      clarification: { question: 'Welcher Teil von Java?', answer: 'Vererbung', skipped: false },
    }
    const networkFailure = (async () => { throw new Error('network unavailable') }) as typeof fetch
    const result = await generateLearningPlanWithStatus(followup, networkFailure)

    expect(result.source).toBe('fallback')
    expect(result.clarifyingQuestion).toBeNull()
    expect(result.plan.steps.some((step) => step.description.includes('Vererbung'))).toBe(true)
  })
})
