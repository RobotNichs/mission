import { describe, expect, it, vi } from 'vitest'
import { handleLearningPlanRequest } from './learningPlanApi.mjs'
import { diagnoseAiPlanDraft, validateLearningPlanResponse, validatePlanInput } from '../shared/learningPlanSchema.mjs'
import { needsMaterialQuestion, readLearningContext, validateLearningContext } from '../shared/learningContext.mjs'

const base = { goal: 'Statistik Grundlagen lernen', timeBudgetMinutes: 20, energyLevel: 'medium', learningBlocker: null }
const draft = description => ({ clarifyingQuestion: null, steps: [{ title: 'Mittelwert nachvollziehen', topicFocus: 'Statistik', minutes: 20, kind: 'practice', description }] })
const simulate = (input, modelDraft, fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(modelDraft) }, finish_reason: 'stop' }] }) }))) =>
  handleLearningPlanRequest(input, { env: { AI_PROVIDER: 'groq', GROQ_MODEL: 'test-model', GROQ_API_KEY: 'fake-context-key' }, fetchImpl })

describe('rückwärtskompatibler Lernkontext-Vertrag', () => {
  it('akzeptiert den alten Request und die unveränderte Antwort ohne Kontext', async () => {
    expect(validatePlanInput(base)).toBe(true)
    const result = await handleLearningPlanRequest(base, { env: { AI_PROVIDER: 'mock' } })
    expect(result.status).toBe(200)
    expect(result.body.plan).not.toHaveProperty('learningContext')
    expect(validateLearningPlanResponse(result.body, base)).toBe(true)
  })
  it.each([
    {}, { environment: 'university', materials: ['slides'] }, { environment: 'school', materials: ['book'] },
    { environment: 'private', materials: ['none'] }, { environment: 'work', purpose: 'project' },
    { purpose: 'exam' }, { purpose: 'new-topic' }, { purpose: 'revision' }, { purpose: 'interest' },
    { environment: 'training', purpose: 'homework', materials: ['script', 'worksheets', 'tasks', 'notes', 'online'] },
    { environment: 'other', purpose: 'other', materials: ['other'], materialsDetails: 'Eigene Karteikarten' },
  ])('validiert und überträgt optionalen Kontext %j', async learningContext => {
    const input = { ...base, learningContext }
    expect(validatePlanInput(input)).toBe(true)
    const result = await handleLearningPlanRequest(input, { env: { AI_PROVIDER: 'mock' } })
    expect(result.status).toBe(200)
    expect(result.body.plan.learningContext).toEqual(learningContext)
    expect(validateLearningPlanResponse(result.body, input)).toBe(true)
  })
  it.each([null, [], { environment: 'unknown' }, { purpose: 42 }, { materials: 'book' },
    { materials: ['none', 'book'] }, { materials: ['book', 'book'] }, { materials: ['unknown'] },
    { materialsDetails: 'ohne Sonstiges' }, { materials: ['other'], materialsDetails: 'x'.repeat(241) },
    { materials: ['other'], materialsDetails: '<script>bad</script>' }, { coins: 300 },
  ])('weist ungültigen Kontext sicher als 400 zurück: %j', async learningContext => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(validateLearningContext(learningContext)).toBe(false)
      const fetchImpl = vi.fn()
      const result = await handleLearningPlanRequest({ ...base, learningContext }, { fetchImpl })
      expect(result.status).toBe(400)
      expect(fetchImpl).not.toHaveBeenCalled()
    } finally { log.mockRestore() }
  })
  it('kopiert Materialarrays und trimmt begrenzten Freitext', () => {
    const raw = { materials: ['other'], materialsDetails: '  Karteikarten  ' }
    const safe = readLearningContext(raw)
    safe.materials.push('book')
    expect(raw.materials).toEqual(['other'])
    expect(safe.materialsDetails).toBe('Karteikarten')
    expect(readLearningContext({ materials: ['bad'] })).toBeUndefined()
  })
  it('überträgt Kontext nur als Nutzerdaten und behält Providerparameter ohne Retry bei', async () => {
    let body
    const fetchImpl = vi.fn(async (_url, init) => {
      body = JSON.parse(init.body)
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(draft('Versuche einen kleinen Statistik-Arbeitsschritt.')) } }] }) }
    })
    const learningContext = { environment: 'university', materials: ['slides', 'other'], materialsDetails: 'Meine Karten' }
    const result = await simulate({ ...base, learningContext }, draft(''), fetchImpl)
    expect(result.status).toBe(200)
    expect(JSON.parse(body.messages[1].content).learningContext).toEqual(learningContext)
    expect(body.messages[0].content).toContain('materials=["none"]')
    expect(body.messages[0].content).toContain('keine Pflichtfrage')
    expect(body.messages[0].content).not.toContain('Meine Karten')
    expect(body.max_tokens).toBe(2048)
    expect(body.temperature).toBe(0.2)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('erkennt direkte unbekannte Materialannahmen mit sicherem Code, ohne Rohtexte zu protokollieren', async () => {
    const marker = 'PrivaterMaterialText-123'
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const result = await simulate({ ...base, learningContext: { materials: ['other'], materialsDetails: marker } }, draft('Öffne dein Mathebuch und übe Statistik.'))
      expect(result.status).toBe(502)
      expect(result.body.error.schemaCode).toBe('material_reference_unavailable')
      expect(result.body.error.diagnosisId).toMatch(/^[0-9a-f-]{36}$/)
      const output = JSON.stringify(log.mock.calls) + JSON.stringify(result.body)
      for (const secret of [marker, base.goal, 'Mathebuch', 'fake-context-key']) expect(output).not.toContain(secret)
      expect(JSON.parse(log.mock.calls[0][0]).validationErrors).toContainEqual({ schemaCode: 'material_reference_unavailable', field: 'description', stepIndex: 0 })
    } finally { log.mockRestore() }
  })
})

