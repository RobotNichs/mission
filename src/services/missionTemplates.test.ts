// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { categories, deleteTemplate, duplicateTemplate, exampleTemplates, exportTemplate, findTemplates, importTemplate, loadTemplates, MAX_TEMPLATES, missionFromTemplate, normalizeTags, saveTemplate, templateFilename, templateFromPlan, TEMPLATE_STORAGE_KEY, validateTemplate } from './missionTemplates'
import type { MissionTemplate } from './missionTemplates'

beforeEach(() => localStorage.clear())
const base = () => duplicateTemplate(exampleTemplates[0])
describe('lokaler Template-Vertrag', () => {
  it.each(['custom', 'ai'] as const)('speichert einen %s-Plan ausschließlich als Planinhalt', origin => {
    const plan = missionFromTemplate(exampleTemplates[0]); plan.steps[0].done = true
    const t = templateFromPlan(plan, { title: 'SQL', description: '', category: 'Informatik', language: 'de', tags: [' sql ', 'SQL'], origin })
    saveTemplate(t)
    expect(loadTemplates()).toEqual([t]); expect(t.origin).toBe(origin); expect(t.tags).toEqual(['sql'])
    expect(JSON.stringify(t)).not.toMatch(/done|coins|focusSeconds|sessionId|energyLevel/)
  })
  it.each(['automatic', 'manual', 'stopwatch'] as const)('übernimmt Zeitmodus %s ohne Fortschritt', timeMode => {
    const plan = missionFromTemplate(exampleTemplates[0]); plan.timeMode = timeMode; plan.timeBudgetMinutes = 90
    const t = templateFromPlan(plan, { ...base(), origin: 'custom' })
    const fresh = missionFromTemplate(t)
    expect(fresh.timeMode).toBe(timeMode); expect(fresh.steps.every(s => !s.done)).toBe(true)
    expect(t.plannedMinutes).toBe(timeMode === 'stopwatch' ? null : timeMode === 'manual' ? 90 : 30)
  })
  it('erzeugt bei jeder Verwendung neue Missions- und Schritt-IDs', () => {
    const a = missionFromTemplate(exampleTemplates[0]), b = missionFromTemplate(exampleTemplates[0])
    expect(a.id).not.toBe(b.id); expect(a.steps.map(s => s.id)).not.toEqual(b.steps.map(s => s.id))
    a.steps[0].title = 'Geändert'; expect(exampleTemplates[0].steps[0].title).not.toBe('Geändert')
  })
  it('aktualisiert eine Vorlage explizit unter derselben ID', () => {
    const t = base(); saveTemplate(t)
    const p = missionFromTemplate(t); p.steps[0].title = 'Neue Handlung'
    const updated = templateFromPlan(p, { ...t, title: 'Neuer Titel' }, t); saveTemplate(updated)
    expect(loadTemplates()).toHaveLength(1); expect(updated.id).toBe(t.id); expect(updated.createdAt).toBe(t.createdAt)
    expect(loadTemplates()[0].steps[0].title).toBe('Neue Handlung')
  })
  it('vergibt beim Duplizieren eine eigene ID und behält Inhalte', () => {
    const t = base(), d = duplicateTemplate(t); expect(d.id).not.toBe(t.id); expect(d.steps).toEqual(t.steps); expect(d.origin).toBe('custom')
  })
  it('löscht eigene Vorlagen', () => { const t = base(); saveTemplate(t); deleteTemplate(t.id); expect(loadTemplates()).toEqual([]) })
  it('kann eingebaute Beispiele nicht überschreiben oder dauerhaft löschen', () => {
    expect(() => saveTemplate(exampleTemplates[0])).toThrow(); deleteTemplate(exampleTemplates[0].id); expect(exampleTemplates).toHaveLength(5)
  })
  it('speichert dieselbe ID auch bei wiederholtem Speichern nur einmal', () => { const t = base(); saveTemplate(t); saveTemplate(t); expect(loadTemplates()).toHaveLength(1) })
  it('durchsucht den Titel', () => expect(findTemplates(exampleTemplates, 'JOINs')).toHaveLength(1))
  it('durchsucht Tags', () => expect(findTemplates(exampleTemplates, 'klausur')[0].id).toBe('example-klausur'))
  it('durchsucht Beschreibung und Lernziel', () => {
    expect(findTemplates([base()], 'vorhandenen')).toHaveLength(1); expect(findTemplates(exampleTemplates, 'Statistik')).toHaveLength(1)
  })
  it.each([['de', 4], ['en', 1], ['other', 0]])('filtert Sprache %s', (language, count) => expect(findTemplates(exampleTemplates, '', String(language))).toHaveLength(Number(count)))
  it('filtert Kategorie', () => expect(findTemplates(exampleTemplates, '', '', 'Informatik')).toHaveLength(2))
  it('filtert Herkunft', () => expect(findTemplates([...exampleTemplates, base()], '', '', '', 'custom')).toHaveLength(1))
  it('sortiert Namen', () => expect(findTemplates(exampleTemplates, '', '', '', '', 'name')[0].title).toBe('English Study Session'))
  it('sortiert Dauer', () => expect(findTemplates(exampleTemplates, '', '', '', '', 'duration').map(t => t.plannedMinutes)).toEqual([30, 30, 30, 45, 60]))
  it('sortiert Änderungsdatum', () => { const t = base(); expect(findTemplates([...exampleTemplates, t])[0].id).toBe(t.id) })
  it('exportiert versioniert und importiert mit neuer lokaler ID', () => {
    const t = base(), raw = exportTemplate(t), imported = importTemplate(raw)
    expect(JSON.parse(raw).format).toBe('mission-template'); expect(imported.id).not.toBe(t.id); expect(imported.origin).toBe('imported'); expect(imported.steps).toEqual(t.steps)
    expect(templateFilename(t)).toMatch(/\.json$/)
  })
  it.each(['{', '{}', '{"format":"mission-template","version":2}', '{"format":"other","version":1}'])('lehnt beschädigtes oder fremdes JSON %s ab', raw => expect(() => importTemplate(raw)).toThrow())
  it.each([
    { title: 'x'.repeat(91) }, { goal: 'x'.repeat(281) }, { language: 'fr' }, { language: ['de'] }, { category: 'Unbekannt' }, { tags: ['<script>'] }, { tags: Array(9).fill('tag') }, { tags: ['x'.repeat(25)] },
    { coins: 100 }, { sessionId: 'foreign' }, { steps: [] }, { plannedMinutes: 0 }, { createdAt: '2026-02-31T00:00:00.000Z' },
  ])('lehnt ungültige Metadaten ab: %j', patch => expect(() => validateTemplate({ ...base(), ...patch })).toThrow())
  it.each([0, -1, 1.5, 10081, '5', null])('lehnt ungültige Schrittzeit %s ab', minutes => {
    const t = base(); expect(() => validateTemplate({ ...t, steps: [{ ...t.steps[0], minutes }] })).toThrow()
  })
  it('lehnt HTML, fremde Schrittdaten und überlange Beschreibungen ab', () => {
    const t = base()
    for (const patch of [{ description: '<img src=x>' }, { description: 'x'.repeat(601) }, { done: true }, { kind: 'unknown' }]) expect(() => validateTemplate({ ...t, steps: [{ ...t.steps[0], ...patch }] })).toThrow()
  })
  it('normalisiert Whitespace und doppelte Tags', () => expect(normalizeTags([' SQL ', 'sql', '  java  basics '])).toEqual(['sql', 'java basics']))
  it('ergänzt optionale Beschreibung und Schrittart sicher', () => {
    const t = base(), { description: _description, ...withoutDescription } = t
    const { kind: _kind, ...step } = t.steps[0]
    const safe = validateTemplate({ ...withoutDescription, steps: [step], plannedMinutes: step.minutes })
    expect(safe.description).toBe(''); expect(safe.steps[0].kind).toBe('learning')
  })
  it('erlaubt Vergleichsoperatoren in Lernhandlungen, aber keine HTML-Tags', () => {
    const t = base(), step = { ...t.steps[0], description: 'Prüfe in Java die Bedingung x < 5 und x > 0.' }
    expect(validateTemplate({ ...t, steps: [step], plannedMinutes: step.minutes }).steps[0].description).toBe(step.description)
    expect(() => validateTemplate({ ...t, description: null })).toThrow()
    expect(() => validateTemplate({ ...t, steps: [{ ...step, kind: null }] })).toThrow()
  })
  it('begrenzt die Dateigröße', () => expect(() => importTemplate(' '.repeat(256 * 1024 + 1))).toThrow())
  it('erhält Vorlagen nach erneutem Laden', () => { const t = base(); saveTemplate(t); expect(loadTemplates()).toEqual(loadTemplates()); expect(loadTemplates()[0]).toEqual(t) })
  it.each(['{', '{"version":2,"templates":[]}', '{"version":1,"templates":[{}]}'])('überschreibt beschädigten Speicher nicht: %s', raw => {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, raw); expect(() => saveTemplate(base())).toThrow(); expect(localStorage.getItem(TEMPLATE_STORAGE_KEY)).toBe(raw)
  })
  it('begrenzt lokale Vorlagen auf 100, erlaubt dort aber Aktualisierungen', () => {
    const t = base(), templates: MissionTemplate[] = Array.from({ length: MAX_TEMPLATES }, (_, i) => ({ ...t, id: `local-${i}` }))
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify({ version: 1, templates }))
    expect(() => saveTemplate(base())).toThrow(/100/); saveTemplate({ ...templates[0], title: 'Aktualisiert' }); expect(loadTemplates()).toHaveLength(100)
  })
  it('enthält genau fünf gültige Beispiele mit stabilen IDs und frischem Fortschritt', () => {
    expect(exampleTemplates.map(t => t.id)).toEqual(['example-sql', 'example-statistik', 'example-java', 'example-klausur', 'example-english'])
    for (const t of exampleTemplates) { expect(validateTemplate(t)).toEqual(t); expect(missionFromTemplate(t).steps.every(s => !s.done)).toBe(true); expect(categories).toContain(t.category) }
  })
  it('schreibt bei allen Vorlagenaktionen ausschließlich den Bibliotheksschlüssel', () => {
    const keys = ['mission.gamification.v1', 'mission.saved-mission.v1']; keys.forEach(k => localStorage.setItem(k, '{"unchanged":true}'))
    const t = base(); saveTemplate(t); missionFromTemplate(t); findTemplates([t]); saveTemplate(importTemplate(exportTemplate(t))); deleteTemplate(t.id)
    for (const k of keys) expect(localStorage.getItem(k)).toBe('{"unchanged":true}')
  })
})
