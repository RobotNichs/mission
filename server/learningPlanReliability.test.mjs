import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { diagnoseAiPlanDraft, diagnoseAiPlanDraftDetails, diagnosePlanQuality, validateLearningPlanResponse } from '../shared/learningPlanSchema.mjs'
import { handleLearningPlanRequest } from './learningPlanApi.mjs'

// Offline failure matrix: each goal receives independent valid and malformed drafts.
const cases = [
  ['Ich möchte Exponentialfunktionen lernen', 50, 'high', 'starting', 'Wachstumsfaktor'],
  ['Statistik lernen', 20, 'medium', 'understanding', 'Mittelwert'],
  ['Java lernen', 50, 'high', 'starting', 'Variablen'],
  ['Ich möchte Java lernen', 50, 'high', 'starting', 'Datentypen'],
  ['SQL INNER JOIN und LEFT JOIN', 60, 'medium', 'focus', 'Ergebniszeilen'],
  ['Klausurvorbereitung', 60, 'low', 'time', 'Stoffauswahl'],
  ['Englisch lernen', 5, 'low', 'focus', 'Vokabeln'],
  ['Lernen für die Prüfung', 20, 'medium', 'starting', 'Prüfungsstoff'],
  ['Eine Java if-Verzweigung nachvollziehen', 5, 'high', 'understanding', 'Bedingung'],
  ['English vocabulary', 20, 'medium', 'other', 'Word list'],
]
function draftFor(input, topic) {
  return { clarifyingQuestion: null, steps: [{ title: 'Vorhandenes Beispiel bearbeiten', topicFocus: topic,
    description: `Öffne deine vorhandenen Unterlagen zu „${input.goal}“ und versuche nur den ersten Schritt eines Beispiels.`, minutes: input.timeBudgetMinutes, kind: 'practice' }] }
}
async function simulate(input, draft) {
  const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(draft) } }] }) }))
  const result = await handleLearningPlanRequest(input, { env: { AI_PROVIDER: 'groq', GROQ_MODEL: 'offline', GROQ_API_KEY: 'SYNTHETIC-SECRET' }, fetchImpl })
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  return result
}
beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

describe.each(cases)('Failure-Matrix: %s / %i min / %s / %s', (goal, timeBudgetMinutes, energyLevel, learningBlocker, topic) => {
  const input = { goal, timeBudgetMinutes, energyLevel, learningBlocker }
  const make = () => draftFor(input, topic)
  it('akzeptiert Unterbegriff mit eindeutigem Kontext und erhält den API-Vertrag', async () => {
    const result = await simulate(input, make()); expect(result.status).toBe(200); expect(validateLearningPlanResponse(result.body, input)).toBe(true)
    expect(Object.keys(result.body).sort()).toEqual(['clarifyingQuestion', 'plan', 'source'])
  })
  it('akzeptiert Themenbezug ausschließlich im Titel bei abstraktem topicFocus', async () => {
    const d = make(); Object.assign(d.steps[0], { title: goal, topicFocus: 'Vorhandener Teilbereich', description: 'Versuche den ersten Schritt eines vorhandenen Beispiels.' })
    expect((await simulate(input, d)).status).toBe(200)
  })
  it('akzeptiert Themenbezug ausschließlich in leicht umformulierter Beschreibung', async () => {
    const d = make(); Object.assign(d.steps[0], { title: 'Eine Stelle markieren', topicFocus: 'Ein Beispiel', description: `Markiere für ${goal.toUpperCase()} den ersten Arbeitsschritt in deinen Unterlagen.` })
    expect((await simulate(input, d)).status).toBe(200)
  })
  it.each([
    ['minutes_total_mismatch', d => { d.steps[0].minutes-- }],
    ['invalid_step_type', d => { d.steps[0].kind = 'quiz' }],
    ['invalid_response_structure', d => { delete d.steps[0].description }],
    ['invalid_response_structure', d => { d.steps[0].unknown = 'PRIVATE-MODEL-TEXT' }],
    ['invalid_step_count', d => { d.steps = Array.from({ length: 13 }, () => ({ ...d.steps[0], minutes: 1 })) }],
    ['learning_activity_missing', d => { d.steps[0].kind = 'preparation' }],
    ['topic_reference_missing', d => { Object.assign(d.steps[0], { title: 'Photosynthese verstehen', description: 'Markiere ein Blatt in einer botanischen Abbildung.', topicFocus: 'Photosynthese' }) }],
  ])('blockiert %s mit sicherer Diagnose und ohne Retry', async (code, mutate) => {
    const d = make(); mutate(d); const result = await simulate(input, d)
    expect(result.status).toBe(502); expect(result.body.error.schemaCode).toBe(code)
    expect(result.body.error.diagnosisId).toMatch(/^[0-9a-f-]{36}$/)
    const log = JSON.parse(console.warn.mock.calls.at(-1)[0])
    expect(log.category).toBe('invalid_plan_schema'); expect(log.validationErrors[0].schemaCode).toBe(code)
    expect(JSON.stringify([log, result])).not.toContain('SYNTHETIC-SECRET'); expect(JSON.stringify([log, result])).not.toContain('PRIVATE-MODEL-TEXT'); expect(JSON.stringify(log)).not.toContain(goal)
  })
  it('erhält die erste erlaubte Rückfrage, blockiert jede zusätzliche nach Antwort oder Überspringen', async () => {
    const d = make(); d.clarifyingQuestion = 'Welcher Teil ist für dich am wichtigsten?'
    expect((await simulate(input, d)).status).toBe(200)
    for (const skipped of [false, true]) {
      const result = await simulate({ ...input, clarification: { question: d.clarifyingQuestion, answer: skipped ? '' : topic, skipped } }, d)
      expect(result.body.error.schemaCode).toBe('followup_question_forbidden')
    }
  })
  it('meldet zu generische Lernhandlungen, ohne fachlich plausible Antworten zusätzlich zu blockieren', async () => {
    const d = make(); d.steps[0].title = 'Thema verstehen'; d.steps[0].description = `${goal} verstehen und üben. Eine vorhandene Aufgabe auswählen.`
    expect(diagnosePlanQuality(d)).toContain('concrete_start_unclear')
    expect((await simulate(input, d)).status).toBe(200)
    expect(JSON.parse(console.warn.mock.calls.at(-1)[0]).warningCodes).toContain('concrete_start_unclear')
  })
})

