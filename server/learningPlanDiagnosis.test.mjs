import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleLearningPlanRequest } from './learningPlanApi.mjs'
import { diagnoseAiPlanDraft, validateAiPlanDraft } from '../shared/learningPlanSchema.mjs'
import { createApiMiddleware } from './index.mjs'

const input = { goal: 'Statistik lernen', timeBudgetMinutes: 15, energyLevel: 'medium', learningBlocker: null }
const draft = { clarifyingQuestion: null, steps: [{ title: 'Mittelwert', description: 'Berechne einen Mittelwert.', minutes: 15, kind: 'learning', topicFocus: 'Statistik: Mittelwert' }] }
const privateText = 'PRIVATE-LEARNING-CONTENT'
const key = 'SYNTHETIC-KEY-DO-NOT-LOG'
const options = (fetchImpl) => ({ env: { AI_PROVIDER: 'groq', GROQ_API_KEY: key, GROQ_MODEL: 'offline' }, fetchImpl })
const reply = (value, finishReason = 'stop') => ({ ok: true, json: async () => ({ choices: [{ finish_reason: finishReason, message: { content: JSON.stringify(value) } }] }) })

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('sichere KI-Diagnose', () => {
  it.each([
    ['provider_unreachable', async () => { throw new TypeError(privateText) }],
    ['provider_http_error', async () => ({ ok: false, status: 429, json: async () => ({ message: privateText, key }) })],
    ['invalid_json', async () => ({ ok: true, json: async () => { throw new SyntaxError(privateText) } })],
    ['invalid_json', async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: privateText } }] }) })],
    ['model_content_missing', async () => ({ ok: true, json: async () => ({ message: privateText }) })],
    ['model_output_truncated', async () => reply(draft, 'length')],
    ['invalid_plan_schema', async () => reply({ ...draft, steps: [] })],
    ['internal_error', async () => ({ ok: true, json: async () => { throw new Error(privateText) } })],
  ])('klassifiziert %s ohne Inhalte zu verraten', async (category, fetchImpl) => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetch = vi.fn(fetchImpl)
    const result = await handleLearningPlanRequest({ ...input, goal: privateText }, options(fetch))
    expect(result.body.error.category).toBe(category)
    expect(result.status).toBe(category === 'internal_error' ? 500 : 502)
    expect(result.body.error.diagnosisId).toMatch(/^[0-9a-f-]{36}$/)
    expect(log).toHaveBeenCalledTimes(1)
    const metadata = JSON.parse(log.mock.calls[0][0])
    expect(metadata.diagnosisId).toBe(result.body.error.diagnosisId)
    expect(Object.keys(metadata).every(k => ['event', 'diagnosisId', 'category', 'durationMs', 'upstreamStatus', 'schemaCode', 'validationErrors'].includes(k))).toBe(true)
    for (const detail of metadata.validationErrors ?? []) {
      expect(Object.keys(detail).every(k => ['schemaCode', 'field', 'stepIndex'].includes(k))).toBe(true)
      expect(detail.schemaCode).toBe('invalid_step_count')
    }
    const serialized = JSON.stringify([result, log.mock.calls])
    expect(serialized).not.toContain(key)
    expect(serialized).not.toContain(privateText)
    expect(serialized).not.toContain('authorization')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each(['fetch', 'body'])('begrenzt auch einen hängenden %s auf 20 Sekunden', async (phase) => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let signal
    const fetch = vi.fn(async (_url, init) => {
      signal = init.signal
      if (phase === 'fetch') return new Promise(() => {})
      return { ok: true, json: () => new Promise(() => {}) }
    })
    const pending = handleLearningPlanRequest(input, options(fetch))
    await vi.advanceTimersByTimeAsync(20_000)
    const result = await pending
    expect(result.body.error.category).toBe('provider_timeout')
    expect(signal.aborted).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('behält 400 bei ungültigen Eingaben und erstellt unterschiedliche IDs', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetch = vi.fn()
    const a = await handleLearningPlanRequest({}, options(fetch))
    const b = await handleLearningPlanRequest({}, options(fetch))
    expect(a.status).toBe(400)
    expect(a.body.error.category).toBe('invalid_input')
    expect(a.body.error.diagnosisId).not.toBe(b.body.error.diagnosisId)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('klassifiziert interne Fehler beim Erstellen der Mission als 500', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await handleLearningPlanRequest(input, { ...options(async () => reply(draft)), createId: () => { throw new Error(privateText) } })
    expect(result.status).toBe(500)
    expect(result.body.error.category).toBe('internal_error')
    expect(JSON.stringify(result)).not.toContain(privateText)
  })

  it.each([
    ['invalid_response_structure', { ...draft, extra: privateText }],
    ['invalid_question', { ...draft, clarifyingQuestion: 'Was? Warum?' }],
    ['invalid_step_count', { ...draft, steps: [] }],
    ['invalid_step_title', { ...draft, steps: [{ ...draft.steps[0], title: '' }] }],
    ['invalid_step_description', { ...draft, steps: [{ ...draft.steps[0], description: '' }] }],
    ['invalid_step_minutes', { ...draft, steps: [{ ...draft.steps[0], minutes: 0 }] }],
    ['invalid_step_type', { ...draft, steps: [{ ...draft.steps[0], kind: 'unknown' }] }],
    ['topic_reference_missing', { ...draft, steps: [{ ...draft.steps[0], topicFocus: 'Mittelwert' }] }],
    ['minutes_total_mismatch', { ...draft, steps: [{ ...draft.steps[0], minutes: 14 }] }],
    ['learning_activity_missing', { ...draft, steps: [{ ...draft.steps[0], kind: 'preparation' }] }],
  ])('erhält die Ablehnungsregel %s', async (code, value) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(diagnoseAiPlanDraft(value, input)).toBe(code)
    expect(validateAiPlanDraft(value, input)).toBe(false)
    const result = await handleLearningPlanRequest(input, options(async () => reply(value)))
    expect(result.body.error.schemaCode).toBe(code)
  })

  it('erhält Rückfragen, Überspringen und wörtlichen Themenbezug', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const question = { ...draft, clarifyingQuestion: 'Welcher Bereich?' }
    expect(diagnoseAiPlanDraft(question, input)).toBeNull()
    expect(validateAiPlanDraft(draft, input)).toBe(true)
    for (const skipped of [true, false]) {
      const followup = { ...input, clarification: { question: 'Welcher Bereich?', answer: skipped ? '' : 'Mittelwert', skipped } }
      expect(diagnoseAiPlanDraft(question, followup)).toBe('followup_question_forbidden')
      expect(diagnoseAiPlanDraft(draft, followup)).toBeNull()
      const result = await handleLearningPlanRequest(followup, options(async () => reply(question)))
      expect(result.body.error.schemaCode).toBe('followup_question_forbidden')
    }
  })

  it('sendet Middleware-Ausnahmen als 500 und fehlerhaftes JSON als 400', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const handler = vi.fn(async () => { throw new Error(privateText) })
    for (const [body, expected] of [['{}', 500], ['{', 400]]) {
      const response = { writeHead: vi.fn(), end: vi.fn() }
      const request = { url: '/api/learning-plan', method: 'POST', headers: { 'content-type': 'application/json' }, socket: {}, async *[Symbol.asyncIterator]() { yield Buffer.from(body) } }
      await createApiMiddleware(handler)(request, response, vi.fn())
      expect(response.writeHead.mock.calls[0][0]).toBe(expected)
      expect(response.end.mock.calls[0][0]).not.toContain(privateText)
      expect(JSON.parse(response.end.mock.calls[0][0]).error.diagnosisId).toBeTruthy()
    }
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