describe('Materialannahmen und gezielte Rückfragen', () => {
  it.each(['Öffne dein Mathebuch.', 'Nutze deine Musterlösung.', 'Schlage im Skript nach.'])('blockiert die unbelegte Anweisung %s', description => {
    // Topic anchor remains in topicFocus, so only the resource rule fails.
    expect(diagnoseAiPlanDraft(draft(description), base)).toBe('material_reference_unavailable')
  })
  it('akzeptiert ausdrücklich bekannte Vorlesungsfolien und neutrale Unterlagen', () => {
    expect(diagnoseAiPlanDraft(draft('Öffne deine Vorlesungsfolien.'), { ...base, learningContext: { materials: ['slides'] } })).toBeNull()
    expect(diagnoseAiPlanDraft(draft('Öffne deine vorhandenen Lernunterlagen.'), base)).toBeNull()
    expect(diagnoseAiPlanDraft(draft('Nutze deine Musterlösung, falls eine vorhanden ist.'), base)).toBeNull()
  })
  it('lässt einen bedingten Hinweis nicht eine separate unbelegte Materialanweisung verdecken', () => {
    expect(diagnoseAiPlanDraft(draft('Öffne dein Mathebuch. Nutze deine Musterlösung, falls eine vorhanden ist.'), base)).toBe('material_reference_unavailable')
  })
  it('berücksichtigt vom Nutzer im Ziel oder in der Materialantwort benannte Ressourcen', () => {
    expect(diagnoseAiPlanDraft(draft('Öffne dein Statistikbuch.'), { ...base, goal: 'Statistik mit meinem Statistikbuch lernen' })).toBeNull()
    expect(diagnoseAiPlanDraft(draft('Öffne dein Buch.'), { ...base, clarification: { question: 'Welche Materialien?', answer: 'Buch', skipped: false } })).toBeNull()
  })
  it('verbietet vorhandene Unterlagen bei ausdrücklich fehlenden Materialien', () => {
    const input = { ...base, learningContext: { materials: ['none'] } }
    expect(diagnoseAiPlanDraft(draft('Öffne deine vorhandenen Unterlagen.'), input)).toBe('material_reference_unavailable')
    expect(diagnoseAiPlanDraft(draft('Notiere eine eigene Frage und versuche eine Antwort.'), input)).toBeNull()
  })
  it('fragt nach Materialien nur bei konkretem Bedarf, nicht bei angegebenem Material', async () => {
    const input = { ...base, goal: 'Statistik Aufgaben bearbeiten', learningBlocker: 'starting' }
    expect(needsMaterialQuestion(input)).toBe(true)
    for (const materials of [['slides'], ['none']]) expect(needsMaterialQuestion({ ...input, learningContext: { materials } })).toBe(false)
    expect(needsMaterialQuestion(base)).toBe(false)
    const first = await handleLearningPlanRequest(input, { env: { AI_PROVIDER: 'mock' } })
    expect(first.body.clarifyingQuestion).toBe('Welche Materialien hast du gerade zur Verfügung?')
    for (const answer of ['Vorlesungsfolien', 'Keine', '']) {
      const skipped = answer === ''
      const next = await handleLearningPlanRequest({ ...input, clarification: { question: first.body.clarifyingQuestion, answer, skipped } }, { env: { AI_PROVIDER: 'mock' } })
      expect(next.status).toBe(200)
      expect(next.body.clarifyingQuestion).toBeNull()
      if (answer === 'Vorlesungsfolien') expect(next.body.plan.steps[0].description).toContain('Vorlesungsfolien')
      if (answer === 'Keine') expect(next.body.plan.steps.map(s => s.description).join(' ')).not.toContain('Unterlagen')
    }
  })
  it('blockiert trotz neuem Kontext eine zweite Modellrückfrage', () => {
    const input = { ...base, learningContext: { materials: ['book'] }, clarification: { question: 'Welche Materialien?', answer: '', skipped: true } }
    expect(diagnoseAiPlanDraft({ ...draft('Öffne dein Buch.'), clarifyingQuestion: 'Welche Seiten?' }, input)).toBe('followup_question_forbidden')
  })
  it('akzeptiert keine manipulierte oder unterschlagene Kontextantwort', async () => {
    const input = { ...base, learningContext: { materials: ['none'] } }
    const response = (await handleLearningPlanRequest(input, { env: { AI_PROVIDER: 'mock' } })).body
    expect(validateLearningPlanResponse(response, input)).toBe(true)
    response.plan.learningContext = { materials: ['book'] }
    expect(validateLearningPlanResponse(response, input)).toBe(false)
    delete response.plan.learningContext
    expect(validateLearningPlanResponse(response, input)).toBe(false)
  })
})