it('akzeptiert nur konservative vollständige Wortvarianten statt beliebiger Teilwörter', () => {
  const input = { goal: 'Exponentialfunktionen lernen', timeBudgetMinutes: 20, energyLevel: 'high', learningBlocker: 'starting' }
  const d = draftFor(input, 'Wachstumsfaktor')
  d.steps[0].description = 'Öffne eine vorhandene Aufgabe zur Exponentialfunktion und markiere ihren ersten Schritt.'
  expect(diagnoseAiPlanDraft(d, input)).toBeNull()
  d.steps[0].description = 'Öffne eine Exponentialfunktionensoftware.'
  expect(diagnoseAiPlanDraft(d, input)).toBe('topic_reference_missing')
})
it.each(['lernen', 'verstehen', 'machen', 'Thema', 'Aufgabe', 'understand', 'task', 'topic'])('akzeptiert Allerweltswort %s nicht als Themenbezug', word => {
  const input = { goal: `Statistik ${word}`, timeBudgetMinutes: 5, energyLevel: 'low', learningBlocker: null }
  const d = draftFor(input, word); d.steps[0].title = word; d.steps[0].description = `Bitte ${word}.`
  expect(diagnoseAiPlanDraft(d, input)).toBe('topic_reference_missing')
})
it('diagnostiziert rein allgemeines Lernziel ohne erfundene semantische Zuordnung', () => {
  const input = { goal: 'Ich möchte lernen', timeBudgetMinutes: 5, energyLevel: 'low', learningBlocker: 'starting' }
  expect(diagnoseAiPlanDraft(draftFor(input, 'Thema'), input)).toBe('topic_reference_missing')
})
it('sammelt höchstens acht eindeutige Fehler mit sicheren Feldern und nullbasiertem Schrittindex', () => {
  const input = { goal: 'Statistik', timeBudgetMinutes: 20, energyLevel: 'high', learningBlocker: null }
  const d = draftFor(input, 'Statistik')
  d.steps = [{ ...d.steps[0], title: '', description: '', minutes: 0, kind: 'unknown' }, { ...d.steps[0], minutes: 0, kind: 'unknown' }]
  const errors = diagnoseAiPlanDraftDetails(d, input)
  expect(errors).toContainEqual({ schemaCode: 'invalid_step_type', field: 'kind', stepIndex: 0 })
  expect(errors).toContainEqual({ schemaCode: 'invalid_step_minutes', field: 'minutes', stepIndex: 0 })
  expect(new Set(errors.map(e => e.schemaCode)).size).toBe(errors.length); expect(errors.length).toBeLessThanOrEqual(8)
  expect(diagnoseAiPlanDraft(d, input)).toBe(errors[0].schemaCode)
})
it('zeigt unkonkrete und überladene Schritte nur als technische Warnung, ohne neue Ablehnungsregel', async () => {
  const input = { goal: 'Java lernen', timeBudgetMinutes: 5, energyLevel: 'low', learningBlocker: null }
  const d = draftFor(input, 'Java'); d.steps[0].description = 'Java verstehen und wiederholen und üben und prüfen.'
  expect(diagnosePlanQuality(d)).toEqual(['concrete_start_unclear', 'short_step_overload_possible'])
  expect((await simulate(input, d)).status).toBe(200)
  expect(JSON.stringify(console.warn.mock.calls)).not.toContain(d.steps[0].description)
  const repeated = { ...d, steps: [d.steps[0], { ...d.steps[0] }] }
  expect(diagnosePlanQuality(repeated)).toContain('repeated_step_text')
})
