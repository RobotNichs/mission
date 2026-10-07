import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateLearningPlanWithStatus } from './learningPlanApi'
import type { LearningPlanApiResponse } from '../../shared/learningPlanSchema.mjs'
import type { LearningPlanInput, LearningPlanRequest } from '../types/learningPlan'

it('explains rate limits with Retry-After and does not retry the provider', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { category: 'rate_limited', diagnosisId: crypto.randomUUID() } }), { status: 429, headers: { 'retry-after': '42' } }))
  const result = await generateLearningPlanWithStatus(input, fetchImpl)
  expect(result.source).toBe('fallback'); expect(result.notice).toContain('42 Sekunden'); expect(result.notice).toContain('Diagnose-ID:'); expect(fetchImpl).toHaveBeenCalledOnce()
})
it('explains offline failure while returning a local plan without retries', async () => {
  vi.stubGlobal('navigator', { onLine: false })
  const fetchImpl = vi.fn().mockRejectedValue(new TypeError('private network detail'))
  try { const result = await generateLearningPlanWithStatus(input, fetchImpl); expect(result.source).toBe('fallback'); expect(result.notice).toContain('offline'); expect(result.notice).not.toContain('private network detail'); expect(fetchImpl).toHaveBeenCalledOnce() } finally { vi.unstubAllGlobals() }
})

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

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('sichere Fallback-Diagnose', () => {
  const diagnosisId = '61ef8fbd-7cc1-42ea-9e36-7b3741d9ef1a'
  it.each([
    ['provider_unreachable', 'nicht erreichbar'],
    ['provider_timeout', 'zu lange'],
    ['provider_http_error', 'nicht erfolgreich'],
    ['invalid_json', 'Antwortformats'],
    ['model_content_missing', 'keinen Lernplan'],
    ['model_output_truncated', 'abgeschnitten'],
    ['invalid_plan_schema', 'Planregeln'],
    ['internal_error', 'interner Fehler'],
    ['invalid_input', 'ungültige Eingaben'],
    ['provider_not_configured', 'konfiguriert'],
    ['provider_not_supported', 'nicht unterstützt'],
    ['rate_limited', 'Zu viele'],
    ['invalid_request', 'nicht verarbeitet'],
  ])('zeigt %s und ausschließlich die geprüfte Diagnose-ID', async (category, message) => {
    const result = await generateLearningPlanWithStatus(input, fakeFetch({ error: { category, diagnosisId, message: 'PRIVATE-KEY-AND-TEXT' } }, false))
    expect(result.source).toBe('fallback')
    expect(result.notice).toContain(message)
    expect(result.notice).toContain(diagnosisId)
    expect(result.notice).not.toContain('PRIVATE-KEY-AND-TEXT')
  })

  it('verwirft unbekannte Kategorien und nicht vertrauenswürdige IDs', async () => {
    const result = await generateLearningPlanWithStatus(input, fakeFetch({ error: { category: 'PRIVATE-TEXT', diagnosisId: 'PRIVATE-TEXT', message: 'PRIVATE-TEXT' } }, false))
    expect(result.notice).not.toContain('PRIVATE-TEXT')
    expect(result.notice).toMatch(/Diagnose-ID: [0-9a-f-]{36}/)
  })

  it.each(['fetch', 'body'])('begrenzt hängenden %s einschließlich Antwortverarbeitung', async (phase) => {
    vi.useFakeTimers()
    let signal: AbortSignal | null | undefined
    const fetch = vi.fn(async (_url, init) => {
      signal = init?.signal
      if (phase === 'fetch') return new Promise(() => {})
      return { ok: true, json: () => new Promise(() => {}) }
    }) as unknown as typeof globalThis.fetch
    const pending = generateLearningPlanWithStatus(input, fetch)
    await vi.advanceTimersByTimeAsync(25_000)
    const result = await pending
    expect(result.source).toBe('fallback')
    expect(result.notice).toContain('zu lange')
    expect(signal?.aborted).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('behandelt ungültiges Antwort-JSON ohne Fehlertexte auszugeben', async () => {
    const fetch = (async () => ({ ok: true, json: async () => { throw new SyntaxError('PRIVATE-TEXT') } })) as unknown as typeof globalThis.fetch
    const result = await generateLearningPlanWithStatus(input, fetch)
    expect(result.notice).toContain('Antwortformats')
    expect(result.notice).not.toContain('PRIVATE-TEXT')
  })
})

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
