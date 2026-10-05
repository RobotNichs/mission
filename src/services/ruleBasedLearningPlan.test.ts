// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { allocateFallbackMinutes, generateRuleBasedLearningPlan } from './ruleBasedLearningPlan'
import { generateLearningPlanWithStatus } from './learningPlanApi'
import { validateEditablePlan } from './planEditor'
import type { EnergyLevel, LearningBlocker, LearningPlanRequest } from '../types/learningPlan'

beforeEach(() => localStorage.clear())
const input: LearningPlanRequest = { goal: 'Ich möchte Exponentialfunktionen lernen', timeBudgetMinutes: 50, energyLevel: 'high', learningBlocker: 'starting' }
describe('konkreter lokaler Organisationsplan', () => {
  it.each([5, 20, 50, 60])('nutzt %i Minuten exakt, ohne Mikroaufgaben oder unvergebene Zeit', timeBudgetMinutes => {
    for (const energyLevel of ['low', 'medium', 'high'] as EnergyLevel[]) {
      for (const learningBlocker of ['starting', 'understanding', 'focus', 'time', 'other', null] as (LearningBlocker | null)[]) {
        const plan = generateRuleBasedLearningPlan({ ...input, timeBudgetMinutes, energyLevel, learningBlocker })
        expect(plan.steps.reduce((n, s) => n + s.minutes, 0)).toBe(timeBudgetMinutes)
        expect(plan.steps.every(s => Number.isInteger(s.minutes) && s.minutes >= 1 && !s.done)).toBe(true)
        expect(plan.steps.some(s => ['learning', 'practice'].includes(s.kind))).toBe(true)
        expect(plan.steps.every(s => s.description.includes(input.goal))).toBe(true)
        expect(validateEditablePlan(plan)).toBeNull()
      }
    }
  })
  it('plant einen konkreten Einstieg und unterschiedlich lange statt fünf gleicher Blöcke', () => {
    const plan = generateRuleBasedLearningPlan(input)
    expect(plan.steps).toHaveLength(5); expect(new Set(plan.steps.map(s => s.minutes)).size).toBeGreaterThan(1)
    expect(plan.steps[0].title).toContain('Unterlagen öffnen')
    expect(plan.steps[0].description).toContain('suche den passenden Abschnitt')
    expect(plan.steps.map(s => s.kind)).toEqual(['preparation', 'learning', 'practice', 'practice', 'reflection'])
    expect(plan.steps[2].description).toContain('Schritt für Schritt')
    expect(plan.steps[3].description).toContain('vorhandenen Aufgabe')
  })
  it('fokussiert bei Verständnisproblemen ein vorhandenes Beispiel und eine konkrete Frage', () => {
    const plan = generateRuleBasedLearningPlan({ ...input, learningBlocker: 'understanding', timeBudgetMinutes: 20 })
    expect(plan.steps[0].description).toContain('konkrete Frage'); expect(plan.steps[1].description).toContain('vorhandenen Beispiels nach')
  })
  it('teilt Konzentrationsprobleme in klar begrenzte Blöcke bis acht Minuten', () => {
    for (const timeBudgetMinutes of [15, 20, 50, 60]) {
      const plan = generateRuleBasedLearningPlan({ ...input, learningBlocker: 'focus', timeBudgetMinutes })
      expect(plan.steps.every(s => s.minutes <= 8)).toBe(true); expect(plan.steps[0].description).toContain('Schließe ablenkende Tabs')
      expect(plan.steps[1].description).toContain('nur den nächsten einzelnen Arbeitsschritt')
    }
  })
  it('senkt bei niedriger Energie die Einstiegshürde und verändert die Zeitverteilung', () => {
    const low = generateRuleBasedLearningPlan({ ...input, energyLevel: 'low' }), high = generateRuleBasedLearningPlan(input)
    expect(low.steps[0].description).toContain('nur einem vorhandenen Beispiel')
    expect(high.steps[0].description).toContain('zuerst selbst')
    expect(low.steps.map(s => s.minutes)).not.toEqual(high.steps.map(s => s.minutes))
  })
  it('priorisiert unter Zeitdruck die vorhandene wichtigste Aufgabe', () => {
    expect(generateRuleBasedLearningPlan({ ...input, learningBlocker: 'time' }).steps[0].description).toContain('wichtigste vorhandene Aufgabe')
  })
  it('plant bei fünf Minuten genau eine tatsächliche Lernhandlung', () => {
    const plan = generateRuleBasedLearningPlan({ ...input, timeBudgetMinutes: 5 })
    expect(plan.steps).toHaveLength(1); expect(plan.steps[0].kind).toBe('practice'); expect(plan.steps[0].description).toContain('nur den ersten Schritt')
  })
  it.each(['Statistik Grundlagen', 'Java lernen', 'SQL INNER JOIN / LEFT JOIN', 'Klausurvorbereitung', 'English vocabulary', 'Ich möchte lernen'])('verwendet Ziel %s sichtbar ohne erfundene Fachinhalte', goal => {
    const plan = generateRuleBasedLearningPlan({ ...input, goal })
    expect(plan.steps.every(s => s.title.includes(goal) && s.description.includes(goal))).toBe(true)
    expect(JSON.stringify(plan)).not.toMatch(/https?:|YouTube|Download|Lehrbuch kaufen/)
  })
  it('übernimmt Rückfrageantwort als Schwerpunkt, aber keinen temporären Rückfragedialog', () => {
    const answer = generateRuleBasedLearningPlan({ ...input, clarification: { question: 'Welcher Teil?', answer: 'Wachstumsfaktor', skipped: false } })
    expect(answer.steps[0].description).toContain('Wachstumsfaktor'); expect(answer).not.toHaveProperty('clarification')
    const skipped = generateRuleBasedLearningPlan({ ...input, clarification: { question: 'Welcher Teil?', answer: '', skipped: true } })
    expect(skipped.steps[0].description).not.toContain('Schwerpunkt:')
  })
  it('begrenzt Texte auch bei maximal langen Zielen, Antworten und Sonstiges', () => {
    const plan = generateRuleBasedLearningPlan({ ...input, goal: 'G'.repeat(280), learningBlocker: 'other', learningBlockerDetails: 'B'.repeat(240), clarification: { question: 'Welcher Teil?', answer: 'A'.repeat(120), skipped: false } })
    expect(validateEditablePlan(plan)).toBeNull(); expect(plan.steps.every(s => s.title.length <= 90 && s.description.length <= 600)).toBe(true)
    expect(plan.learningBlockerDetails).toHaveLength(240)
  })
  it('rundet gewichtete Zeiten deterministisch mit exakter Summe', () => {
    for (let budget = 5; budget <= 60; budget += 5) {
      const minutes = allocateFallbackMinutes(budget, [1, 4, 9, 4, 2])
      expect(minutes.reduce((a, b) => a + b, 0)).toBe(budget); expect(minutes.every(n => n >= 1)).toBe(true)
      expect(allocateFallbackMinutes(budget, [1, 4, 9, 4, 2])).toEqual(minutes)
    }
    expect(() => allocateFallbackMinutes(5, [])).toThrow()
    expect(() => allocateFallbackMinutes(1, [1, 1])).toThrow()
    expect(() => allocateFallbackMinutes(5, [NaN])).toThrow()
  })
  it('liefert bei Schemafehlern einen klar markierten Ersatzplan und keinen zusätzlichen API-Aufruf', async () => {
    const fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: { category: 'invalid_plan_schema', diagnosisId: '61ef8fbd-7cc1-42ea-9e36-7b3741d9ef1a', schemaCode: 'minutes_total_mismatch', message: 'PRIVATE-RESPONSE', validationErrors: [{ field: 'PRIVATE-FIELD' }] } }) })) as unknown as typeof globalThis.fetch
    const result = await generateLearningPlanWithStatus(input, fetch)
    expect(result.source).toBe('fallback'); expect(result.notice).toContain('lokaler Ersatzplan'); expect(result.notice).toContain('61ef8fbd-7cc1-42ea-9e36-7b3741d9ef1a')
    expect(result.notice).not.toContain('PRIVATE'); expect(result.notice).not.toContain('minutes_total_mismatch'); expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.plan.steps[0].title).toContain('Unterlagen öffnen')
  })
  it('ändert keine gespeicherten Missions-, Bibliotheks- oder Fortschrittsdaten', () => {
    const keys = ['mission.saved-mission.v1', 'mission.gamification.v1', 'mission.templates.v1']
    keys.forEach(k => localStorage.setItem(k, 'unchanged'))
    generateRuleBasedLearningPlan(input)
    keys.forEach(k => expect(localStorage.getItem(k)).toBe('unchanged'))
  })
})
