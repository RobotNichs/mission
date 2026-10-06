// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateRuleBasedLearningPlan } from './ruleBasedLearningPlan'
import { generateLearningPlanWithStatus } from './learningPlanApi'
import { validateEditablePlan } from './planEditor'
import { exampleTemplates, exportTemplate, importTemplate, loadTemplates, missionFromTemplate, saveTemplate, templateFromPlan, validateTemplate } from './missionTemplates'
import type { LearningPlanRequest } from '../types/learningPlan'
import type { LearningContext } from '../../shared/learningContext.mjs'

const input: LearningPlanRequest = { goal: 'Statistik Grundlagen lernen', timeBudgetMinutes: 50, energyLevel: 'medium', learningBlocker: 'starting' }
const text = (context?: LearningContext, patch: Partial<LearningPlanRequest> = {}) => generateRuleBasedLearningPlan({ ...input, ...patch, ...(context ? { learningContext: context } : {}) }).steps.map(s => s.description).join(' ')
beforeEach(() => localStorage.clear())

describe('lokale kontextbezogene Organisationsplanung', () => {
  it('funktioniert ohne Kontext mit neutralen Materialien ohne konkrete Buch-/Skriptannahme', () => {
    expect(text()).toContain('vorhandenen Unterlagen')
    expect(text()).not.toMatch(/Mathebuch|Musterlösung|Skript|Vorlesungsfolien/)
  })
  it.each([
    [{ environment: 'university', materials: ['slides'] }, 'Vorlesungsfolien'],
    [{ environment: 'school', materials: ['book'] }, 'Buch'],
    [{ materials: ['script', 'worksheets'] }, 'Übungsblätter'],
    [{ materials: ['other'], materialsDetails: 'Meine Karteikarten' }, 'Meine Karteikarten'],
  ] as [LearningContext, string][])('nutzt ausdrücklich verfügbare Materialien %j', (context, expected) => {
    expect(text(context)).toContain(expected)
    expect(text(context)).not.toContain('Musterlösung')
  })
  it.each([5, 20, 50, 60])('setzt bei %i Minuten und fehlenden Materialien keine voraus', timeBudgetMinutes => {
    for (const learningBlocker of ['starting', 'understanding', 'focus', 'time', 'other', null] as const) {
      const plan = generateRuleBasedLearningPlan({ ...input, timeBudgetMinutes, learningBlocker, learningContext: { environment: 'private', materials: ['none'] } })
      const copy = plan.steps.map(s => `${s.title} ${s.description}`).join(' ')
      expect(copy).not.toMatch(/Unterlagen|Skript|Buch|Folien|vorhandene[nmsr]? Beispiel|Musterlösung|Studium|Klausur/)
      expect(plan.steps.reduce((sum, s) => sum + s.minutes, 0)).toBe(timeBudgetMinutes)
      expect(validateEditablePlan(plan)).toBeNull()
      expect(copy).toContain('eigene')
    }
  })
  it('nutzt Beruf und Projekt für einen kleinen Umsetzungsschritt', () => {
    const copy = text({ environment: 'work', purpose: 'project', materials: ['none'] })
    expect(copy).toContain('Arbeitsalltag')
    expect(copy).toContain('nächsten kleinen Teil deines Projekts')
    expect(copy).not.toMatch(/Klausur|Vorlesungsfolien|Skript/)
  })
  it.each([
    ['exam', 'prüfungsrelevanten Teil', 'ohne Nachlesen'], ['revision', 'aus dem Gedächtnis', 'Lücke'],
    ['new-topic', 'neuen Thema', 'Kernaussage'], ['interest', 'ohne Prüfungsdruck', 'interessiert'], ['homework', 'Hausaufgabe', 'kleinen Teil'],
  ] as const)('berücksichtigt Lernzweck %s', (purpose, first, second) => {
    const copy = text({ purpose })
    expect(copy).toContain(first); expect(copy).toContain(second)
  })
  it.each([
    ['starting', 'genau einen kleinen Abschnitt'], ['understanding', 'ersten Schritt eines vorhandenen Beispiels'],
    ['focus', 'ohne Kontextwechsel'], ['time', 'weniger relevante Teile weg'],
  ] as const)('macht Blockade %s sichtbar', (learningBlocker, expected) => {
    const plan = generateRuleBasedLearningPlan({ ...input, learningBlocker, learningContext: { materials: ['slides'] } })
    expect(plan.steps[0].description).toContain(expected)
    if (learningBlocker === 'focus') expect(plan.steps.every(s => s.minutes <= 8)).toBe(true)
  })
  it('berücksichtigt Sonstiges und Energie ohne Diagnose', () => {
    expect(text({ materials: ['slides'] }, { learningBlocker: 'other', learningBlockerDetails: 'Zu viele Unterlagen' })).toContain('Zu viele Unterlagen')
    const low = text({ materials: ['slides'] }, { energyLevel: 'low' }), high = text({ materials: ['slides'] }, { energyLevel: 'high' })
    expect(low).toContain('nur einem vorhandenen Beispiel'); expect(high).toContain('zuerst selbst')
  })
  it('erhält Sonstiges und Energie auch ohne Materialien', () => {
    expect(text({ materials: ['none'] }, { learningBlocker: 'other', learningBlockerDetails: 'Zu viele Ideen' })).toContain('Zu viele Ideen')
    expect(text({ materials: ['none'] }, { energyLevel: 'low' })).toContain('Ein kleiner eigener Versuch genügt')
    expect(text({ materials: ['none'] }, { energyLevel: 'high' })).toContain('nächsten eigenen Schritt zuerst selbst')
  })
  it('verwendet eine beantwortete Materialfrage und respektiert fehlende Materialien', () => {
    const clarification = { question: 'Welche Materialien hast du?', answer: 'Vorlesungsfolien', skipped: false }
    expect(text(undefined, { clarification })).toContain('Vorlesungsfolien')
    const plan = generateRuleBasedLearningPlan({ ...input, clarification: { ...clarification, answer: 'Keine' } })
    expect(plan.steps.map(s => `${s.title} ${s.description}`).join(' ')).not.toContain('Unterlagen')
    expect(plan).not.toHaveProperty('clarification')
  })
  it('liefert bei API-Fehler einen konkreten Kontext-Fallback ohne zweiten Request', async () => {
    const fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: { category: 'invalid_plan_schema', diagnosisId: '61ef8fbd-7cc1-42ea-9e36-7b3741d9ef1a' } }) })) as unknown as typeof globalThis.fetch
    const result = await generateLearningPlanWithStatus({ ...input, learningContext: { materials: ['none'], purpose: 'project' } }, fetch)
    expect(result.source).toBe('fallback'); expect(result.notice).toContain('lokaler Ersatzplan')
    expect(result.plan.steps[0].title).toContain('Eine Frage wählen')
    expect(result.plan.steps.map(s => s.description).join(' ')).not.toContain('Unterlagen')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('optionaler Lernkontext in Vorlagen', () => {
  const metadata = { title: 'Mein Plan', description: '', category: 'Statistik' as const, language: 'de' as const, tags: [], origin: 'custom' as const }
  it('erhält alte Vorlagen ohne Kontext unverändert', () => {
    const template = validateTemplate(exampleTemplates[0])
    expect(template).not.toHaveProperty('learningContext')
    expect(missionFromTemplate(template)).not.toHaveProperty('learningContext')
  })
  it('speichert, lädt, exportiert und importiert optionalen Kontext ohne Sessiondaten', () => {
    const plan = generateRuleBasedLearningPlan({ ...input, learningContext: { environment: 'university', purpose: 'revision', materials: ['slides', 'other'], materialsDetails: 'Karteikarten' } })
    plan.steps[0].done = true
    const template = templateFromPlan(plan, metadata)
    saveTemplate(template)
    expect(loadTemplates()[0].learningContext).toEqual(plan.learningContext)
    const raw = exportTemplate(template), imported = importTemplate(raw)
    expect(imported.learningContext).toEqual(plan.learningContext)
    expect(imported.id).not.toBe(template.id)
    expect(raw).not.toMatch(/"done"|"coins"|"sessionId"|"clarification"|"energyLevel"/)
  })
  it('kopiert Kontext bei neuer Mission, die unabhängig bearbeitbar bleibt', () => {
    const plan = generateRuleBasedLearningPlan({ ...input, learningContext: { materials: ['slides'] } })
    const template = templateFromPlan(plan, metadata)
    const fresh = missionFromTemplate(template)
    expect(fresh.id).not.toBe(plan.id); expect(fresh.steps.every(s => !s.done)).toBe(true)
    fresh.learningContext!.materials!.push('book')
    expect(template.learningContext!.materials).toEqual(['slides'])
    expect(plan.learningContext!.materials).toEqual(['slides'])
  })
  it('übernimmt Kontextänderungen oder -entfernung nur durch ausdrückliches Aktualisieren', () => {
    const template = templateFromPlan(generateRuleBasedLearningPlan({ ...input, learningContext: { materials: ['book'] } }), metadata)
    const plan = missionFromTemplate(template)
    delete plan.learningContext
    const updated = templateFromPlan(plan, { ...template }, template)
    expect(updated.learningContext).toBeUndefined()
    expect(updated.id).toBe(template.id)
    expect(template.learningContext?.materials).toEqual(['book'])
  })
  it('weist beschädigten Importkontext ab, ohne vorhandene Vorlagen zu ändern', () => {
    const template = templateFromPlan(generateRuleBasedLearningPlan(input), metadata)
    saveTemplate(template)
    const before = localStorage.getItem('mission.templates.v1')
    expect(() => importTemplate(JSON.stringify({ format: 'mission-template', version: 1, template: { ...template, learningContext: { materials: ['none', 'book'] } } }))).toThrow()
    expect(localStorage.getItem('mission.templates.v1')).toBe(before)
  })
  it('ändert durch Kontext- und Vorlagenaktionen keine Gamification oder aktive Mission', () => {
    localStorage.setItem('mission.gamification.v1', '{"coins":30,"totalFocusMilliseconds":120000}')
    localStorage.setItem('mission.saved-mission.v1', '{"remainingSeconds":123,"elapsedSeconds":12}')
    const before = [localStorage.getItem('mission.gamification.v1'), localStorage.getItem('mission.saved-mission.v1')]
    const template = templateFromPlan(generateRuleBasedLearningPlan({ ...input, learningContext: { materials: ['none'] } }), metadata)
    saveTemplate(template); missionFromTemplate(loadTemplates()[0]); importTemplate(exportTemplate(template))
    expect([localStorage.getItem('mission.gamification.v1'), localStorage.getItem('mission.saved-mission.v1')]).toEqual(before)
  })
})
