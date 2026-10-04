import { createLearningPlanId, type LearningPlan, type LearningStepKind } from '../types/learningPlan'

export const TEMPLATE_STORAGE_KEY = 'mission.templates.v1'
export const MAX_TEMPLATES = 100
export const MAX_IMPORT_BYTES = 256 * 1024
export const categories = ['Mathematik', 'Informatik', 'Statistik', 'Sprachen', 'Naturwissenschaften', 'Wirtschaft', 'Prüfungsvorbereitung', 'Lesen / Literatur', 'Sonstiges'] as const
export type TemplateLanguage = 'de' | 'en' | 'other'
export type TemplateOrigin = 'custom' | 'ai' | 'example' | 'imported'
export type MissionTemplate = {
  id: string; title: string; description: string; goal: string
  steps: { title: string; description: string; minutes: number; kind: LearningStepKind }[]
  timeMode: 'automatic' | 'manual' | 'stopwatch'; plannedMinutes: number | null
  language: TemplateLanguage; category: typeof categories[number]; tags: string[]
  createdAt: string; updatedAt: string; origin: TemplateOrigin
}
export type TemplateMetadata = Pick<MissionTemplate, 'title' | 'description' | 'language' | 'category' | 'tags' | 'origin'>
function fail(): never { throw new Error('Ungültige Vorlage: Bitte prüfe Texte, Zeiten und Metadaten.') }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail()
  return value as Record<string, unknown>
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) fail()
}
function text(value: unknown, max: number, optional = false): string {
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim()) || /<\/?[a-z][^>]*>|<!--|[\u0000-\u0008]/i.test(value)) fail()
  return value.trim()
}
function minutes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10080) fail()
  return value
}
export function normalizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags) || tags.length > 8) fail()
  return [...new Set(tags.map(tag => text(tag, 24).replace(/\s+/g, ' ').toLocaleLowerCase()))]
}
export function validateTemplate(value: unknown): MissionTemplate {
  const t = object(value)
  keys(t, ['id', 'title', 'description', 'goal', 'steps', 'timeMode', 'plannedMinutes', 'language', 'category', 'tags', 'createdAt', 'updatedAt', 'origin'])
  if (typeof t.language !== 'string' || typeof t.origin !== 'string' || typeof t.timeMode !== 'string' || !['de', 'en', 'other'].includes(t.language) || !categories.includes(t.category as typeof categories[number]) || !['custom', 'ai', 'example', 'imported'].includes(t.origin) || !['automatic', 'manual', 'stopwatch'].includes(t.timeMode)) fail()
  if (!Array.isArray(t.steps) || t.steps.length < 1 || t.steps.length > 100 || !Array.isArray(t.tags)) fail()
  const steps = t.steps.map(value => {
    const s = object(value); keys(s, ['title', 'description', 'minutes', 'kind'])
    const kind = s.kind === undefined ? 'learning' : s.kind
    if (typeof kind !== 'string' || !['learning', 'practice', 'preparation', 'reflection'].includes(kind)) fail()
    return { title: text(s.title, 90), description: text(s.description, 600), minutes: minutes(s.minutes), kind: kind as LearningStepKind }
  })
  const sum = steps.reduce((n, s) => n + s.minutes, 0)
  if (sum > 10080 || (t.timeMode === 'stopwatch' ? t.plannedMinutes !== null : !Number.isInteger(t.plannedMinutes))) fail()
  const plannedMinutes = t.timeMode === 'stopwatch' ? null : minutes(t.plannedMinutes)
  if (t.timeMode === 'automatic' && plannedMinutes !== sum) fail()
  const createdAt = text(t.createdAt, 30), updatedAt = text(t.updatedAt, 30)
  if (![createdAt, updatedAt].every(date => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString() === date) || Date.parse(updatedAt) < Date.parse(createdAt)) fail()
  return { id: text(t.id, 100), title: text(t.title, 90), description: text(t.description === undefined ? '' : t.description, 600, true), goal: text(t.goal, 280), steps,
    timeMode: t.timeMode as MissionTemplate['timeMode'], plannedMinutes, language: t.language as TemplateLanguage,
    category: t.category as MissionTemplate['category'], tags: normalizeTags(t.tags as string[]), createdAt, updatedAt, origin: t.origin as TemplateOrigin }
}
export function templateFromPlan(plan: LearningPlan, metadata: TemplateMetadata, previous?: MissionTemplate): MissionTemplate {
  const now = new Date().toISOString(), timeMode = plan.timeMode ?? 'manual'
  return validateTemplate({ ...metadata, id: previous?.id ?? createLearningPlanId(), goal: plan.goal,
    steps: plan.steps.map(({ title, description, minutes, kind }) => ({ title, description, minutes, kind })), timeMode,
    plannedMinutes: timeMode === 'stopwatch' ? null : timeMode === 'automatic' ? plan.steps.reduce((n, s) => n + s.minutes, 0) : plan.timeBudgetMinutes,
    createdAt: previous?.createdAt ?? now, updatedAt: now })
}
export function missionFromTemplate(value: MissionTemplate): LearningPlan {
  const t = validateTemplate(value)
  return { id: createLearningPlanId(), goal: t.goal, timeMode: t.timeMode, timeBudgetMinutes: t.plannedMinutes ?? t.steps.reduce((n, s) => n + s.minutes, 0),
    energyLevel: 'medium', learningBlocker: null, steps: t.steps.map(s => ({ ...s, id: createLearningPlanId(), done: false })) }
}
export function loadTemplates(storage: Pick<Storage, 'getItem'> = localStorage): MissionTemplate[] {
  const raw = storage.getItem(TEMPLATE_STORAGE_KEY)
  if (!raw) return []
  const data = object(JSON.parse(raw)); keys(data, ['version', 'templates'])
  if (data.version !== 1 || !Array.isArray(data.templates) || data.templates.length > MAX_TEMPLATES) fail()
  const result = data.templates.map(validateTemplate)
  if (result.some(t => t.origin === 'example' || exampleTemplates.some(example => example.id === t.id)) || new Set(result.map(t => t.id)).size !== result.length) fail()
  return result
}
export function saveTemplate(template: MissionTemplate, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): MissionTemplate[] {
  const safe = validateTemplate(template)
  if (safe.origin === 'example' || exampleTemplates.some(t => t.id === safe.id)) fail()
  const previous = loadTemplates(storage), next = [...previous.filter(t => t.id !== safe.id), safe]
  if (next.length > MAX_TEMPLATES) throw new Error('Maximal 100 lokale Vorlagen. Lösche zuerst eine Vorlage.')
  storage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify({ version: 1, templates: next })); return next
}
export function deleteTemplate(id: string, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  const next = loadTemplates(storage).filter(t => t.id !== id)
  storage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify({ version: 1, templates: next })); return next
}
export function duplicateTemplate(t: MissionTemplate): MissionTemplate {
  return templateFromPlan(missionFromTemplate(t), { ...t, title: `${t.title.slice(0, 82)} (Kopie)`, origin: 'custom' })
}
export function exportTemplate(t: MissionTemplate): string { return JSON.stringify({ format: 'mission-template', version: 1, template: validateTemplate(t) }, null, 2) }
export function importTemplate(raw: string): MissionTemplate {
  if (new Blob([raw]).size > MAX_IMPORT_BYTES) fail()
  const data = object(JSON.parse(raw)); keys(data, ['format', 'version', 'template'])
  if (data.format !== 'mission-template' || data.version !== 1) fail()
  const t = validateTemplate(data.template), now = new Date().toISOString()
  return { ...t, id: createLearningPlanId(), origin: 'imported', createdAt: now, updatedAt: now }
}
export function templateFilename(t: MissionTemplate) { return `${t.title.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'mission'}.json` }
export function findTemplates(items: MissionTemplate[], query = '', language = '', category = '', origin = '', sort = 'updated'): MissionTemplate[] {
  const term = query.trim().toLocaleLowerCase()
  return items.filter(t => (!language || t.language === language) && (!category || t.category === category) && (!origin || t.origin === origin)
    && [t.title, t.goal, t.description, ...t.tags].join(' ').toLocaleLowerCase().includes(term))
    .sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : sort === 'duration' ? (a.plannedMinutes ?? Infinity) - (b.plannedMinutes ?? Infinity) : Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

function example(id: string, title: string, category: MissionTemplate['category'], language: TemplateLanguage, rows: [string, string, number, LearningStepKind][]): MissionTemplate {
  return validateTemplate({ id: `example-${id}`, title, goal: title, description: language === 'en' ? 'A short study session using your existing notes.' : 'Ein kleiner Lernblock mit deinen vorhandenen Unterlagen.', category, language, origin: 'example', tags: [id], timeMode: 'automatic',
    plannedMinutes: rows.reduce((n, row) => n + row[2], 0), steps: rows.map(([title, description, minutes, kind]) => ({ title, description, minutes, kind })), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })
}
export const exampleTemplates = [
  example('sql', 'SQL JOINs Grundlagen', 'Informatik', 'de', [
    ['Beispiel auswählen', 'Öffne deine SQL-Unterlagen und deinen lokalen SQL-Client. Wähle zwei vorhandene verknüpfte Tabellen.', 5, 'preparation'],
    ['INNER JOIN nachvollziehen', 'Führe einen vorhandenen INNER JOIN aus. Ordne zwei Ergebniszeilen ihren Ursprungstabellen zu.', 10, 'practice'],
    ['LEFT JOIN vergleichen', 'Passe das Beispiel zu einem LEFT JOIN an. Prüfe, welche Zeilen zusätzlich erscheinen.', 10, 'practice'],
    ['Unterschied festhalten', 'Notiere in eigenen Worten, wann du welchen JOIN verwenden würdest.', 5, 'reflection']]),
  example('statistik', 'Statistik Grundlagen wiederholen', 'Statistik', 'de', [
    ['Unterlagen öffnen', 'Suche in deinen Statistik-Unterlagen eine kleine Zahlenreihe mit Beispielrechnung.', 5, 'preparation'],
    ['Mittelwert und Median', 'Rechne Mittelwert und Median dieser Zahlenreihe nach. Vergleiche mit deinem vorhandenen Beispiel.', 15, 'practice'],
    ['Verständnis prüfen', 'Erkläre ohne Nachlesen, wie ein Ausreißer Mittelwert und Median beeinflusst. Prüfe danach deine Unterlagen.', 5, 'learning'],
    ['Kurz zusammenfassen', 'Notiere den Unterschied und eine noch offene Frage für den nächsten Lernblock.', 5, 'reflection']]),
  example('java', 'Java Grundlagen', 'Informatik', 'de', [
    ['Beispiel öffnen', 'Öffne dein Java-Projekt oder eine vorhandene Übungsdatei in deinem Editor.', 5, 'preparation'],
    ['Variablen und Datentypen', 'Suche zwei Variablen im Beispiel. Ändere ihre Werte und beobachte die Ausgabe.', 10, 'practice'],
    ['Verzweigung nachvollziehen', 'Gehe eine vorhandene if-Verzweigung mit zwei unterschiedlichen Eingaben durch.', 10, 'learning'],
    ['Eigenes kleines Beispiel', 'Schreibe eine kurze if-Abfrage mit einer Zahl und einer Textausgabe. Führe sie mit zwei Werten aus.', 15, 'practice'],
    ['Erkenntnis sichern', 'Notiere einen passenden Datentyp und die Bedeutung deiner Bedingung.', 5, 'reflection']]),
  example('klausur', 'Klausurblock planen', 'Prüfungsvorbereitung', 'de', [
    ['Stoff auswählen', 'Öffne deine Stoffliste und wähle einen begrenzten Abschnitt für diesen Lernblock.', 5, 'preparation'],
    ['Priorität setzen', 'Markiere eine wichtige Aufgabe aus deinen Unterlagen. Lege Ablenkungen außer Reichweite.', 5, 'preparation'],
    ['Konzentriert bearbeiten', 'Bearbeite die ausgewählte Aufgabe Schritt für Schritt. Markiere Stellen, an denen du hängenbleibst.', 35, 'practice'],
    ['Selbstprüfung', 'Versuche den wichtigsten Lösungsweg ohne Unterlagen zu erklären und überprüfe ihn anschließend.', 10, 'learning'],
    ['Nächsten Schritt notieren', 'Halte eine offene Frage und die erste Handlung für den nächsten Lernblock fest.', 5, 'reflection']]),
  example('english', 'English Study Session', 'Sprachen', 'en', [
    ['Choose a short text', 'Open your English notes and choose one short paragraph you already have.', 5, 'preparation'],
    ['Read and mark', 'Read the paragraph and mark up to three unfamiliar words. Check their meaning in your existing notes.', 10, 'learning'],
    ['Use the words', 'Write one sentence for each selected word. Read your sentences aloud once.', 10, 'practice'],
    ['Keep a short summary', 'Write two sentences about the paragraph and one question for your next session.', 5, 'reflection']]),
]
