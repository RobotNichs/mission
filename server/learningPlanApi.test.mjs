import { describe, expect, it, vi } from 'vitest'
import { handleLearningPlanRequest } from './learningPlanApi.mjs'

const input = {
  goal: 'SQL-JOINs in Beispielen verstehen',
  timeBudgetMinutes: 15,
  energyLevel: 'medium',
  learningBlocker: 'understanding',
}

const validDraft = {
  clarifyingQuestion: null,
  steps: [
    { title: 'JOIN-Typen vergleichen', description: 'Vergleiche INNER JOIN und LEFT JOIN mit einer kleinen Beispieltabelle.', minutes: 8, kind: 'learning', topicFocus: 'SQL-JOINs' },
    { title: 'JOIN-Abfrage lösen', description: 'Schreibe eine SELECT-Abfrage mit JOIN und prüfe die Ergebniszeilen.', minutes: 7, kind: 'practice', topicFocus: 'SQL-JOINs' },
  ],
}

function groqOptions(fetchImpl) {
  return {
    env: { AI_PROVIDER: 'groq', GROQ_API_KEY: 'server-only-test-secret', GROQ_MODEL: 'test-small-model' },
    fetchImpl,
    createId: () => 'mission-test-id',
  }
}

describe('serverseitiger Lernplan-Endpunkt', () => {
  it('liefert eine gültige, themenspezifische Groq-Antwort und hält den Schlüssel serverseitig', async () => {
    let requestUrl = ''
    let requestInit
    const fetchImpl = vi.fn(async (url, init) => {
      requestUrl = url
      requestInit = init
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify(validDraft) } }] }),
      }
    })

    const result = await handleLearningPlanRequest(input, groqOptions(fetchImpl))

    expect(result.status).toBe(200)
    expect(requestUrl).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(requestInit.headers.authorization).toBe('Bearer server-only-test-secret')
    expect(requestInit.body).not.toContain('server-only-test-secret')
    expect(JSON.stringify(result.body)).not.toContain('server-only-test-secret')
    expect(result.body.plan.id).toBe('mission-test-id')
    expect(result.body.plan.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(15)
    expect(result.body.plan.steps.some((step) => ['learning', 'practice'].includes(step.kind))).toBe(true)
  })

  it.each([
    ['Zeitbudget stimmt nicht', { ...validDraft, steps: validDraft.steps.map((step) => ({ ...step, minutes: 5 })) }],
    ['Lernaktivität fehlt', { ...validDraft, steps: validDraft.steps.map((step) => ({ ...step, kind: 'preparation' })) }],
    ['mehr als eine Rückfrage', { ...validDraft, clarifyingQuestion: 'Welcher Teil? Und welches Beispiel?' }],
    ['Fachbezug fehlt', { ...validDraft, steps: validDraft.steps.map((step) => ({ ...step, topicFocus: 'Astronomie' })) }],
  ])('weist eine ungültige KI-Antwort zurück: %s', async (_description, draft) => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(draft) } }] }),
    }))

    const result = await handleLearningPlanRequest(input, groqOptions(fetchImpl))

    expect(result.status).toBe(502)
    expect(result.body.error.code).toBe('invalid_ai_plan')
  })

  it('liefert im Standardmodus eine kostenlose Mock-Antwort ohne Provider-Aufruf', async () => {
    const fetchImpl = vi.fn()
    const result = await handleLearningPlanRequest({ ...input, timeBudgetMinutes: 5, energyLevel: 'high', learningBlocker: 'focus' }, {
      env: {},
      fetchImpl,
      createId: () => 'mock-mission',
    })

    expect(result.status).toBe(200)
    expect(result.body.source).toBe('mock')
    expect(result.body.plan.steps).toHaveLength(1)
    expect(result.body.plan.steps[0].kind).toBe('learning')
    expect(result.body.plan.steps[0].minutes).toBe(5)
    expect(result.body.plan.steps[0].description).toContain('Nutze deinen Fokus')
    expect(result.body.plan.steps[0].description).toContain('Halte jeden Schritt knapp')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('stellt höchstens eine Rückfrage und erstellt danach mit der Antwort einen finalen Schwerpunktplan', async () => {
    const fetchImpl = vi.fn()
    const vagueInput = { ...input, goal: 'Mathematik', learningBlocker: null }
    const first = await handleLearningPlanRequest(vagueInput, { env: {}, fetchImpl, createId: () => 'draft-plan' })
    const question = first.body.clarifyingQuestion
    expect(first.status).toBe(200)
    expect(question).toContain('Teil')
    expect((question.match(/\?/g) ?? [])).toHaveLength(1)
    expect(first.body.plan.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(vagueInput.timeBudgetMinutes)

    const final = await handleLearningPlanRequest({
      ...vagueInput,
      clarification: { question, answer: 'Bruchgleichungen', skipped: false },
    }, { env: {}, fetchImpl, createId: () => 'final-plan' })
    expect(final.status).toBe(200)
    expect(final.body.clarifyingQuestion).toBeNull()
    expect(final.body.plan.steps.some((step) => step.title.includes('Bruchgleichungen'))).toBe(true)
    expect(final.body.plan.steps.every((step) => step.description.includes('Bruchgleichungen'))).toBe(true)
    expect(final.body.plan.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(vagueInput.timeBudgetMinutes)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('erstellt nach Überspringen einen finalen Plan und stellt keine weitere Frage', async () => {
    const vagueInput = { ...input, goal: 'Mathematik', learningBlocker: null }
    const first = await handleLearningPlanRequest(vagueInput, { env: {} })
    const result = await handleLearningPlanRequest({
      ...vagueInput,
      clarification: { question: first.body.clarifyingQuestion, answer: '', skipped: true },
    }, { env: {} })

    expect(result.status).toBe(200)
    expect(result.body.clarifyingQuestion).toBeNull()
    expect(result.body.plan.steps.every((step) => !step.title.includes('undefined'))).toBe(true)
    expect(result.body.plan.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(vagueInput.timeBudgetMinutes)
  })

  it('weist mehrdeutige oder ungültige Follow-up-Daten zurück', async () => {
    const base = { ...input, goal: 'Mathematik', learningBlocker: null }
    const malformedAnswer = await handleLearningPlanRequest({
      ...base,
      clarification: { question: 'Welcher Teil?', answer: '', skipped: false },
    }, { env: {} })
    const invalidQuestion = await handleLearningPlanRequest({
      ...base,
      clarification: { question: 'Welcher Teil? Noch etwas?', answer: 'Brüche', skipped: false },
    }, { env: {} })

    expect(malformedAnswer.status).toBe(400)
    expect(invalidQuestion.status).toBe(400)
  })

  it('erzwingt auch beim Groq-Follow-up eine leere Rückfrage', async () => {
    const followup = {
      ...input,
      clarification: { question: 'Welcher JOIN?', answer: 'INNER JOIN', skipped: false },
    }
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ ...validDraft, clarifyingQuestion: 'Noch etwas?' }) } }] }),
    }))
    const result = await handleLearningPlanRequest(followup, groqOptions(fetchImpl))

    expect(result.status).toBe(502)
    expect(result.body.error.code).toBe('invalid_ai_plan')
  })

  it('meldet Netzwerk-, Provider- und Konfigurationsfehler ohne geheime Details', async () => {
    const networkFailure = await handleLearningPlanRequest(input, groqOptions(async () => {
      throw new Error('network down')
    }))
    const providerFailure = await handleLearningPlanRequest(input, groqOptions(async () => ({ ok: false, json: async () => ({}) })))
    const missingConfig = await handleLearningPlanRequest(input, { env: { AI_PROVIDER: 'groq' } })

    expect(networkFailure.status).toBe(502)
    expect(networkFailure.body.error.code).toBe('provider_unavailable')
    expect(providerFailure.status).toBe(502)
    expect(missingConfig.status).toBe(503)
    expect(JSON.stringify(networkFailure.body)).not.toContain('server-only-test-secret')
  })
})
