import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleLearningPlanRequest } from './learningPlanApi.mjs'
import { diagnoseAiPlanDraft, diagnoseAiPlanDraftDetails, validateLearningPlanResponse } from '../shared/learningPlanSchema.mjs'
import { generateLearningPlanWithStatus } from '../src/services/learningPlanApi'

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())
const step = (title, description, minutes, kind, topicFocus) => ({ title, description, minutes, kind, topicFocus })
const exponentialInput = { goal: 'Ich möchte Exponentialfunktionen lernen', timeBudgetMinutes: 50, energyLevel: 'high', learningBlocker: 'starting' }
const statisticsInput = { goal: 'Statistik Grundlagen lernen', timeBudgetMinutes: 20, energyLevel: 'medium', learningBlocker: 'understanding' }
const examInput = { goal: 'Ich muss für meine Klausur lernen', timeBudgetMinutes: 15, energyLevel: 'low', learningBlocker: 'starting' }
// These are synthetic reproductions of the reported error patterns, not the unseen real responses.
const exponential = { clarifyingQuestion: null, steps: [
  step('Unterlagen öffnen', 'Öffne den vorhandenen Abschnitt zu Exponentialfunktionen.', 5, 'preparation', 'Exponentialfunktionen'),
  step('Wachstumsfaktor nachvollziehen', 'Vollziehe in deinen Unterlagen zu Exponentialfunktionen einen vorhandenen Rechenschritt nach.', 15, 'learning', 'Wachstumsfaktor'),
  step('Aufgabe versuchen', 'Versuche eine vorhandene Aufgabe zu Exponentialfunktionen selbst.', 20, 'practice', 'Vorhandene Aufgabe'),
  step('Ergebnis prüfen', 'Vergleiche deine Lösung mit dem vorhandenen Beispiel.', 5, 'practice', 'Ergebnis'),
  step('Fragen festhalten', 'Notiere offene Fragen und den nächsten Lernschritt.', 5, 'reflection', 'Offene Fragen'),
] }
const statistics = { clarifyingQuestion: null, steps: [
  step('Vorhandenes Beispiel öffnen', 'Öffne deine Statistik-Unterlagen und wähle ein vorhandenes Mittelwert-Beispiel.', 5, 'learning', 'Statistik'),
  step('Mittelwert berechnen', 'Vollziehe die Berechnung des Mittelwerts anhand der vorhandenen Beispielaufgabe nach.', 15, 'practice', 'Mittelwert'),
] }
const exam = { clarifyingQuestion: null, steps: [
  step('Unterlagen öffnen', 'Öffne deine vorhandenen Unterlagen und markiere den wichtigsten Abschnitt.', 3, 'preparation', 'Lernstoff'),
  step('Stoff auswählen', 'Wähle eine wichtige vorhandene Aufgabe und versuche ihren ersten Arbeitsschritt.', 9, 'practice', 'Stoffauswahl'),
  step('Selbstprüfung', 'Prüfe deinen Ansatz anhand deiner vorhandenen Lösung und notiere eine offene Frage.', 3, 'reflection', 'Selbstprüfung'),
] }
async function simulate(input, draft, finishReason = 'stop') {
  let sent
  const fetchImpl = vi.fn(async (_url, init) => {
    sent = JSON.parse(init.body)
    return { ok: true, json: async () => ({ choices: [{ finish_reason: finishReason, message: { content: typeof draft === 'string' ? draft : JSON.stringify(draft) } }] }) }
  })
  const result = await handleLearningPlanRequest(input, { env: { AI_PROVIDER: 'groq', GROQ_MODEL: 'offline-gpt-oss', GROQ_API_KEY: 'SYNTHETIC-KEY' }, fetchImpl })
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  return { result, sent }
}
describe('berichtete reale Ablehnungsmuster, offline reproduziert', () => {
  it.each([
    ['A: Exponentialfunktionen, organisatorischer Schritt 3', exponentialInput, exponential, 3],
    ['C: Statistik, Unterbegriff in Schritt 1', statisticsInput, statistics, 1],
    ['D: Klausur, organisatorischer Schritt 0', examInput, exam, 0],
  ])('akzeptiert %s ohne Wortwiederholung', async (_name, input, draft, formerlyRejectedIndex) => {
    expect(draft.steps[formerlyRejectedIndex].description).not.toMatch(input === exponentialInput ? /Exponentialfunktion/ : input === statisticsInput ? /Statistik/ : /Klausur/)
    expect(diagnoseAiPlanDraft(draft, input)).toBeNull()
    const { result } = await simulate(input, draft)
    expect(result.status).toBe(200); expect(validateLearningPlanResponse(result.body, input)).toBe(true)
    expect(result.body.plan.goal).toBe(input.goal)
  })
  it('akzeptiert das Beispiel mit nur einem Themenanker im gesamten Plan', async () => {
    const draft = structuredClone(exponential)
    draft.steps[1].description = 'Vollziehe den Wachstumsfaktor im vorhandenen Beispiel nach.'
    draft.steps[2].description = 'Versuche eine vorhandene Aufgabe selbst.'
    expect((await simulate(exponentialInput, draft)).result.status).toBe(200)
  })
  it.each(['Ich muss für meine Klausur lernen', 'Ich muss für meine Prüfung lernen'])('akzeptiert den allgemeinen Prüfungsplan für %s ohne Einzel-Schritt-Wortliste', async goal => {
    const draft = { clarifyingQuestion: null, steps: [
      step('Unterlagen öffnen', 'Öffne deine vorhandenen Unterlagen.', 2, 'preparation', 'Vorhandenes Material'),
      step('Stoff eingrenzen', 'Begrenze den Lernstoff auf einen kleinen Abschnitt.', 2, 'preparation', 'Umfang'),
      step('Prioritäten setzen', 'Entscheide, welcher Teil heute am wichtigsten ist.', 2, 'preparation', 'Prioritäten'),
      step('Abschnitt bearbeiten', 'Bearbeite nur den ausgewählten Abschnitt.', 5, 'learning', 'Kleiner Lernblock'),
      step('Verständnis prüfen', 'Prüfe dein Verständnis ohne Nachlesen.', 2, 'practice', 'Selbstprüfung'),
      step('Nächsten Lernschritt festhalten', 'Halte den nächsten kleinen Lernschritt fest.', 2, 'reflection', 'Fortsetzung'),
    ] }
    const input = { ...examInput, goal }
    expect(draft.steps.every(s => !/Klausur|Prüfung/.test(s.title + s.description))).toBe(true)
    expect(diagnoseAiPlanDraft(draft, input)).toBeNull()
    const { result } = await simulate(input, draft)
    expect(result.status).toBe(200); expect(validateLearningPlanResponse(result.body, input)).toBe(true)
    // The reported residual index 1 remains unchanged in the accepted plan.
    expect(result.body.plan.steps[1].title).toBe('Stoff eingrenzen')
  })
  it('akzeptiert einen organisatorischen Gesamtplan mit nur einem erkannten Coaching-Anker', async () => {
    const draft = { clarifyingQuestion: null, steps: [
      step('Unterlagen öffnen', 'Öffne deine vorhandenen Unterlagen.', 3, 'preparation', 'Material'),
      step('Prioritäten setzen', 'Entscheide, welcher Abschnitt jetzt zählt.', 3, 'preparation', 'Prioritäten'),
      step('Kleinen Abschnitt bearbeiten', 'Bearbeite diesen begrenzten Abschnitt.', 9, 'practice', 'Lernblock'),
    ] }
    expect((await simulate(examInput, draft)).result.status).toBe(200)
  })
  it.each(['Java', 'Statistik', 'Biologie', 'Französisch'])('blockiert ungefragtes Fach %s auch hinter einem gültigen organisatorischen Plananker', async subject => {
    const draft = { clarifyingQuestion: null, steps: [
      step('Unterlagen öffnen', 'Öffne deine vorhandenen Unterlagen.', 3, 'preparation', 'Material'),
      step('Prioritäten setzen', `Bearbeite einen kleinen Abschnitt zu ${subject}.`, 12, 'practice', 'Lernblock'),
    ] }
    const { result } = await simulate(examInput, draft)
    expect(result.status).toBe(502); expect(result.body.error.schemaCode).toBe('topic_reference_missing')
    const metadata = JSON.parse(console.warn.mock.calls.at(-1)[0])
    expect(metadata.validationErrors).toContainEqual({ schemaCode: 'topic_reference_missing', stepIndex: 1 })
  })
  it('akzeptiert bei allgemeinen Prüfungszielen keinen beliebigen Plan ohne organisatorischen Zusammenhang', async () => {
    const draft = { clarifyingQuestion: null, steps: [step('Zeit verstreichen lassen', 'Warte bis zum Ende.', 15, 'learning', 'Beliebige Aktivität')] }
    expect((await simulate(examInput, draft)).result.body.error.schemaCode).toBe('topic_reference_missing')
  })
  it.each([
    ['Photosynthese', 'Markiere die Photosynthese in deiner vorhandenen Abbildung.'],
    ['Französische Grammatik', 'Übe französische Grammatik in deinen Unterlagen.'],
    ['SQL JOINs', 'Vergleiche SQL INNER JOIN und LEFT JOIN.'],
  ])('blockiert den vollständig fremden Plan zu %s', async (topicFocus, description) => {
    const draft = { clarifyingQuestion: null, steps: [step(topicFocus, description, 50, 'learning', topicFocus)] }
    const { result } = await simulate(exponentialInput, draft)
    expect(result.body.error.schemaCode).toBe('topic_reference_missing')
  })
  it('macht einen rein generischen Plan für ein konkretes Fach nicht gültig', async () => {
    const draft = structuredClone(exponential)
    draft.steps[0].topicFocus = 'Unterlagen'; draft.steps[0].description = 'Öffne deine Unterlagen.'
    draft.steps[1].topicFocus = 'Beispiel'; draft.steps[1].description = 'Vollziehe ein vorhandenes Beispiel nach.'
    draft.steps[2].description = 'Versuche eine vorhandene Aufgabe selbst.'
    expect((await simulate(exponentialInput, draft)).result.body.error.schemaCode).toBe('topic_reference_missing')
  })
  it.each(['Java', 'Statistik', 'Photosynthese', 'SQL', 'Französische Grammatik', 'Physik'])('erfindet bei einer allgemeinen Klausur kein Fach %s', async subject => {
    const draft = structuredClone(exam); draft.steps[1].topicFocus = subject; draft.steps[1].description = `Wähle eine vorhandene Aufgabe zu ${subject}.`
    expect((await simulate(examInput, draft)).result.body.error.schemaCode).toBe('topic_reference_missing')
  })
  it('verwendet einen vom Nutzer genannten Klausur-Schwerpunkt und respektiert Überspringen', async () => {
    const clarification = { question: 'Welches Fach?', answer: 'Java', skipped: false }
    const java = structuredClone(exam); java.steps[1].topicFocus = 'Java'; java.steps[1].description = 'Versuche den ersten Schritt einer vorhandenen Java-Aufgabe.'
    expect((await simulate({ ...examInput, clarification }, java)).result.status).toBe(200)
    expect((await simulate({ ...examInput, clarification: { ...clarification, answer: '', skipped: true } }, java)).result.body.error.schemaCode).toBe('topic_reference_missing')
    expect((await simulate({ ...examInput, goal: 'Java-Klausur vorbereiten' }, java)).result.status).toBe(200)
    expect((await simulate({ ...examInput, goal: 'Java-Klausur vorbereiten' }, exam)).result.body.error.schemaCode).toBe('topic_reference_missing')
  })
  it('blockiert einen erkennbaren Themenwechsel trotz korrektem ersten Themenanker', async () => {
    const draft = structuredClone(exponential); draft.steps[3] = step('Photosynthese prüfen', 'Prüfe das Ergebnis zur Photosynthese.', 5, 'practice', 'Photosynthese')
    const { result } = await simulate(exponentialInput, draft)
    expect(result.body.error.schemaCode).toBe('topic_reference_missing')
    const log = JSON.parse(console.warn.mock.calls.at(-1)[0])
    expect(log.validationErrors).toContainEqual({ schemaCode: 'topic_reference_missing', stepIndex: 3 })
    expect(JSON.stringify(log)).not.toContain('Photosynthese')
  })
  it.each(['Unterlagen öffnen', 'Aufgabe auswählen', 'Ergebnis prüfen', 'Notizen erstellen', 'Offene Fragen festhalten', 'Nächsten Schritt planen', 'Zusammenfassung erstellen'])('erlaubt Coaching-Handlung %s im verankerten Kontext', async title => {
    const draft = { clarifyingQuestion: null, steps: [step('Exponentialfunktionen', 'Öffne deine Exponentialfunktionen-Unterlagen.', 25, 'learning', 'Exponentialfunktionen'), step(title, title + '.', 25, 'reflection', 'Organisation')] }
    expect((await simulate(exponentialInput, draft)).result.status).toBe(200)
  })
  it.each([
    ['minutes_total_mismatch', d => d.steps[3].minutes--],
    ['invalid_step_type', d => { d.steps[3].kind = 'quiz' }],
    ['topic_reference_missing', d => { d.steps[3].topicFocus = '' }],
    ['invalid_response_structure', d => { d.goal = exponentialInput.goal }],
  ])('behält die strikte Regel %s', async (code, mutate) => {
    const draft = structuredClone(exponential); mutate(draft)
    expect((await simulate(exponentialInput, draft)).result.body.error.schemaCode).toBe(code)
  })
  it('blockiert zusätzliche Rückfragen nach finaler Antwort', async () => {
    const draft = structuredClone(statistics); draft.clarifyingQuestion = 'Welcher Teil?'
    const input = { ...statisticsInput, clarification: { question: 'Welcher Teil?', answer: 'Mittelwert', skipped: false } }
    expect((await simulate(input, draft)).result.body.error.schemaCode).toBe('followup_question_forbidden')
  })
  it('erhält die exakte Zielbindung des Browservertrags', async () => {
    const { result } = await simulate(exponentialInput, exponential)
    result.body.plan.goal = 'Photosynthese'
    expect(validateLearningPlanResponse(result.body, exponentialInput)).toBe(false)
  })
  it('B: bietet für einen normalen Java-50-Minuten-Plan eine begrenzte Completion-Reserve', async () => {
    const input = { ...exponentialInput, goal: 'Java lernen' }
    const draft = { clarifyingQuestion: null, steps: [
      step('Java-Beispiel öffnen', 'Öffne eine vorhandene Java-Datei in deinem Editor.', 5, 'preparation', 'Java'),
      step('Variable verändern', 'Ändere den Wert einer vorhandenen Variable und beobachte die Ausgabe.', 10, 'practice', 'Variablen'),
      step('Datentyp prüfen', 'Vergleiche zwei vorhandene Variablen mit unterschiedlichen Datentypen.', 10, 'learning', 'Datentypen'),
      step('Verzweigung versuchen', 'Versuche den nächsten Arbeitsschritt einer vorhandenen if-Aufgabe.', 15, 'practice', 'Bedingung'),
      step('Ergebnis prüfen', 'Vergleiche die Ausgabe mit deinem vorhandenen Beispiel.', 5, 'practice', 'Ergebnis'),
      step('Frage sichern', 'Notiere eine offene Frage und den nächsten Schritt.', 5, 'reflection', 'Offene Fragen'),
    ] }
    let sent
    // A declared simulated completion budget (including reasoning), not a tokenizer estimate.
    const simulatedCompletionTokens = 1700
    const fetchImpl = vi.fn(async (_url, init) => {
      sent = JSON.parse(init.body)
      return { ok: true, json: async () => ({ usage: { completion_tokens: simulatedCompletionTokens }, choices: [{ finish_reason: sent.max_tokens < simulatedCompletionTokens ? 'length' : 'stop', message: { content: JSON.stringify(draft) } }] }) }
    })
    const result = await handleLearningPlanRequest(input, { env: { AI_PROVIDER: 'groq', GROQ_MODEL: 'offline', GROQ_API_KEY: 'SYNTHETIC-KEY' }, fetchImpl })
    expect(result.status).toBe(200); expect(sent.max_tokens).toBe(2048); expect(sent.max_tokens).toBeLessThanOrEqual(2048)
    expect(sent.response_format).toEqual({ type: 'json_object' }); expect(sent.temperature).toBe(0.2); expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(sent.messages[0].content).toContain('normalerweise höchstens sechs')
    expect(sent.messages[0].content).toContain('180')
    expect(result.body.plan.steps).toHaveLength(6)
    expect(diagnoseAiPlanDraftDetails(draft, input)).toEqual([])
  })
  it('klassifiziert echte Truncation weiterhin vor JSON-Parsing oder Themenprüfung', async () => {
    const { result } = await simulate({ ...exponentialInput, goal: 'Java lernen' }, '{"steps":', 'length')
    expect(result.status).toBe(502); expect(result.body.error.category).toBe('model_output_truncated')
    expect((await simulate({ ...exponentialInput, goal: 'Java lernen' }, '{"steps":', 'stop')).result.body.error.category).toBe('invalid_json')
  })
  it('behält auch bei formal vollständig wirkendem JSON das length-Signal bei', async () => {
    expect((await simulate(exponentialInput, exponential, 'length')).result.body.error.category).toBe('model_output_truncated')
  })
  it('liefert weiterhin den verbesserten lokalen Ersatzplan bei absichtlich fremder Antwort', async () => {
    const foreign = { clarifyingQuestion: null, steps: [step('Photosynthese', 'Markiere eine botanische Abbildung.', 50, 'learning', 'Photosynthese')] }
    const { result } = await simulate(exponentialInput, foreign)
    const fetch = vi.fn(async () => ({ ok: false, json: async () => result.body }))
    const fallback = await generateLearningPlanWithStatus(exponentialInput, fetch)
    expect(fetch).toHaveBeenCalledTimes(1); expect(fallback.source).toBe('fallback')
    expect(fallback.plan.steps[0].title).toContain('Unterlagen öffnen'); expect(fallback.plan.steps[2].description).toContain('Schritt für Schritt')
    expect(fallback.plan.steps.reduce((n, s) => n + s.minutes, 0)).toBe(50)
    expect(fallback.notice).toContain('lokaler Ersatzplan'); expect(fallback.notice).toContain(result.body.error.diagnosisId)
  })
})
